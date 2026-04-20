const express = require('express');
const { fetchTrending } = require('../services/externalBooks');
const logger = require('../utils/logger');
const router = express.Router();

// GET /api/books/trending — public endpoint, cached externally sourced popular books
router.get('/trending', async (req, res, next) => {
  try {
    const trending = await fetchTrending();
    res.json({
      trending,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[Trending] Failed: ${err.message}`);
    res.json({ trending: [], updatedAt: new Date().toISOString() });
  }
});

module.exports = router;
