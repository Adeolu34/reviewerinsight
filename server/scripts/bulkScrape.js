/**
 * One-shot bulk scrape + auto-import script.
 * Seeds the review queue with a large number of books directly from
 * Open Library, then imports them all into the agent pipeline.
 *
 * Usage:
 *   node scripts/bulkScrape.js            # default 10,000 books
 *   node scripts/bulkScrape.js 5000       # custom target
 *   node scripts/bulkScrape.js 25000      # full run (all subjects, 5 pages each)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ScraperRun = require('../src/models/ScraperRun');
const OpenLibraryBulkScraper = require('../src/services/scrapers/openLibraryBulk');
const { autoImportBatch } = require('../src/services/autoImport');
const logger = require('../src/utils/logger');

const TARGET = parseInt(process.argv[2] || '10000', 10);

function fmt(n) { return n.toLocaleString(); }

async function main() {
  console.log(`\n📚 Bulk Scrape — target: ${fmt(TARGET)} new books\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  // ── Phase 1: Scrape from Open Library ─────────────────────────────────────
  console.log('Phase 1: Scraping Open Library…');
  const scraper = new OpenLibraryBulkScraper({ maxBooks: TARGET });

  const run = await ScraperRun.create({
    source: 'openlibraryBulk',
    trigger: 'manual',
    status: 'running',
  });

  let stats;
  try {
    stats = await scraper.run(run._id);
    run.booksFound     = stats.booksFound;
    run.booksNew       = stats.booksNew;
    run.booksDuplicate = stats.booksDuplicate;
    run.booksFailed    = stats.booksFailed;
    run.errors         = stats.errors;
    run.status         = stats.booksNew > 0 ? 'completed' : 'failed';
    run.completedAt    = new Date();
    run.durationMs     = Date.now() - run.startedAt.getTime();
    await run.save();

    console.log(`\nScrape complete:`);
    console.log(`  Raw candidates found : ${fmt(stats.booksFound)}`);
    console.log(`  New (unique)         : ${fmt(stats.booksNew)}`);
    console.log(`  Duplicates skipped   : ${fmt(stats.booksDuplicate)}`);
    console.log(`  Failed               : ${fmt(stats.booksFailed)}`);
    console.log(`  Run ID               : ${run._id}\n`);
  } catch (err) {
    run.status = 'failed';
    run.completedAt = new Date();
    await run.save();
    console.error('Scrape failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (stats.booksNew === 0) {
    console.log('No new books found — queue may already be up to date.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Phase 2: Auto-import into the review queue ─────────────────────────────
  console.log('Phase 2: Importing into review queue…');
  let totalImported = 0;
  let totalSkipped  = 0;
  let batchNum      = 0;

  while (true) {
    const batch = await autoImportBatch(500);
    const processed = batch.imported + batch.skipped + batch.failed;
    if (processed === 0) break; // nothing left to process

    totalImported += batch.imported;
    totalSkipped  += batch.skipped;
    batchNum++;

    process.stdout.write(
      `\r  Batch ${batchNum}: imported ${fmt(totalImported)}, skipped ${fmt(totalSkipped)}   `
    );
  }

  console.log(`\n\nImport complete:`);
  console.log(`  Books added to review queue : ${fmt(totalImported)}`);
  console.log(`  Skipped (already exist)     : ${fmt(totalSkipped)}`);

  const daysNeeded = Math.ceil(totalImported / 800);
  console.log(`\nAt ~800 books/day the agents will finish in ~${daysNeeded} day${daysNeeded !== 1 ? 's' : ''}.`);
  console.log('The automation is running — no further action needed.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
