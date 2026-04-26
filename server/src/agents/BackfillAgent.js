const cron = require('node-cron');
const Book = require('../models/Book');
const AgentRun = require('../models/AgentRun');
const { generateReview, generateChapterSummary } = require('../services/openaiReview');
const EditorAgent = require('./EditorAgent');
const config = require('../config/env');
const logger = require('../utils/logger');

const REVIEW_CONCURRENCY = 3;
const CHAPTER_CONCURRENCY = 2;
const REVIEW_BATCH = 25;   // per run — paced to protect daily budget
const CHAPTER_BATCH = 10;  // per run
const DEFAULT_PERSONA = 'Mira Okafor';

// Only retry failed books that have been in failed state for at least this long.
// Prevents burning tokens on books that fail every single tick.
const FAILED_RETRY_AFTER_HOURS = 6;

class BackfillAgent {
  constructor() {
    this.running = false;
    this.job = null;
  }

  /**
   * Start the backfill schedule — runs once per hour.
   * Also fires once 15s after server startup to catch immediate backlog.
   */
  startSchedule() {
    this.job = cron.schedule('0 * * * *', async () => {
      await this.run();
    }, { timezone: 'UTC' });

    setTimeout(() => this.run(), 15000);

    logger.info(`BackfillAgent started — hourly, ${REVIEW_BATCH} reviews + ${CHAPTER_BATCH} chapters per tick`);
  }

  async run() {
    if (this.running) {
      logger.info('BackfillAgent: previous run still active, skipping tick');
      return;
    }

    // ── Budget gate: skip if today's spend is ≥90% of the daily limit ───────
    const { overBudget, todayCost, budget } = await this._todaySpend();
    if (overBudget) {
      logger.warn(`BackfillAgent: daily budget nearly exhausted ($${todayCost.toFixed(2)} / $${budget}) — skipping tick`);
      return;
    }

    this.running = true;
    const run = await AgentRun.create({ editor: 'Backfill', status: 'running' });

    try {
      // ── Phase 1: Reset failed books — but only ones stuck for 6+ hours ──────
      const retryThreshold = new Date(Date.now() - FAILED_RETRY_AFTER_HOURS * 60 * 60 * 1000);
      const resetResult = await Book.updateMany(
        { status: 'failed', updatedAt: { $lte: retryThreshold } },
        { $set: { status: 'metadata_complete', errorLog: '' } }
      );
      if (resetResult.modifiedCount > 0) {
        logger.info(`BackfillAgent: reset ${resetResult.modifiedCount} failed books → metadata_complete (failed 6h+ ago)`);
      }

      // ── Phase 2: Generate missing reviews ────────────────────────────────────
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

      // ── Phase 3: Generate missing chapter summaries ───────────────────────────
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
          `chapters: ${run.chaptersGenerated || 0}, failed: ${run.booksFailed}, ` +
          `cost: $${run.estimatedCost.toFixed(4)}`
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

  async _todaySpend() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const runs = await AgentRun.find({ startedAt: { $gte: todayStart } }).select('estimatedCost').lean();
    const todayCost = runs.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);
    const budget = config.openaiDailyBudget;
    return { overBudget: todayCost >= budget * 0.9, todayCost, budget };
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
