const express = require('express');
const { clampInt } = require('../utils/pagination');
const Book = require('../models/Book');
const router = express.Router();

// GET /api/search?q=...
router.get('/', async (req, res, next) => {
  try {
    const { q, genre, editor, page = 1, limit = 30 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const pageNum = clampInt(page, 1, 1, 100000);
    const limitNum = clampInt(limit, 30, 1, 100);

    const filter = {
      status: 'published',
      $text: { $search: q.trim() },
    };
    if (genre && genre !== 'All') filter.genre = genre;
    if (editor) filter.editor = editor;

    const [books, total] = await Promise.all([
      Book.find(filter, { score: { $meta: 'textScore' } })
        .select('-review -description')
        .sort({ score: { $meta: 'textScore' } })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Book.countDocuments(filter),
    ]);

    res.json({ books, total, page: pageNum, totalPages: Math.ceil(total / limitNum), query: q.trim() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
