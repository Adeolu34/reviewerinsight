const ScraperRun = require('../../models/ScraperRun');
const logger = require('../../utils/logger');

const NprBooksScraper = require('./nprBooks');
const GuardianBooksScraper = require('./guardianBooks');
const BookPageScraper = require('./bookPage');
const OpenLibraryScraper = require('./openLibrary');

const SCRAPERS = {
  npr: new NprBooksScraper(),
  guardian: new GuardianBooksScraper(),
  bookpage: new BookPageScraper(),
  openlibrary: new OpenLibraryScraper(),
};

/**
 * Run a single scraper by source name.
 * Returns the ScraperRun ID.
 */
async function runScraper(sourceName, trigger = 'manual') {
  const scraper = SCRAPERS[sourceName];
  if (!scraper) {
    throw new Error(`Unknown scraper: "${sourceName}". Available: ${Object.keys(SCRAPERS).join(', ')}`);
  }

  const run = await ScraperRun.create({
    source: sourceName,
    trigger,
    status: 'running',
  });

  logger.info(`[Scraper] Starting ${sourceName} (run: ${run._id})`);

  try {
    const stats = await scraper.run(run._id);

    run.booksFound = stats.booksFound;
    run.booksNew = stats.booksNew;
    run.booksDuplicate = stats.booksDuplicate;
    run.booksFailed = stats.booksFailed;
    run.errors = stats.errors;
    run.status = stats.booksFailed > 0 && stats.booksNew > 0 ? 'partial'
               : stats.booksFailed > 0 && stats.booksNew === 0 ? 'failed'
               : 'completed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();
    await run.save();

    return run._id.toString();
  } catch (err) {
    run.status = 'failed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();
    run.errors.push({ title: 'scraper', error: err.message, timestamp: new Date() });
    await run.save();
    logger.error(`[Scraper] ${sourceName} failed: ${err.message}`);
    throw err;
  }
}

/**
 * Run all scrapers sequentially.
 */
async function runAllScrapers(trigger = 'scheduled') {
  const results = {};
  for (const source of Object.keys(SCRAPERS)) {
    try {
      results[source] = await runScraper(source, trigger);
    } catch (err) {
      results[source] = { error: err.message };
    }
  }
  return results;
}

function getAvailableSources() {
  return Object.keys(SCRAPERS);
}

module.exports = { runScraper, runAllScrapers, getAvailableSources };
