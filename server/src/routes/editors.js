const express = require('express');
const Editor = require('../models/Editor');
const Book = require('../models/Book');
const router = express.Router();

// GET /api/editors
router.get('/', async (req, res, next) => {
  try {
    const editors = await Editor.find({ active: true }).lean();

    // Attach review counts
    const counts = await Book.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$editor', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id] = c.count; });

    const enriched = editors.map(e => ({
      ...e,
      reviewCount: countMap[e.name] || 0,
    }));

    res.json({ editors: enriched });
  } catch (err) {
    next(err);
  }
});

// GET /api/editors/:name/books
router.get('/:name/books', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = { editor: req.params.name, status: 'published' };
    const [books, total] = await Promise.all([
      Book.find(filter)
        .select('-review -description')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Book.countDocuments(filter),
    ]);

    res.json({ books, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
