const Book = require('../models/Book');
const AgentRun = require('../models/AgentRun');
const { discoverBooks } = require('../services/bookDiscovery');
const { generateReview, generateChapterSummary } = require('../services/openaiReview');
const { generateCoverDesign } = require('../services/coverResolver');
const logger = require('../utils/logger');

// Concurrent requests to OpenAI — high enough to be fast, low enough to
// stay well within rate limits (gpt-4o allows 10k RPM).
const REVIEW_CONCURRENCY = 5;
const CHAPTER_CONCURRENCY = 3;

// ─── Per-book helpers ────────────────────────────────────────────────────────

async function generateAndSaveReview(book, persona) {
  const { review, tokensUsed } = await generateReview(book, persona);
  await Book.findByIdAndUpdate(book._id, {
    blurb: review.blurb,
    takeaways: review.takeaways,
    rating: review.rating,
    review: {
      headline: review.headline,
      stand: review.stand,
      paragraphs: review.paragraphs,
      pullQuote: review.pullQuote,
      summaryBullets: review.summaryBullets,
    },
    status: 'published',
    'sources.reviewGeneratedAt': new Date(),
  });
  return { tokensUsed };
}

async function generateAndSaveChapters(book, persona) {
  const { chapterSummaries, tokensUsed } = await generateChapterSummary(book, persona);
  await Book.findByIdAndUpdate(book._id, {
    chapterSummaries,
    'sources.chapterSummariesGeneratedAt': new Date(),
  });
  return { tokensUsed };
}

// ─── Main pipeline ──────────────────────────────────────────────────────────

/**
 * Run the full pipeline: discover → review → chapter summaries.
 * @param {Object} persona - Editor persona
 * @param {Object} options - { batchSize, backfill }
 * @returns {string} AgentRun ID
 */
async function runPipeline(persona, options = {}) {
  const { batchSize = 50, backfill = false } = options;
  const currentYear = new Date().getFullYear();

  const run = await AgentRun.create({
    editor: persona.name,
    status: 'running',
    searchQueries: persona.searchQueries.map(q => q.replace('{year}', currentYear)),
  });

  logger.info(`Agent run started: ${persona.name} (run: ${run._id}, batch: ${batchSize})`);

  try {
    let booksToProcess = [];

    if (backfill) {
      // Recovery mode: re-review published books that somehow lost their review
      booksToProcess = await Book.find({
        editor: persona.name,
        status: 'published',
        'review.headline': { $exists: false },
      }).limit(batchSize).lean();

      logger.info(`Backfill mode: ${booksToProcess.length} books needing reviews`);
    } else {
      // Primary: pull from pre-queued metadata_complete books (auto-imported from scrapers)
      booksToProcess = await Book.find({
        editor: persona.name,
        status: 'metadata_complete',
      }).limit(batchSize).lean();

      run.booksDiscovered = booksToProcess.length;
      logger.info(`Queue: ${booksToProcess.length} pre-queued books for ${persona.name}`);

      // Supplement with fresh web discovery if the queue is short
      if (booksToProcess.length < batchSize) {
        const needed = batchSize - booksToProcess.length;
        const queries = persona.searchQueries.map(q => q.replace('{year}', currentYear));
        const discovered = await discoverBooks(queries, { batchSize: needed, editorName: persona.name });

        for (const bookData of discovered) {
          try {
            const saved = await Book.create(bookData);
            booksToProcess.push(saved.toObject());
            run.booksDiscovered += 1;
          } catch (err) {
            if (err.code === 11000) {
              run.booksSkipped += 1;
            } else {
              run.booksFailed += 1;
              run.errors.push({ bookTitle: bookData.title, error: err.message, timestamp: new Date() });
              logger.error(`Failed to save "${bookData.title}": ${err.message}`);
            }
          }
        }

        logger.info(`Discovery supplemented: ${discovered.length} additional books found`);
      }
    }

    // ──── Phase 1: Generate reviews (concurrent) ─────────────────────────────
    const successfulBookIds = [];

    for (let i = 0; i < booksToProcess.length; i += REVIEW_CONCURRENCY) {
      const chunk = booksToProcess.slice(i, i + REVIEW_CONCURRENCY);

      const results = await Promise.allSettled(
        chunk.map(book => generateAndSaveReview(book, persona))
      );

      for (let j = 0; j < results.length; j++) {
        const book = chunk[j];
        const r = results[j];

        if (r.status === 'fulfilled') {
          successfulBookIds.push(book._id);
          run.booksReviewed += 1;
          run.tokensUsed += r.value.tokensUsed;
          run.estimatedCost += (r.value.tokensUsed * 0.6) / 1000000;
          logger.info(`Review complete: "${book.title}"`);
        } else {
          run.booksFailed += 1;
          run.errors.push({ bookTitle: book.title, error: r.reason?.message || 'Unknown error', timestamp: new Date() });
          await Book.findByIdAndUpdate(book._id, { status: 'failed', errorLog: r.reason?.message });
          logger.error(`Review failed for "${book.title}": ${r.reason?.message}`);
        }
      }

      // Persist progress after every chunk so admin dashboard stays live
      await run.save();
    }

    // ──── Phase 2: Chapter summaries (concurrent) ────────────────────────────
    const reviewedBooks = await Book.find({
      _id: { $in: successfulBookIds },
      status: 'published',
    }).lean();

    for (let i = 0; i < reviewedBooks.length; i += CHAPTER_CONCURRENCY) {
      const chunk = reviewedBooks.slice(i, i + CHAPTER_CONCURRENCY);

      const results = await Promise.allSettled(
        chunk.map(book => generateAndSaveChapters(book, persona))
      );

      for (let j = 0; j < results.length; j++) {
        const book = chunk[j];
        const r = results[j];

        if (r.status === 'fulfilled') {
          run.chaptersGenerated = (run.chaptersGenerated || 0) + 1;
          run.tokensUsed += r.value.tokensUsed;
          run.estimatedCost += (r.value.tokensUsed * 0.6) / 1000000;
          logger.info(`Chapters complete: "${book.title}"`);
        } else {
          // Chapter failure is non-fatal — the review is already published
          run.errors.push({
            bookTitle: book.title,
            error: `Chapters failed: ${r.reason?.message}`,
            timestamp: new Date(),
          });
          logger.warn(`Chapter generation failed for "${book.title}": ${r.reason?.message}`);
        }
      }

      await run.save();
    }

    // ──── Finalize run ────────────────────────────────────────────────────────
    run.status = run.booksFailed > 0 && run.booksReviewed > 0 ? 'partial'
               : run.booksFailed > 0 ? 'failed'
               : 'completed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();
    await run.save();

    logger.info(
      `Agent run complete: ${persona.name} — ` +
      `Discovered: ${run.booksDiscovered}, Reviewed: ${run.booksReviewed}, ` +
      `Chapters: ${run.chaptersGenerated || 0}, Failed: ${run.booksFailed}`
    );

    return run._id.toString();
  } catch (err) {
    run.status = 'failed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();
    run.errors.push({ bookTitle: 'pipeline', error: err.message, timestamp: new Date() });
    await run.save();

    logger.error(`Agent run failed: ${persona.name} — ${err.message}`);
    throw err;
  }
}

module.exports = { runPipeline };
