/**
 * Backfill script: fills every gap in the book catalogue.
 *
 * Handles all four incomplete states:
 *   1. failed          → reset + regenerate review + chapters
 *   2. metadata_complete → generate review + chapters
 *   3. published, no review → regenerate review + chapters
 *   4. published, has review, no chapters → generate chapters only
 *
 * Safe to run multiple times — only touches incomplete books.
 * Resumable: if interrupted, re-running will continue from where it left off.
 *
 * Usage:
 *   node scripts/fillMissingContent.js            # fix everything
 *   node scripts/fillMissingContent.js --dry-run  # show counts only, no changes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../src/models/Book');
const { generateReview, generateChapterSummary } = require('../src/services/openaiReview');
const logger = require('../src/utils/logger');

const CONCURRENCY = 5;  // concurrent OpenAI calls per batch
const BATCH_SIZE  = 50; // books fetched per DB query
const DRY_RUN     = process.argv.includes('--dry-run');

// ─── Personas ────────────────────────────────────────────────────────────────
const personas = {
  'Mira Okafor': require('../src/agents/prompts/miraOkafor'),
  'Jules Park':  require('../src/agents/prompts/julesPark'),
  'Dae Han':     require('../src/agents/prompts/daeHan'),
  'Noor Saleh':  require('../src/agents/prompts/noorSaleh'),
};
function getPersona(editor) { return personas[editor] || personas['Mira Okafor']; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString(); }

function clearLine(msg) {
  process.stdout.write(`\r\x1b[2K${msg}`);
}

async function processReview(book) {
  const persona = getPersona(book.editor);
  const { review, tokensUsed } = await generateReview(book, persona);
  await Book.findByIdAndUpdate(book._id, {
    blurb:     review.blurb,
    takeaways: review.takeaways,
    rating:    review.rating,
    review: {
      headline:       review.headline,
      stand:          review.stand,
      paragraphs:     review.paragraphs,
      pullQuote:      review.pullQuote,
      summaryBullets: review.summaryBullets,
    },
    status: 'published',
    errorLog: '',
    'sources.reviewGeneratedAt': new Date(),
  });
  return tokensUsed;
}

async function processChapters(book) {
  const persona = getPersona(book.editor);
  const { chapterSummaries, tokensUsed } = await generateChapterSummary(book, persona);
  await Book.findByIdAndUpdate(book._id, {
    chapterSummaries,
    'sources.chapterSummariesGeneratedAt': new Date(),
  });
  return tokensUsed;
}

/**
 * Process a set of books concurrently.
 * Returns { done, failed }.
 */
async function runConcurrent(books, fn, label, counters) {
  for (let i = 0; i < books.length; i += CONCURRENCY) {
    const chunk = books.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(chunk.map(b => fn(b)));

    for (let j = 0; j < results.length; j++) {
      const book = chunk[j];
      const r    = results[j];

      if (r.status === 'fulfilled') {
        counters.done++;
        counters.tokens += r.value || 0;
      } else {
        counters.failed++;
        const msg = r.reason?.message || 'Unknown error';
        logger.error(`[Backfill] ${label} failed for "${book.title}": ${msg}`);
        if (label === 'review') {
          await Book.findByIdAndUpdate(book._id, { status: 'failed', errorLog: msg });
        }
      }
    }

    clearLine(`  ${label}: ${fmt(counters.done)} done, ${fmt(counters.failed)} failed`);
  }
}

/**
 * Iterate over all books matching a query, page by page.
 * Uses _id cursor so re-runs skip already-processed books.
 */
async function* paginate(query) {
  let lastId = null;
  while (true) {
    const q = lastId ? { ...query, _id: { $gt: lastId } } : query;
    const books = await Book.find(q).sort({ _id: 1 }).limit(BATCH_SIZE).lean();
    if (books.length === 0) break;
    lastId = books[books.length - 1]._id;
    yield books;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  // ── Audit: count all gaps ──────────────────────────────────────────────────
  const [failedCnt, pendingCnt, noReviewCnt, noChaptersCnt] = await Promise.all([
    Book.countDocuments({ status: 'failed' }),
    Book.countDocuments({ status: 'metadata_complete' }),
    Book.countDocuments({ status: 'published', 'review.headline': { $exists: false } }),
    Book.countDocuments({
      status: 'published',
      'review.headline': { $exists: true },
      $or: [
        { chapterSummaries: { $exists: false } },
        { 'chapterSummaries.0': { $exists: false } },
      ],
    }),
  ]);

  const totalReviews  = failedCnt + pendingCnt + noReviewCnt;
  const totalChapters = noChaptersCnt;

  console.log('Gap audit:');
  console.log(`  failed books               : ${fmt(failedCnt)}`);
  console.log(`  metadata_complete (no review): ${fmt(pendingCnt)}`);
  console.log(`  published, review missing  : ${fmt(noReviewCnt)}`);
  console.log(`  published, chapters missing: ${fmt(noChaptersCnt)}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  need review generated      : ${fmt(totalReviews)}`);
  console.log(`  need chapters generated    : ${fmt(totalChapters)}\n`);

  if (DRY_RUN) {
    console.log('Dry run — no changes made.');
    await mongoose.disconnect();
    return;
  }

  if (totalReviews + totalChapters === 0) {
    console.log('All books are fully complete!');
    await mongoose.disconnect();
    return;
  }

  // ── Phase 1: Reset failed books ────────────────────────────────────────────
  if (failedCnt > 0) {
    process.stdout.write(`Resetting ${fmt(failedCnt)} failed books to metadata_complete…`);
    await Book.updateMany(
      { status: 'failed' },
      { $set: { status: 'metadata_complete', errorLog: '' } }
    );
    console.log(' done.\n');
  }

  // ── Phase 2: Generate missing reviews ─────────────────────────────────────
  if (totalReviews > 0) {
    const counters = { done: 0, failed: 0, tokens: 0 };
    console.log(`Generating ${fmt(totalReviews)} missing reviews (${CONCURRENCY} concurrent)…`);

    const reviewQuery = {
      $or: [
        { status: 'metadata_complete' },
        { status: 'published', 'review.headline': { $exists: false } },
      ],
    };

    for await (const books of paginate(reviewQuery)) {
      await runConcurrent(books, processReview, 'review', counters);
    }

    console.log(`\nReviews done: ${fmt(counters.done)} generated, ${fmt(counters.failed)} failed`);
    console.log(`Tokens used: ${fmt(counters.tokens)}\n`);
  }

  // ── Phase 3: Generate missing chapter summaries ────────────────────────────
  // Re-count after review phase — newly published books also need chapters
  const chapterQuery = {
    status: 'published',
    'review.headline': { $exists: true },
    $or: [
      { chapterSummaries: { $exists: false } },
      { 'chapterSummaries.0': { $exists: false } },
    ],
  };

  const chaptersTotal = await Book.countDocuments(chapterQuery);

  if (chaptersTotal > 0) {
    const counters = { done: 0, failed: 0, tokens: 0 };
    console.log(`Generating ${fmt(chaptersTotal)} missing chapter summaries (${CONCURRENCY} concurrent)…`);

    for await (const books of paginate(chapterQuery)) {
      await runConcurrent(books, processChapters, 'chapters', counters);
    }

    console.log(`\nChapters done: ${fmt(counters.done)} generated, ${fmt(counters.failed)} failed`);
    console.log(`Tokens used: ${fmt(counters.tokens)}\n`);
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const [remainingIncomplete] = await Promise.all([
    Book.countDocuments({
      $or: [
        { status: 'metadata_complete' },
        { status: 'failed' },
        { status: 'published', 'review.headline': { $exists: false } },
        {
          status: 'published',
          'review.headline': { $exists: true },
          $or: [
            { chapterSummaries: { $exists: false } },
            { 'chapterSummaries.0': { $exists: false } },
          ],
        },
      ],
    }),
  ]);

  if (remainingIncomplete === 0) {
    console.log('All books are fully complete.');
  } else {
    console.log(`${fmt(remainingIncomplete)} books still incomplete (likely OpenAI failures — re-run to retry).`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
