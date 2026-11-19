const express = require('express');
const Book = require('../../models/Book');
const ScrapedBook = require('../../models/ScrapedBook');
const { normalize } = require('../../utils/dedup');
const router = express.Router();

// ─── GET /api/admin/duplicates ─────────────────────────────────
// Finds potential duplicate books using normalized title+author matching
router.get('/duplicates', async (req, res, next) => {
  try {
    // Aggregate books by normalized title+author to find groups > 1
    const books = await Book.find({})
      .select('title author genre status rating editor isbn createdAt coverDesign coverImageUrl')
      .sort({ title: 1 })
      .lean();

    const groups = new Map();
    for (const book of books) {
      const norm = normalize(book.title, book.author);
      if (!norm.title || !norm.author) continue; // skip books that can't be normalized
      const key = `${norm.title}||${norm.author}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(book);
    }

    // Filter to only groups with 2+ books (duplicates)
    const duplicates = [];
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      duplicates.push({
        key,
        count: group.length,
        books: group,
      });
    }

    // Also check ScrapedBook duplicates against Book collection
    const scrapedDups = await ScrapedBook.aggregate([
      { $match: { status: 'scraped' } },
      { $group: {
        _id: { title: { $toLower: '$title' }, author: { $toLower: '$author' } },
        count: { $sum: 1 },
        sources: { $push: '$source' },
        ids: { $push: '$_id' },
      }},
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);

    res.json({
      bookDuplicates: duplicates,
      scrapedDuplicates: scrapedDups,
      totalBookDups: duplicates.reduce((sum, d) => sum + d.count - 1, 0),
      totalScrapedDups: scrapedDups.reduce((sum, d) => sum + d.count - 1, 0),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/duplicates/merge ─────────────────────────
// Merge duplicate books: keep the "best" one (published > review_complete > etc.), delete the rest
router.post('/duplicates/merge', async (req, res, next) => {
  try {
    const { keepId, removeIds } = req.body;
    if (!keepId || !Array.isArray(removeIds) || removeIds.length === 0) {
      return res.status(400).json({ error: 'keepId and removeIds[] are required' });
    }

    const keeper = await Book.findById(keepId);
    if (!keeper) return res.status(404).json({ error: 'Book to keep not found' });

    let removed = 0;
    for (const id of removeIds) {
      if (id === keepId) continue;
      const result = await Book.findByIdAndDelete(id);
      if (result) removed++;
    }

    res.json({ message: `Merged: kept "${keeper.title}", removed ${removed} duplicate(s)`, kept: keepId, removed });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/duplicates/dismiss ───────────────────────
// Dismiss scraped duplicates (mark as skipped)
router.post('/duplicates/dismiss', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids[] is required' });
    }

    const result = await ScrapedBook.updateMany(
      { _id: { $in: ids }, status: 'scraped' },
      { $set: { status: 'skipped' } }
    );

    res.json({ message: `Dismissed ${result.modifiedCount} scraped duplicate(s)`, dismissed: result.modifiedCount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
