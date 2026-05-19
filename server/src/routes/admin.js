const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const AgentRun = require('../models/AgentRun');
const Book = require('../models/Book');
const Author = require('../models/Author');
const AdminUser = require('../models/AdminUser');
const ScrapedBook = require('../models/ScrapedBook');
const VideoJob = require('../models/VideoJob');
const config = require('../config/env');
const { normalize } = require('../utils/dedup');
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

// ─── GET /api/admin/youtube/callback (PUBLIC — Google redirects here) ──────────
router.get('/youtube/callback', async (req, res) => {
  const { code, error } = req.query;

  const page = (ok, msg) => res.send(`<!DOCTYPE html><html>
<head><title>YouTube ${ok ? 'Connected' : 'Error'}</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#111;color:#eee">
<script>
if(window.opener){window.opener.postMessage(${JSON.stringify(ok ? 'youtube-connected' : `youtube-error:${msg}`)},\'*\');window.close();}
else{document.body.innerHTML='<h2 style="color:${ok ? '#10B981' : '#EF4444'}">${ok ? 'Connected! You can close this tab.' : 'Error: ' + msg}</h2>';}
</script>
</body></html>`);

  if (error) return page(false, error);
  if (!code) return page(false, 'no_code');

  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    return page(false, 'YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET not set');
  }

  const { google } = require('googleapis');
  const AppSetting = require('../models/AppSetting');
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI
    || `${req.protocol}://${req.get('host')}/api/admin/youtube/callback`;

  const oauth2 = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri,
  );

  try {
    const { tokens } = await oauth2.getToken(code.trim());
    if (!tokens.refresh_token) {
      return page(false, 'No refresh_token returned — revoke app access in Google and try again');
    }
    await AppSetting.findOneAndUpdate(
      { key: 'youtube_refresh_token' },
      { $set: { value: tokens.refresh_token } },
      { upsert: true }
    );
    logger.info('[YouTube] Refresh token saved to database via OAuth callback');
    return page(true, 'connected');
  } catch (err) {
    logger.error(`[YouTube] OAuth callback failed: ${err.message}`);
    return page(false, err.message.slice(0, 120));
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

// ─── POST /api/admin/trigger-backfill ───────────────────────────
router.post('/trigger-backfill', async (req, res, next) => {
  try {
    const backfillAgent = req.app.get('backfillAgent');
    if (!backfillAgent) {
      return res.status(503).json({ error: 'Backfill agent not initialized' });
    }
    if (backfillAgent.running) {
      return res.status(409).json({ error: 'Backfill already running' });
    }
    // Fire and don't await — let it run in the background
    backfillAgent.run().catch(err => logger.error(`Manual backfill error: ${err.message}`));
    res.json({ status: 'started', message: 'Backfill agent triggered — check /api/admin/runs for progress' });
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

    const videoSchedule = [
      { label: 'Morning video', hour: 9,  minute: 0 },
      { label: 'Evening video', hour: 21, minute: 0 },
    ].map(s => {
      const next = new Date(nowUTC);
      next.setUTCHours(s.hour, s.minute, 0, 0);
      if (next <= nowUTC) next.setUTCDate(next.getUTCDate() + 1);
      return { ...s, nextRun: next.toISOString() };
    });

    res.json({
      health: dbConnected ? 'healthy' : 'degraded',
      uptime: Math.floor(process.uptime()),
      database: { connected: dbConnected, ping: dbPing },
      config: {
        llmProvider: config.openrouterKey ? 'openrouter' : 'openai',
        llmModel: config.openrouterKey ? config.openrouterModel : config.openaiModel,
        openaiModel: config.openaiModel,
        openrouterModel: config.openrouterModel,
        dailyBudget: config.openaiDailyBudget,
        adminKeyConfigured: !!config.adminApiKey,
        googleBooksConfigured: !!config.googleBooksKey,
        openaiConfigured: !!config.openaiKey,
        openrouterConfigured: !!config.openrouterKey,
        llmApiKeyConfigured: !!(config.openrouterKey || config.openaiKey),
        nodeEnv: config.nodeEnv,
      },
      schedule: scheduleWithNext,
      videoSchedule,
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

// ─── GET /api/admin/duplicates ─────────────────────────────────
// Finds potential duplicate books using normalized title+author matching
router.get('/duplicates', async (req, res, next) => {
  try {
    // Aggregate books by normalized title+author to find groups > 1
    const books = await Book.find({})
      .select('title author genre status rating editor isbn createdAt coverDesign coverImageUrl')
      .sort({ title: 1 })
      .lean();

    const groups = new Map();
    for (const book of books) {
      const norm = normalize(book.title, book.author);
      if (!norm.title || !norm.author) continue; // skip books that can't be normalized
      const key = `${norm.title}||${norm.author}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(book);
    }

    // Filter to only groups with 2+ books (duplicates)
    const duplicates = [];
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      duplicates.push({
        key,
        count: group.length,
        books: group,
      });
    }

    // Also check ScrapedBook duplicates against Book collection
    const scrapedDups = await ScrapedBook.aggregate([
      { $match: { status: 'scraped' } },
      { $group: {
        _id: { title: { $toLower: '$title' }, author: { $toLower: '$author' } },
        count: { $sum: 1 },
        sources: { $push: '$source' },
        ids: { $push: '$_id' },
      }},
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);

    res.json({
      bookDuplicates: duplicates,
      scrapedDuplicates: scrapedDups,
      totalBookDups: duplicates.reduce((sum, d) => sum + d.count - 1, 0),
      totalScrapedDups: scrapedDups.reduce((sum, d) => sum + d.count - 1, 0),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/duplicates/merge ─────────────────────────
// Merge duplicate books: keep the "best" one (published > review_complete > etc.), delete the rest
router.post('/duplicates/merge', async (req, res, next) => {
  try {
    const { keepId, removeIds } = req.body;
    if (!keepId || !Array.isArray(removeIds) || removeIds.length === 0) {
      return res.status(400).json({ error: 'keepId and removeIds[] are required' });
    }

    const keeper = await Book.findById(keepId);
    if (!keeper) return res.status(404).json({ error: 'Book to keep not found' });

    let removed = 0;
    for (const id of removeIds) {
      if (id === keepId) continue;
      const result = await Book.findByIdAndDelete(id);
      if (result) removed++;
    }

    res.json({ message: `Merged: kept "${keeper.title}", removed ${removed} duplicate(s)`, kept: keepId, removed });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/duplicates/dismiss ───────────────────────
// Dismiss scraped duplicates (mark as skipped)
router.post('/duplicates/dismiss', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids[] is required' });
    }

    const result = await ScrapedBook.updateMany(
      { _id: { $in: ids }, status: 'scraped' },
      { $set: { status: 'skipped' } }
    );

    res.json({ message: `Dismissed ${result.modifiedCount} scraped duplicate(s)`, dismissed: result.modifiedCount });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/search-external ────────────────────────────
// Search Google Books + Open Library for a specific book.
router.post('/search-external', async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const googleBooks = require('../services/googleBooks');
    const openLibrary = require('../services/openLibrary');
    const { isDuplicate } = require('../utils/dedup');

    const [googleRes, olRes] = await Promise.allSettled([
      googleBooks.search(query.trim(), 10),
      openLibrary.search(query.trim(), 5),
    ]);

    const results = [
      ...(googleRes.status === 'fulfilled' ? googleRes.value : []),
      ...(olRes.status === 'fulfilled' ? olRes.value : []),
    ];

    // Dedup by title+author across both sources
    const seen = new Set();
    const unique = results.filter(b => {
      const key = `${(b.title || '').toLowerCase()}|${(b.author || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Flag which ones already exist in the DB
    const withStatus = await Promise.all(unique.map(async (b) => {
      const check = await isDuplicate(b.title, b.author, b.isbn);
      return { ...b, alreadyImported: check.isDup, existingId: check.existingId };
    }));

    res.json({ results: withStatus });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/import-book ─────────────────────────────────
// Import a single book directly into the review queue and trigger backfill.
router.post('/import-book', async (req, res, next) => {
  try {
    const { title, author, year, genre, isbn, description, coverUrl, pages, sources } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: 'title and author are required' });
    }

    const { isDuplicate } = require('../utils/dedup');
    const { generateCoverDesign } = require('../services/coverResolver');

    const check = await isDuplicate(title, author, isbn);
    if (check.isDup) {
      return res.status(409).json({ error: 'Book already exists in the database', existingId: check.existingId });
    }

    const GENRE_EDITOR_MAP = {
      'Fiction': 'Mira Okafor', 'Sci-Fi': 'Dae Han', 'Nature': 'Dae Han',
      'History': 'Jules Park', 'Business': 'Jules Park',
      'Essays': 'Noor Saleh', 'Memoir': 'Noor Saleh',
    };
    const editor = GENRE_EDITOR_MAP[genre] || 'Mira Okafor';

    const book = await Book.create({
      title, author, year, genre, isbn, description, pages,
      coverImageUrl: coverUrl || null,
      coverDesign: generateCoverDesign(title, author),
      editor,
      status: 'metadata_complete',
      sources: {
        googleBooksId: sources?.googleBooksId || null,
        openLibraryKey: sources?.openLibraryKey || null,
        discoveredAt: new Date(),
      },
    });

    // Kick off backfill immediately so the review is generated ASAP
    const backfillAgent = req.app.get('backfillAgent');
    if (backfillAgent && !backfillAgent.running) {
      backfillAgent.run().catch(err => logger.error(`Import-triggered backfill: ${err.message}`));
    }

    res.json({ book, message: 'Book imported and queued for review generation' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Book already exists' });
    }
    next(err);
  }
});

// ─── POST /api/admin/seed-authors ───────────────────────────────
// Aggregates unique authors from published books and upserts Author documents.
// Fast — no AI calls. Sets bioStatus:'pending' so Sofia can pick them up next.
router.post('/seed-authors', async (req, res, next) => {
  try {
    const groups = await Book.aggregate([
      { $match: { status: 'published' } },
      { $group: {
        _id: '$author',
        bookCount: { $sum: 1 },
        genres: { $addToSet: '$genre' },
      }},
      { $sort: { bookCount: -1 } },
    ]);

    let created = 0, updated = 0;

    for (const { _id: name, bookCount, genres } of groups) {
      if (!name) continue;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = await Author.findOne({ slug });

      await Author.findOneAndUpdate(
        { slug },
        {
          $set: {
            name,
            slug,
            bookCount,
            genres: [...new Set(genres.filter(Boolean))],
          },
          $setOnInsert: { bioStatus: 'pending' },
        },
        { upsert: true }
      );

      if (existing) updated++; else created++;
    }

    res.json({ created, updated, total: created + updated });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/author-stats ────────────────────────────────
router.get('/author-stats', async (req, res, next) => {
  try {
    const [total, generated, pending, failed] = await Promise.all([
      Author.countDocuments(),
      Author.countDocuments({ bioStatus: 'generated' }),
      Author.countDocuments({ bioStatus: 'pending' }),
      Author.countDocuments({ bioStatus: 'failed' }),
    ]);
    res.json({ total, generated, pending, failed });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/authors ──────────────────────────────────────
router.get('/authors', async (req, res, next) => {
  try {
    const { page = 1, limit = 30, bioStatus, q } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {};
    if (bioStatus) filter.bioStatus = bioStatus;
    if (q) filter.$text = { $search: q };

    const [authors, total] = await Promise.all([
      Author.find(filter).sort({ bookCount: -1, name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      Author.countDocuments(filter),
    ]);
    res.json({ authors, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// ─── POST /api/admin/authors/:id/regenerate-bio ──────────────────
router.post('/authors/:id/regenerate-bio', async (req, res, next) => {
  try {
    await Author.findByIdAndUpdate(req.params.id, { bioStatus: 'pending' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── YOUTUBE OAUTH ──────────────────────────────────────────────

// GET /api/admin/youtube/status
router.get('/youtube/status', async (req, res, next) => {
  try {
    const AppSetting = require('../models/AppSetting');
    const dbSetting = await AppSetting.findOne({ key: 'youtube_refresh_token' });
    const fromEnv = !!process.env.YOUTUBE_REFRESH_TOKEN;
    const fromDb  = !!dbSetting?.value;
    const connected = fromEnv || fromDb;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI
      || `${req.protocol}://${req.get('host')}/api/admin/youtube/callback`;

    let channelName = null;
    let channelId   = null;
    if (connected) {
      try {
        const { getClient } = require('../services/youtube');
        const { google } = require('googleapis');
        const auth = await getClient();
        const yt   = google.youtube({ version: 'v3', auth });
        const ch   = await yt.channels.list({ part: ['snippet'], mine: true });
        const item = ch.data.items?.[0];
        channelName = item?.snippet?.title || null;
        channelId   = item?.id || null;
      } catch (_) {}
    }

    res.json({
      connected,
      source:          fromEnv ? 'env' : fromDb ? 'database' : null,
      clientConfigured: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
      redirectUri,
      channelName,
      channelId,
    });
  } catch (err) { next(err); }
});

// GET /api/admin/youtube/auth-url — returns the Google OAuth URL for the popup
router.get('/youtube/auth-url', async (req, res, next) => {
  try {
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
      return res.status(400).json({ error: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your environment first' });
    }
    const { google } = require('googleapis');
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI
      || `${req.protocol}://${req.get('host')}/api/admin/youtube/callback`;
    const oauth2 = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      redirectUri,
    );
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
      prompt: 'consent',
    });
    res.json({ authUrl, redirectUri });
  } catch (err) { next(err); }
});

// DELETE /api/admin/youtube/disconnect — removes stored token
router.delete('/youtube/disconnect', async (req, res, next) => {
  try {
    const AppSetting = require('../models/AppSetting');
    await AppSetting.deleteOne({ key: 'youtube_refresh_token' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── VIDEO JOBS ─────────────────────────────────────────────────

// GET /api/admin/videos — list video jobs with pagination
router.get('/videos', requireAdmin, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const status = req.query.status || null;

    const filter = status ? { status } : {};
    const [jobs, total] = await Promise.all([
      VideoJob.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('bookId', 'title author genre rating')
        .lean(),
      VideoJob.countDocuments(filter),
    ]);

    res.json({ jobs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/admin/video-stats — summary counts
router.get('/video-stats', requireAdmin, async (req, res, next) => {
  try {
    const counts = await VideoJob.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const stats = { total: 0, queued: 0, scripting: 0, tts: 0, rendering: 0, done: 0, failed: 0 };
    for (const { _id, count } of counts) {
      stats[_id] = count;
      stats.total += count;
    }
    res.json(stats);
  } catch (err) { next(err); }
});

// POST /api/admin/videos/generate — trigger video for a specific book
router.post('/videos/generate', requireAdmin, async (req, res, next) => {
  try {
    const { bookId } = req.body;
    if (!bookId) return res.status(400).json({ error: 'bookId required' });

    // Start async — don't await (rendering takes minutes)
    const VideoAgent = require('../agents/VideoAgent');
    const agent = new VideoAgent();
    agent.generateForBook(bookId).catch(err => {
      logger.error(`[admin] Video generation failed for ${bookId}: ${err.message}`);
    });

    res.json({ ok: true, message: 'Video generation started', bookId });
  } catch (err) { next(err); }
});

// POST /api/admin/videos/batch — generate next N videos
router.post('/videos/batch', requireAdmin, async (req, res, next) => {
  try {
    const batchSize = Math.min(20, parseInt(req.body.batchSize) || 3);

    const VideoAgent = require('../agents/VideoAgent');
    const agent = new VideoAgent();
    agent.runBatch(batchSize).catch(err => {
      logger.error(`[admin] Video batch failed: ${err.message}`);
    });

    res.json({ ok: true, message: `Batch of ${batchSize} videos started` });
  } catch (err) { next(err); }
});

// POST /api/admin/videos/:id/retry — reset a failed/stuck job and re-run it
router.post('/videos/:id/retry', requireAdmin, async (req, res, next) => {
  try {
    const job = await VideoJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const VideoAgent = require('../agents/VideoAgent');
    const agent = new VideoAgent();
    agent.generateForBook(job.bookId).catch(err => {
      logger.error(`[admin] Video retry failed for job ${job._id}: ${err.message}`);
    });

    res.json({ ok: true, message: 'Retry started' });
  } catch (err) { next(err); }
});

// POST /api/admin/videos/:id/upload-youtube — upload an existing local video to YouTube
router.post('/videos/:id/upload-youtube', requireAdmin, async (req, res, next) => {
  try {
    const fs = require('fs');
    const job = await VideoJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'done') return res.status(400).json({ error: 'Job is not done' });
    if (job.youtubeVideoId) return res.status(400).json({ error: 'Already uploaded to YouTube' });
    if (!job.videoPath || !fs.existsSync(job.videoPath)) {
      return res.status(400).json({ error: 'Local video file not found' });
    }

    const { uploadVideo, isConfigured } = require('../services/youtube');
    if (!(await isConfigured())) {
      return res.status(400).json({ error: 'YouTube not connected' });
    }

    const Book = require('../models/Book');
    const book = await Book.findById(job.bookId).lean();
    const tags = [book?.genre, 'book review', 'book summary', book?.title, book?.author,
      'reviewerinsight', '#BookTok', '#BookReview'].filter(Boolean);

    // Fire async — upload can take a while
    uploadVideo({
      filePath:      job.videoPath,
      title:         job.script?.title || `${book?.title} — Book Review`,
      description:   job.script?.description || 'Full review at reviewerinsight.com',
      tags,
      privacyStatus: process.env.YOUTUBE_PRIVACY || 'public',
    }).then(async ({ videoId, videoUrl }) => {
      await VideoJob.findByIdAndUpdate(job._id, {
        youtubeVideoId: videoId,
        videoUrl,
        videoPath: null,
        audioPath: null,
      });
      try { fs.unlinkSync(job.videoPath); } catch {}
      if (job.audioPath) try { fs.unlinkSync(job.audioPath); } catch {}
      logger.info(`[admin] Manual YouTube upload done → ${videoUrl}`);
    }).catch(err => {
      logger.error(`[admin] Manual YouTube upload failed: ${err.message}`);
    });

    res.json({ ok: true, message: 'Upload started — check back in a minute' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/videos/:id — delete a video job (and its files)
router.delete('/videos/:id', requireAdmin, async (req, res, next) => {
  try {
    const job = await VideoJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const fs = require('fs');
    for (const filePath of [job.audioPath, job.videoPath].filter(Boolean)) {
      try { fs.unlinkSync(filePath); } catch {}
    }

    await job.deleteOne();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.seedInitialAdmin = seedInitialAdmin;
module.exports = router;
