const express = require('express');
const Book = require('../models/Book');
const router = express.Router();

// GET /api/genres — genre list with counts
router.get('/', async (req, res, next) => {
  try {
    const counts = await Book.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = counts.reduce((sum, g) => sum + g.count, 0);
    const genres = ['All', ...counts.map(g => g._id)];
    const countsMap = { All: total };
    counts.forEach(g => { countsMap[g._id] = g.count; });

    res.json({ genres, counts: countsMap });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
