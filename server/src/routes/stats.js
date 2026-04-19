const express = require('express');
const Book = require('../models/Book');
const router = express.Router();

// GET /api/stats — dynamic counters for the frontend
router.get('/', async (req, res, next) => {
  try {
    const [totalBooks, totalWithReviews, latestBook] = await Promise.all([
      Book.countDocuments({ status: 'published' }),
      Book.countDocuments({ status: 'published', 'review.headline': { $exists: true, $ne: null } }),
      Book.findOne({ status: 'published' }).sort({ createdAt: -1 }).select('issue').lean(),
    ]);

    res.json({
      totalBooks,
      totalSummaries: totalWithReviews,
      totalIssues: 48, // Will be dynamic once issue tracker is built
      latestIssue: latestBook?.issue || 'No. 048',
      membersOnline: Math.floor(2000 + Math.random() * 800), // Placeholder
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
