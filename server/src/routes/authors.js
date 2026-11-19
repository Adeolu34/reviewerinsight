const express = require('express');
const { clampInt } = require('../utils/pagination');
const router = express.Router();
const Author = require('../models/Author');
const Book = require('../models/Book');

// GET /api/authors
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 30, genre, letter, sort = 'books', q } = req.query;
    const pageNum = clampInt(page, 1, 1, 100000);
    const limitNum = clampInt(limit, 30, 1, 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (genre) filter.genres = genre;
    // Single A-Z letter only (never build a RegExp from raw user input)
    if (typeof letter === 'string' && /^[A-Za-z]$/.test(letter)) filter.name = { $regex: `^${letter}`, $options: 'i' };
    if (q) filter.$text = { $search: q };

    const sortMap = {
      books:  { bookCount: -1, name: 1 },
      alpha:  { name: 1 },
      newest: { createdAt: -1 },
    };

    const [authors, total] = await Promise.all([
      Author.find(filter)
        .sort(sortMap[sort] || sortMap.books)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Author.countDocuments(filter),
    ]);

    res.json({ authors, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/authors/:slug
router.get('/:slug', async (req, res) => {
  try {
    const author = await Author.findOne({ slug: req.params.slug }).lean();
    if (!author) return res.status(404).json({ error: 'Author not found' });
    res.json(author);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/authors/:slug/books
router.get('/:slug/books', async (req, res) => {
  try {
    const author = await Author.findOne({ slug: req.params.slug }).select('name').lean();
    if (!author) return res.status(404).json({ error: 'Author not found' });

    const books = await Book.find({
      author: { $regex: new RegExp(`^${author.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      status: 'published',
    }).sort({ rating: -1, createdAt: -1 }).lean();

    res.json({ books, total: books.length });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
