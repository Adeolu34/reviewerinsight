const cron = require('node-cron');
const Book = require('../models/Book');
const AgentRun = require('../models/AgentRun');
const { generateReview, generateChapterSummary } = require('../services/openaiReview');
const EditorAgent = require('./EditorAgent');
const logger = require('../utils/logger');

const REVIEW_CONCURRENCY = 5;
const CHAPTER_CONCURRENCY = 3;
const REVIEW_BATCH = 200;
const CHAPTER_BATCH = 100;
const DEFAULT_PERSONA = 'Mira Okafor';

class BackfillAgent {
  constructor() {
    this.running = false;
    this.job = null;
  }

  /**
   * Start the continuous backfill schedule.
   * Runs every 20 minutes. Also fires once 15s after server startup so
   * any backlog from a restart is picked up immediately.
   */
  startSchedule() {
    this.job = cron.schedule('*/20 * * * *', async () => {
      await this.run();
    }, { timezone: 'UTC' });

    setTimeout(() => this.run(), 15000);

    logger.info('BackfillAgent started — every 20 minutes (covers all incomplete books)');
  }

  async run() {
    if (this.running) {
      logger.info('BackfillAgent: previous run still active, skipping tick');
      return;
    }

    this.running = true;
    const run = await AgentRun.create({ editor: 'Backfill', status: 'running' });

    try {
      // ── Phase 1: Reset failed books so they re-enter the queue ──────────────
      const failedCount = await Book.countDocuments({ status: 'failed' });
      if (failedCount > 0) {
        await Book.updateMany(
          { status: 'failed' },
          { $set: { status: 'metadata_complete', errorLog: '' } }
        );
        logger.info(`BackfillAgent: reset ${failedCount} failed books → metadata_complete`);
      }

      // ── Phase 2: Generate missing reviews ───────────────────────────────────
      const needsReview = await Book.find({
        $or: [
          { status: 'metadata_complete' },
          { status: 'published', 'review.headline': { $exists: false } },
        ],
      }).sort({ createdAt: 1 }).limit(REVIEW_BATCH).lean();

      if (needsReview.length > 0) {
        logger.info(`BackfillAgent: generating reviews for ${needsReview.length} books`);
        const stats = await this._runReviews(needsReview, run);
        run.booksReviewed += stats.done;
        run.booksFailed += stats.failed;
        run.tokensUsed += stats.tokens;
        run.estimatedCost += (stats.tokens * 0.6) / 1000000;
        await run.save();
      }

      // ── Phase 3: Generate missing chapter summaries ──────────────────────────
      const needsChapters = await Book.find({
        status: 'published',
        'review.headline': { $exists: true },
        $or: [
          { chapterSummaries: { $exists: false } },
          { 'chapterSummaries.0': { $exists: false } },
        ],
      }).sort({ createdAt: 1 }).limit(CHAPTER_BATCH).lean();

      if (needsChapters.length > 0) {
        logger.info(`BackfillAgent: generating chapters for ${needsChapters.length} books`);
        const stats = await this._runChapters(needsChapters, run);
        run.chaptersGenerated = (run.chaptersGenerated || 0) + stats.done;
        run.tokensUsed += stats.tokens;
        run.estimatedCost += (stats.tokens * 0.6) / 1000000;
        await run.save();
      }

      const totalProcessed = needsReview.length + needsChapters.length;
      if (totalProcessed === 0) {
        logger.info('BackfillAgent: catalogue fully up to date');
      } else {
        logger.info(
          `BackfillAgent: run complete — reviews: ${run.booksReviewed}, ` +
          `chapters: ${run.chaptersGenerated || 0}, failed: ${run.booksFailed}`
        );
      }

      run.status = run.booksFailed > 0 && run.booksReviewed > 0 ? 'partial'
                 : run.booksFailed > 0 && run.booksReviewed === 0 ? 'failed'
                 : 'completed';
    } catch (err) {
      run.status = 'failed';
      run.errors.push({ bookTitle: 'backfill-agent', error: err.message, timestamp: new Date() });
      logger.error(`BackfillAgent: fatal error — ${err.message}`);
    } finally {
      run.completedAt = new Date();
      run.durationMs = Date.now() - run.startedAt.getTime();
      await run.save();
      this.running = false;
    }
  }

  async _runReviews(books, run) {
    let done = 0, failed = 0, tokens = 0;

    for (let i = 0; i < books.length; i += REVIEW_CONCURRENCY) {
      const chunk = books.slice(i, i + REVIEW_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(book => this._generateReview(book))
      );

      for (let j = 0; j < results.length; j++) {
        const book = chunk[j];
        const r = results[j];
        if (r.status === 'fulfilled') {
          done++;
          tokens += r.value;
          logger.info(`BackfillAgent: review done — "${book.title}"`);
        } else {
          failed++;
          const msg = r.reason?.message || 'Unknown error';
          run.errors.push({ bookTitle: book.title, error: msg, timestamp: new Date() });
          await Book.findByIdAndUpdate(book._id, { status: 'failed', errorLog: msg });
          logger.error(`BackfillAgent: review failed — "${book.title}": ${msg}`);
        }
      }
    }

    return { done, failed, tokens };
  }

  async _runChapters(books, run) {
    let done = 0, tokens = 0;

    for (let i = 0; i < books.length; i += CHAPTER_CONCURRENCY) {
      const chunk = books.slice(i, i + CHAPTER_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(book => this._generateChapters(book))
      );

      for (let j = 0; j < results.length; j++) {
        const book = chunk[j];
        const r = results[j];
        if (r.status === 'fulfilled') {
          done++;
          tokens += r.value;
          logger.info(`BackfillAgent: chapters done — "${book.title}"`);
        } else {
          // Chapter failures are non-fatal — the review is already published
          const msg = r.reason?.message || 'Unknown error';
          run.errors.push({ bookTitle: book.title, error: `chapters: ${msg}`, timestamp: new Date() });
          logger.warn(`BackfillAgent: chapters failed — "${book.title}": ${msg}`);
        }
      }
    }

    return { done, tokens };
  }

  async _generateReview(book) {
    const persona = EditorAgent.getPersona(book.editor) || EditorAgent.getPersona(DEFAULT_PERSONA);
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
      errorLog: '',
      'sources.reviewGeneratedAt': new Date(),
    });
    return tokensUsed;
  }

  async _generateChapters(book) {
    const persona = EditorAgent.getPersona(book.editor) || EditorAgent.getPersona(DEFAULT_PERSONA);
    const { chapterSummaries, tokensUsed } = await generateChapterSummary(book, persona);
    await Book.findByIdAndUpdate(book._id, {
      chapterSummaries,
      'sources.chapterSummariesGeneratedAt': new Date(),
    });
    return tokensUsed;
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    logger.info('BackfillAgent stopped');
  }
}

module.exports = BackfillAgent;
