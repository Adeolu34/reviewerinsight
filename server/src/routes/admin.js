const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const AgentRun = require('../models/AgentRun');
const Book = require('../models/Book');
const AdminUser = require('../models/AdminUser');
const config = require('../config/env');
const logger = require('../utils/logger');
const requireAdmin = require('../middleware/requireAdmin');
const router = express.Router();

/** Run once after MongoDB is connected. Creates first admin from env when collection is empty. */
async function seedInitialAdmin() {
  try {
    const count = await AdminUser.countDocuments();
    if (count > 0) return;

    const email = (process.env.ADMIN_INITIAL_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!email || !password) {
      logger.warn(
        '[Admin] No admin users in DB. Set ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD (e.g. in Coolify env) to create the first account on startup.'
      );
      return;
    }

    await AdminUser.create({
      email,
      password,
      name: (process.env.ADMIN_INITIAL_NAME || 'Admin').trim() || 'Admin',
    });
    logger.info(`[Admin] Seeded initial admin account: ${email}`);
  } catch (err) {
    logger.error('[Admin] Failed to seed admin account:', err.message);
  }
}

// ─── POST /api/admin/login (public — no auth required) ─────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.use(requireAdmin);

// ─── POST /api/admin/trigger-agent ──────────────────────────────
router.post('/trigger-agent', async (req, res, next) => {
  try {
    const { editor, batchSize = 10 } = req.body;
    if (!editor) return res.status(400).json({ error: 'editor is required' });

    const orchestrator = req.app.get('orchestrator');
    if (!orchestrator) {
      return res.status(503).json({ error: 'Agent orchestrator not initialized' });
    }

    const runId = await orchestrator.runAgent(editor, { batchSize });
    res.json({ runId, status: 'started' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/runs ────────────────────────────────────────
router.get('/runs', async (req, res, next) => {
  try {
    const { editor, status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = {};
    if (editor) filter.editor = editor;
    if (status) filter.status = status;

    const [runs, total] = await Promise.all([
      AgentRun.find(filter).sort({ startedAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      AgentRun.countDocuments(filter),
    ]);

    res.json({ runs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/runs/:id ────────────────────────────────────
router.get('/runs/:id', async (req, res, next) => {
  try {
    const run = await AgentRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/costs ───────────────────────────────────────
router.get('/costs', async (req, res, next) => {
  try {
    const { since } = req.query;
    const filter = {};
    if (since) filter.startedAt = { $gte: new Date(since) };

    const runs = await AgentRun.find(filter).lean();
    const totalTokens = runs.reduce((s, r) => s + (r.tokensUsed || 0), 0);
    const estimatedCost = runs.reduce((s, r) => s + (r.estimatedCost || 0), 0);

    const byEditor = {};
    runs.forEach(r => {
      if (!byEditor[r.editor]) byEditor[r.editor] = { tokens: 0, cost: 0, runs: 0 };
      byEditor[r.editor].tokens += r.tokensUsed || 0;
      byEditor[r.editor].cost += r.estimatedCost || 0;
      byEditor[r.editor].runs += 1;
    });

    res.json({ totalTokens, estimatedCost: Math.round(estimatedCost * 100) / 100, byEditor });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/overview ────────────────────────────────────
router.get('/overview', async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);

    // Parallel queries for speed
    const [
      statusCounts,
      totalChapters,
      todayBooks,
      lastRun,
      runningNow,
      todayCost,
      weekCost,
      monthCost,
      recentErrorRuns,
    ] = await Promise.all([
      Book.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Book.aggregate([
        { $match: { chapterSummaries: { $exists: true, $ne: [] } } },
        { $project: { count: { $size: '$chapterSummaries' } } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]),
      Book.countDocuments({ createdAt: { $gte: todayStart } }),
      AgentRun.findOne().sort({ startedAt: -1 }).lean(),
      AgentRun.findOne({ status: 'running' }).sort({ startedAt: -1 }).lean(),
      AgentRun.aggregate([
        { $match: { startedAt: { $gte: todayStart } } },
        { $group: { _id: null, cost: { $sum: '$estimatedCost' } } },
      ]),
      AgentRun.aggregate([
        { $match: { startedAt: { $gte: weekStart } } },
        { $group: { _id: null, cost: { $sum: '$estimatedCost' } } },
      ]),
      AgentRun.aggregate([
        { $match: { startedAt: { $gte: monthStart } } },
        { $group: { _id: null, cost: { $sum: '$estimatedCost' } } },
      ]),
      AgentRun.find({ 'errors.0': { $exists: true } }).sort({ startedAt: -1 }).limit(5).lean(),
    ]);

    // Build status breakdown
    const statusBreakdown = {};
    let totalBooks = 0;
    statusCounts.forEach(s => {
      statusBreakdown[s._id] = s.count;
      totalBooks += s.count;
    });

    const publishedBooks = statusBreakdown.published || 0;
    const pendingReviews = (statusBreakdown.metadata_complete || 0) + (statusBreakdown.review_pending || 0);
    const failedBooks = statusBreakdown.failed || 0;

    // Today's reviewed = books published today
    const todayReviewed = await Book.countDocuments({
      status: 'published',
      'sources.reviewGeneratedAt': { $gte: todayStart },
    });

    // Flatten recent errors from runs
    const recentErrors = [];
    for (const run of recentErrorRuns) {
      for (const err of (run.errors || [])) {
        recentErrors.push({
          bookTitle: err.bookTitle,
          error: err.error,
          timestamp: err.timestamp,
          editor: run.editor,
          runId: run._id,
        });
      }
    }
    recentErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Next scheduled run (from orchestrator schedule config)
    const schedule = [
      { editor: 'Mira Okafor', hour: 2, minute: 0 },
      { editor: 'Jules Park', hour: 2, minute: 30 },
      { editor: 'Dae Han', hour: 3, minute: 0 },
      { editor: 'Noor Saleh', hour: 3, minute: 30 },
    ];
    const nowUTC = new Date();
    let nextScheduled = null;
    for (const s of schedule) {
      const next = new Date(nowUTC);
      next.setUTCHours(s.hour, s.minute, 0, 0);
      if (next <= nowUTC) next.setUTCDate(next.getUTCDate() + 1);
      if (!nextScheduled || next < new Date(nextScheduled.scheduledFor)) {
        nextScheduled = { editor: s.editor, scheduledFor: next.toISOString() };
      }
    }

    res.json({
      metrics: {
        totalBooks,
        publishedBooks,
        pendingReviews,
        failedBooks,
        totalChapters: totalChapters[0]?.total || 0,
        todayDiscovered: todayBooks,
        todayReviewed,
      },
      agentStatus: {
        lastRun: lastRun ? { editor: lastRun.editor, completedAt: lastRun.completedAt, status: lastRun.status, booksReviewed: lastRun.booksReviewed } : null,
        currentlyRunning: runningNow ? { editor: runningNow.editor, startedAt: runningNow.startedAt } : null,
        nextScheduled,
      },
      costSummary: {
        today: Math.round((todayCost[0]?.cost || 0) * 100) / 100,
        thisWeek: Math.round((weekCost[0]?.cost || 0) * 100) / 100,
        thisMonth: Math.round((monthCost[0]?.cost || 0) * 100) / 100,
        budget: config.openaiDailyBudget,
      },
      recentErrors: recentErrors.slice(0, 10),
      statusBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/books ───────────────────────────────────────
router.get('/books', async (req, res, next) => {
  try {
    const { status, genre, editor, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = {};
    if (status) filter.status = status;
    if (genre && genre !== 'All') filter.genre = genre;
    if (editor) filter.editor = editor;
    if (search && search.trim().length >= 2) {
      filter.$text = { $search: search.trim() };
    }

    const projection = '-review -description -chapterSummaries';

    const [books, total] = await Promise.all([
      search
        ? Book.find(filter, { score: { $meta: 'textScore' } }).select(projection).sort({ score: { $meta: 'textScore' } }).skip((pageNum - 1) * limitNum).limit(limitNum).lean()
        : Book.find(filter).select(projection).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Book.countDocuments(filter),
    ]);

    res.json({ books, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/books/:id ─────────────────────────────────
router.patch('/books/:id', async (req, res, next) => {
  try {
    const allowedFields = ['featured', 'status', 'rating', 'editor', 'genre'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const book = await Book.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });

    res.json({ book });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/books/:id ────────────────────────────────
router.delete('/books/:id', async (req, res, next) => {
  try {
    const hard = req.query.hard === 'true';

    if (hard) {
      const result = await Book.findByIdAndDelete(req.params.id);
      if (!result) return res.status(404).json({ error: 'Book not found' });
      return res.json({ message: 'Book permanently deleted', deletedId: req.params.id });
    }

    const book = await Book.findByIdAndUpdate(req.params.id, {
      status: 'failed',
      errorLog: 'Manually removed by admin',
    }, { new: true }).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });

    res.json({ message: 'Book soft-deleted', book });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/analytics ───────────────────────────────────
router.get('/analytics', async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;

    let since;
    const now = new Date();
    if (period === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (period === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30d') since = new Date(now - 30 * 24 * 60 * 60 * 1000);
    else since = new Date(0); // all time

    const filter = { startedAt: { $gte: since } };

    const runs = await AgentRun.find(filter).sort({ startedAt: 1 }).lean();

    const runStats = { total: runs.length, completed: 0, failed: 0, partial: 0 };
    const bookStats = { discovered: 0, reviewed: 0, failed: 0 };
    let totalCost = 0;
    const byEditor = {};
    const errorMap = {};

    for (const r of runs) {
      if (r.status === 'completed') runStats.completed++;
      else if (r.status === 'failed') runStats.failed++;
      else if (r.status === 'partial') runStats.partial++;

      bookStats.discovered += r.booksDiscovered || 0;
      bookStats.reviewed += r.booksReviewed || 0;
      bookStats.failed += r.booksFailed || 0;
      totalCost += r.estimatedCost || 0;

      if (!byEditor[r.editor]) byEditor[r.editor] = { runs: 0, cost: 0, tokens: 0 };
      byEditor[r.editor].runs++;
      byEditor[r.editor].cost += r.estimatedCost || 0;
      byEditor[r.editor].tokens += r.tokensUsed || 0;

      for (const err of (r.errors || [])) {
        const key = err.error?.substring(0, 80) || 'Unknown error';
        errorMap[key] = (errorMap[key] || 0) + 1;
      }
    }

    // Round costs
    totalCost = Math.round(totalCost * 100) / 100;
    for (const ed of Object.values(byEditor)) {
      ed.cost = Math.round(ed.cost * 100) / 100;
    }

    // Daily breakdown
    const dailyMap = {};
    for (const r of runs) {
      const day = r.startedAt.toISOString().split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, cost: 0, runs: 0, booksReviewed: 0 };
      dailyMap[day].cost += r.estimatedCost || 0;
      dailyMap[day].runs++;
      dailyMap[day].booksReviewed += r.booksReviewed || 0;
    }
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    dailyBreakdown.forEach(d => { d.cost = Math.round(d.cost * 100) / 100; });

    // Top errors
    const topErrors = Object.entries(errorMap)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      period,
      runs: runStats,
      books: bookStats,
      costs: { total: totalCost, byEditor, dailyBreakdown },
      topErrors,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/editors/stats ───────────────────────────────
router.get('/editors/stats', async (req, res, next) => {
  try {
    const editorNames = ['Mira Okafor', 'Jules Park', 'Dae Han', 'Noor Saleh'];
    const editors = [];

    for (const name of editorNames) {
      const [runs, avgRatingResult, lastRun] = await Promise.all([
        AgentRun.find({ editor: name }).lean(),
        Book.aggregate([
          { $match: { editor: name, status: 'published', rating: { $exists: true } } },
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
        AgentRun.findOne({ editor: name }).sort({ startedAt: -1 }).lean(),
      ]);

      const totalRuns = runs.length;
      const successfulRuns = runs.filter(r => r.status === 'completed').length;
      const failedRuns = runs.filter(r => r.status === 'failed').length;
      const totalBooksReviewed = runs.reduce((s, r) => s + (r.booksReviewed || 0), 0);
      const totalCost = runs.reduce((s, r) => s + (r.estimatedCost || 0), 0);

      editors.push({
        name,
        totalRuns,
        successfulRuns,
        failedRuns,
        totalBooksReviewed,
        publishedBooks: avgRatingResult[0]?.count || 0,
        avgRating: Math.round((avgRatingResult[0]?.avg || 0) * 10) / 10,
        totalCost: Math.round(totalCost * 100) / 100,
        avgCostPerRun: totalRuns > 0 ? Math.round((totalCost / totalRuns) * 100) / 100 : 0,
        successRate: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100 * 10) / 10 : 0,
        lastRun: lastRun ? {
          startedAt: lastRun.startedAt,
          status: lastRun.status,
          booksReviewed: lastRun.booksReviewed,
          booksDiscovered: lastRun.booksDiscovered,
        } : null,
      });
    }

    res.json({ editors });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/books/:id/retry ────────────────────────────
router.post('/books/:id/retry', async (req, res, next) => {
  try {
    const { step = 'review' } = req.body;
    const statusMap = {
      metadata: 'discovered',
      review: 'metadata_complete',
      chapters: 'review_complete',
    };

    const newStatus = statusMap[step];
    if (!newStatus) {
      return res.status(400).json({ error: `Invalid step: ${step}. Must be metadata, review, or chapters.` });
    }

    const book = await Book.findByIdAndUpdate(req.params.id, {
      status: newStatus,
      errorLog: '',
    }, { new: true }).lean();

    if (!book) return res.status(404).json({ error: 'Book not found' });

    res.json({ message: `Book queued for retry at step: ${step}`, book });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/system ──────────────────────────────────────
router.get('/system', async (req, res, next) => {
  try {
    // Database health
    let dbPing = -1;
    const dbConnected = mongoose.connection.readyState === 1;
    if (dbConnected) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      dbPing = Date.now() - start;
    }

    // Memory
    const mem = process.memoryUsage();
    const totalMem = require('os').totalmem();

    // Schedule config
    const schedule = [
      { editor: 'Mira Okafor', cron: '0 2 * * *', batchSize: 8 },
      { editor: 'Jules Park', cron: '30 2 * * *', batchSize: 8 },
      { editor: 'Dae Han', cron: '0 3 * * *', batchSize: 7 },
      { editor: 'Noor Saleh', cron: '30 3 * * *', batchSize: 7 },
    ];

    // Calculate next run times
    const nowUTC = new Date();
    const scheduleWithNext = schedule.map(s => {
      const [minute, hour] = s.cron.split(' ');
      const next = new Date(nowUTC);
      next.setUTCHours(parseInt(hour), parseInt(minute), 0, 0);
      if (next <= nowUTC) next.setUTCDate(next.getUTCDate() + 1);
      return { ...s, nextRun: next.toISOString() };
    });

    res.json({
      health: dbConnected ? 'healthy' : 'degraded',
      uptime: Math.floor(process.uptime()),
      database: { connected: dbConnected, ping: dbPing },
      config: {
        openaiModel: config.openaiModel,
        dailyBudget: config.openaiDailyBudget,
        adminKeyConfigured: !!config.adminApiKey,
        googleBooksConfigured: !!config.googleBooksKey,
        openaiConfigured: !!config.openaiKey,
        nodeEnv: config.nodeEnv,
      },
      schedule: scheduleWithNext,
      memory: {
        used: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        total: Math.round(totalMem / 1024 / 1024),
        percent: Math.round((mem.rss / totalMem) * 1000) / 10,
      },
      process: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.seedInitialAdmin = seedInitialAdmin;
module.exports = router;
