const express = require('express');
const { clampInt } = require('../../utils/pagination');
const Book = require('../../models/Book');
const router = express.Router();

// ─── GET /api/admin/books ───────────────────────────────────────
router.get('/books', async (req, res, next) => {
  try {
    const { status, genre, editor, search, page = 1, limit = 50 } = req.query;
    const pageNum = clampInt(page, 1, 1, 100000);
    const limitNum = clampInt(limit, 30, 1, 100);

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

module.exports = router;
