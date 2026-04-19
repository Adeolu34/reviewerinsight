const Book = require('../models/Book');
const AgentRun = require('../models/AgentRun');
const { discoverBooks } = require('../services/bookDiscovery');
const { generateReview, generateChapterSummary } = require('../services/openaiReview');
const { generateCoverDesign } = require('../services/coverResolver');
const logger = require('../utils/logger');

/**
 * Run the full pipeline: discover → enrich → generate review → save.
 * @param {Object} persona - Editor persona with searchQueries and systemPrompt
 * @param {Object} options - { batchSize, backfill }
 * @returns {string} AgentRun ID
 */
async function runPipeline(persona, options = {}) {
  const { batchSize = 10, backfill = false } = options;
  const currentYear = new Date().getFullYear();

  // Create agent run log
  const run = await AgentRun.create({
    editor: persona.name,
    status: 'running',
    searchQueries: persona.searchQueries.map(q => q.replace('{year}', currentYear)),
  });

  logger.info(`Agent run started: ${persona.name} (run: ${run._id}, batch: ${batchSize})`);

  try {
    let booksToProcess = [];

    if (backfill) {
      // Backfill mode: generate reviews for existing books without reviews
      booksToProcess = await Book.find({
        editor: persona.name,
        status: 'published',
        'review.headline': { $exists: false },
      }).limit(batchSize).lean();

      logger.info(`Backfill mode: found ${booksToProcess.length} books needing reviews`);
    } else {
      // Discovery mode: find new books from the web
      const queries = persona.searchQueries.map(q => q.replace('{year}', currentYear));
      const discovered = await discoverBooks(queries, { batchSize, editorName: persona.name });

      // Save discovered books to DB
      for (const bookData of discovered) {
        try {
          const saved = await Book.create(bookData);
          booksToProcess.push(saved.toObject());
          run.booksDiscovered += 1;
        } catch (err) {
          if (err.code === 11000) {
            run.booksSkipped += 1;
            logger.debug(`Duplicate skipped: "${bookData.title}"`);
          } else {
            run.booksFailed += 1;
            run.errors.push({ bookTitle: bookData.title, error: err.message, timestamp: new Date() });
            logger.error(`Failed to save "${bookData.title}": ${err.message}`);
          }
        }
      }
    }

    // Generate reviews for each book
    for (const book of booksToProcess) {
      try {
        logger.info(`Generating review: "${book.title}" by ${book.author}`);

        const { review, tokensUsed } = await generateReview(book, persona);

        // Update the book with the review
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

        run.booksReviewed += 1;
        run.tokensUsed += tokensUsed;

        // Estimate cost (using gpt-4o pricing as baseline)
        const inputCost = (tokensUsed * 0.6) / 1000000; // rough average
        run.estimatedCost += inputCost;

        logger.info(`Review complete: "${book.title}" — Rating: ${review.rating}`);
      } catch (err) {
        run.booksFailed += 1;
        run.errors.push({ bookTitle: book.title, error: err.message, timestamp: new Date() });
        logger.error(`Review generation failed for "${book.title}": ${err.message}`);

        // Mark book as failed
        await Book.findByIdAndUpdate(book._id, {
          status: 'failed',
          errorLog: err.message,
        });
      }
    }

    // ──── Phase 2: Generate chapter summaries for reviewed books ────
    const reviewedBookIds = booksToProcess
      .filter((_, i) => !run.errors.some(e => e.bookTitle === booksToProcess[i]?.title))
      .map(b => b._id);

    const reviewedBooks = await Book.find({
      _id: { $in: reviewedBookIds },
      status: 'published',
      'review.headline': { $exists: true },
    }).lean();

    for (const book of reviewedBooks) {
      try {
        logger.info(`Generating chapter summaries: "${book.title}" by ${book.author}`);

        const { chapterSummaries, tokensUsed } = await generateChapterSummary(book, persona);

        await Book.findByIdAndUpdate(book._id, {
          chapterSummaries,
          'sources.chapterSummariesGeneratedAt': new Date(),
        });

        run.chaptersGenerated = (run.chaptersGenerated || 0) + 1;
        run.tokensUsed += tokensUsed;

        const inputCost = (tokensUsed * 0.6) / 1000000;
        run.estimatedCost += inputCost;

        logger.info(`Chapter summaries complete: "${book.title}" — ${chapterSummaries.length} chapters`);
      } catch (err) {
        // Chapter summary failures are non-fatal — book already has its review
        run.errors.push({
          bookTitle: book.title,
          error: `Chapter summaries failed: ${err.message}`,
          timestamp: new Date(),
        });
        logger.warn(`Chapter summary generation failed for "${book.title}": ${err.message}`);
      }
    }

    // Complete the run
    run.status = run.booksFailed > 0 && run.booksReviewed > 0 ? 'partial' : run.booksFailed > 0 ? 'failed' : 'completed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();
    await run.save();

    logger.info(`Agent run completed: ${persona.name} — Discovered: ${run.booksDiscovered}, Reviewed: ${run.booksReviewed}, Failed: ${run.booksFailed}, Skipped: ${run.booksSkipped}`);

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
