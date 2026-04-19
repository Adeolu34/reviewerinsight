const express = require('express');
const AgentRun = require('../models/AgentRun');
const Book = require('../models/Book');
const router = express.Router();

// Simple API key auth middleware
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireAdmin);

// POST /api/admin/trigger-agent
router.post('/trigger-agent', async (req, res, next) => {
  try {
    const { editor, batchSize = 10 } = req.body;
    if (!editor) return res.status(400).json({ error: 'editor is required' });

    // The orchestrator will be attached to the app later
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

// GET /api/admin/runs
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

// GET /api/admin/runs/:id
router.get('/runs/:id', async (req, res, next) => {
  try {
    const run = await AgentRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/costs
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

module.exports = router;
