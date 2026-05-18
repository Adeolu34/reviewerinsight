const express = require('express');
const router = express.Router();
const Author = require('../models/Author');
const Book = require('../models/Book');

// GET /api/authors
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 30, genre, letter, sort = 'books', q } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (genre) filter.genres = genre;
    if (letter) filter.name = { $regex: new RegExp(`^${letter}`, 'i') };
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
        .limit(parseInt(limit))
        .lean(),
      Author.countDocuments(filter),
    ]);

    res.json({ authors, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/authors/:slug
router.get('/:slug', async (req, res) => {
  try {
    const author = await Author.findOne({ slug: req.params.slug }).lean();
    if (!author) return res.status(404).json({ error: 'Author not found' });
    res.json(author);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
