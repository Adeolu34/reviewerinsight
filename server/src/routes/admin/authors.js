const express = require('express');
const { clampInt } = require('../../utils/pagination');
const Book = require('../../models/Book');
const Author = require('../../models/Author');
const router = express.Router();

// ─── POST /api/admin/seed-authors ───────────────────────────────
// Aggregates unique authors from published books and upserts Author documents.
// Fast — no AI calls. Sets bioStatus:'pending' so Sofia can pick them up next.
router.post('/seed-authors', async (req, res, next) => {
  try {
    const groups = await Book.aggregate([
      { $match: { status: 'published' } },
      { $group: {
        _id: '$author',
        bookCount: { $sum: 1 },
        genres: { $addToSet: '$genre' },
      }},
      { $sort: { bookCount: -1 } },
    ]);

    let created = 0, updated = 0;

    for (const { _id: name, bookCount, genres } of groups) {
      if (!name) continue;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = await Author.findOne({ slug });

      await Author.findOneAndUpdate(
        { slug },
        {
          $set: {
            name,
            slug,
            bookCount,
            genres: [...new Set(genres.filter(Boolean))],
          },
          $setOnInsert: { bioStatus: 'pending' },
        },
        { upsert: true }
      );

      if (existing) updated++; else created++;
    }

    res.json({ created, updated, total: created + updated });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/author-stats ────────────────────────────────
router.get('/author-stats', async (req, res, next) => {
  try {
    const [total, generated, pending, failed] = await Promise.all([
      Author.countDocuments(),
      Author.countDocuments({ bioStatus: 'generated' }),
      Author.countDocuments({ bioStatus: 'pending' }),
      Author.countDocuments({ bioStatus: 'failed' }),
    ]);
    res.json({ total, generated, pending, failed });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/authors ──────────────────────────────────────
router.get('/authors', async (req, res, next) => {
  try {
    const { page = 1, limit = 30, bioStatus, q } = req.query;
    const pageNum = clampInt(page, 1, 1, 100000);
    const limitNum = clampInt(limit, 30, 1, 100);
    const skip = (pageNum - 1) * limitNum;
    const filter = {};
    if (bioStatus) filter.bioStatus = bioStatus;
    if (q) filter.$text = { $search: q };

    const [authors, total] = await Promise.all([
      Author.find(filter).sort({ bookCount: -1, name: 1 }).skip(skip).limit(limitNum).lean(),
      Author.countDocuments(filter),
    ]);
    res.json({ authors, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) { next(err); }
});

// ─── POST /api/admin/authors/:id/regenerate-bio ──────────────────
router.post('/authors/:id/regenerate-bio', async (req, res, next) => {
  try {
    await Author.findByIdAndUpdate(req.params.id, { bioStatus: 'pending' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── YOUTUBE OAUTH ──────────────────────────────────────────────

module.exports = router;
