const express = require('express');
const ScrapedBook = require('../models/ScrapedBook');
const ScraperRun = require('../models/ScraperRun');
const Book = require('../models/Book');
const { generateCoverDesign } = require('../services/coverResolver');
const { runScraper, runAllScrapers, getAvailableSources } = require('../services/scrapers');
const requireAdmin = require('../middleware/requireAdmin');
const router = express.Router();

router.use(requireAdmin);

const VALID_GENRES = ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature'];

// ─── GET /api/admin/scraped-books ─────────────────────────────
router.get('/scraped-books', async (req, res, next) => {
  try {
    const { source, status, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = {};
    if (source) filter.source = source;
    if (status) filter.status = status;
    if (search && search.trim().length >= 2) {
      filter.$text = { $search: search.trim() };
    }

    const [books, total] = await Promise.all([
      search
        ? ScrapedBook.find(filter, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .skip((pageNum - 1) * limitNum).limit(limitNum).lean()
        : ScrapedBook.find(filter)
            .sort({ scrapedAt: -1 })
            .skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      ScrapedBook.countDocuments(filter),
    ]);

    const sourceStats = await ScrapedBook.aggregate([
      { $group: {
        _id: '$source',
        total: { $sum: 1 },
        scraped: { $sum: { $cond: [{ $eq: ['$status', 'scraped'] }, 1, 0] } },
        imported: { $sum: { $cond: [{ $eq: ['$status', 'imported'] }, 1, 0] } },
        skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
      }},
    ]);

    res.json({ books, total, page: pageNum, totalPages: Math.ceil(total / limitNum), sourceStats });
  } catch (err) { next(err); }
});

// ─── POST /api/admin/scraped-books/:id/import ────────────────
router.post('/scraped-books/:id/import', async (req, res, next) => {
  try {
    const { editor, genre: overrideGenre } = req.body;
    const scraped = await ScrapedBook.findById(req.params.id);
    if (!scraped) return res.status(404).json({ error: 'Scraped book not found' });
    if (scraped.status === 'imported') {
      return res.status(409).json({ error: 'Already imported', bookId: scraped.importedBookId });
    }

    const genre = overrideGenre || scraped.genre || 'Fiction';
    const finalGenre = VALID_GENRES.includes(genre) ? genre : 'Fiction';

    const book = await Book.create({
      title: scraped.title,
      author: scraped.author,
      year: scraped.year,
      genre: finalGenre,
      isbn: scraped.isbn,
      description: scraped.description || scraped.sourceReviewSnippet,
      coverImageUrl: scraped.coverImageUrl,
      coverDesign: generateCoverDesign(scraped.title, scraped.author),
      editor: editor || 'Mira Okafor',
      sources: { discoveredAt: new Date() },
      status: 'metadata_complete',
    });

    scraped.status = 'imported';
    scraped.importedBookId = book._id;
    scraped.importedAt = new Date();
    await scraped.save();

    res.json({ message: 'Book imported successfully', book: book.toObject() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Book already exists in main collection (duplicate title+author)' });
    }
    next(err);
  }
});

// ─── POST /api/admin/scraped-books/import-bulk ───────────────
router.post('/scraped-books/import-bulk', async (req, res, next) => {
  try {
    const { ids, editor, genre: overrideGenre } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (ids.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 books per bulk import' });
    }

    const results = { imported: 0, skipped: 0, failed: 0, errors: [] };

    for (const id of ids) {
      try {
        const scraped = await ScrapedBook.findById(id);
        if (!scraped || scraped.status === 'imported') {
          results.skipped++;
          continue;
        }

        const genre = overrideGenre || scraped.genre || 'Fiction';
        const finalGenre = VALID_GENRES.includes(genre) ? genre : 'Fiction';

        const book = await Book.create({
          title: scraped.title,
          author: scraped.author,
          year: scraped.year,
          genre: finalGenre,
          isbn: scraped.isbn,
          description: scraped.description || scraped.sourceReviewSnippet,
          coverImageUrl: scraped.coverImageUrl,
          coverDesign: generateCoverDesign(scraped.title, scraped.author),
          editor: editor || 'Mira Okafor',
          sources: { discoveredAt: new Date() },
          status: 'metadata_complete',
        });

        scraped.status = 'imported';
        scraped.importedBookId = book._id;
        scraped.importedAt = new Date();
        await scraped.save();
        results.imported++;
      } catch (err) {
        if (err.code === 11000) {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({ id, error: err.message });
        }
      }
    }

    res.json(results);
  } catch (err) { next(err); }
});

// ─── PATCH /api/admin/scraped-books/:id ──────────────────────
router.patch('/scraped-books/:id', async (req, res, next) => {
  try {
    const allowedFields = ['status', 'genre'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const book = await ScrapedBook.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    }).lean();
    if (!book) return res.status(404).json({ error: 'Scraped book not found' });
    res.json({ book });
  } catch (err) { next(err); }
});

// ─── DELETE /api/admin/scraped-books/:id ─────────────────────
router.delete('/scraped-books/:id', async (req, res, next) => {
  try {
    const result = await ScrapedBook.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Scraped book not found' });
    res.json({ message: 'Deleted', deletedId: req.params.id });
  } catch (err) { next(err); }
});

// ─── POST /api/admin/scraper/run ─────────────────────────────
router.post('/scraper/run', async (req, res, next) => {
  try {
    const { source } = req.body;

    if (source) {
      const available = getAvailableSources();
      if (!available.includes(source)) {
        return res.status(400).json({ error: `Unknown source: ${source}. Available: ${available.join(', ')}` });
      }
      const runId = await runScraper(source, 'manual');
      res.json({ runId, source, status: 'completed' });
    } else {
      const results = await runAllScrapers('manual');
      res.json({ results, status: 'completed' });
    }
  } catch (err) { next(err); }
});

// ─── GET /api/admin/scraper/status ───────────────────────────
router.get('/scraper/status', async (req, res, next) => {
  try {
    const sources = getAvailableSources();

    const lastRuns = {};
    for (const source of sources) {
      lastRuns[source] = await ScraperRun.findOne({ source }).sort({ startedAt: -1 }).lean();
    }

    const running = await ScraperRun.find({ status: 'running' }).lean();

    const [totalScraped, totalImported, totalSkipped, totalPending] = await Promise.all([
      ScrapedBook.countDocuments(),
      ScrapedBook.countDocuments({ status: 'imported' }),
      ScrapedBook.countDocuments({ status: 'skipped' }),
      ScrapedBook.countDocuments({ status: 'scraped' }),
    ]);

    res.json({
      sources,
      lastRuns,
      running,
      stats: { totalScraped, totalImported, totalSkipped, totalPending },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/scraper/runs ─────────────────────────────
router.get('/scraper/runs', async (req, res, next) => {
  try {
    const { source, status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = {};
    if (source) filter.source = source;
    if (status) filter.status = status;

    const [runs, total] = await Promise.all([
      ScraperRun.find(filter).sort({ startedAt: -1 })
        .skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      ScraperRun.countDocuments(filter),
    ]);

    res.json({ runs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) { next(err); }
});

module.exports = router;
