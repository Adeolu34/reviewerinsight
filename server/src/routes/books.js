const express = require('express');
const Book = require('../models/Book');
const router = express.Router();

// GET /api/books — paginated, filterable
router.get('/', async (req, res, next) => {
  try {
    const { genre, editor, sort = 'newest', page = 1, limit = 30, featured } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = { status: 'published' };
    if (genre && genre !== 'All') filter.genre = genre;
    if (editor) filter.editor = editor;
    if (featured === 'true') filter.featured = true;

    let sortObj = {};
    if (sort === 'newest') sortObj = { year: -1, createdAt: -1 };
    else if (sort === 'rating') sortObj = { rating: -1 };
    else if (sort === 'alpha') sortObj = { title: 1 };
    else sortObj = { createdAt: -1 };

    const [books, total] = await Promise.all([
      Book.find(filter)
        .select('-review -description -errorLog -chapterSummaries')
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Book.countDocuments(filter),
    ]);

    res.json({
      books,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/books/featured — featured book + runner-ups
router.get('/featured', async (req, res, next) => {
  try {
    const featured = await Book.findOne({ featured: true, status: 'published' })
      .sort({ createdAt: -1 })
      .lean();

    const also = await Book.find({ featured: true, status: 'published', _id: { $ne: featured?._id } })
      .select('-review -description')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    res.json({ featured, also });
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id — full book with review
router.get('/:id', async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json(book);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
