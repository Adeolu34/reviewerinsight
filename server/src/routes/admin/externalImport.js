const express = require('express');
const Book = require('../../models/Book');
const logger = require('../../utils/logger');
const router = express.Router();

// ─── POST /api/admin/search-external ────────────────────────────
// Search Google Books + Open Library for a specific book.
router.post('/search-external', async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const googleBooks = require('../../services/googleBooks');
    const openLibrary = require('../../services/openLibrary');
    const { isDuplicate } = require('../../utils/dedup');

    const [googleRes, olRes] = await Promise.allSettled([
      googleBooks.search(query.trim(), 10),
      openLibrary.search(query.trim(), 5),
    ]);

    const results = [
      ...(googleRes.status === 'fulfilled' ? googleRes.value : []),
      ...(olRes.status === 'fulfilled' ? olRes.value : []),
    ];

    // Dedup by title+author across both sources
    const seen = new Set();
    const unique = results.filter(b => {
      const key = `${(b.title || '').toLowerCase()}|${(b.author || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Flag which ones already exist in the DB
    const withStatus = await Promise.all(unique.map(async (b) => {
      const check = await isDuplicate(b.title, b.author, b.isbn);
      return { ...b, alreadyImported: check.isDup, existingId: check.existingId };
    }));

    res.json({ results: withStatus });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/import-book ─────────────────────────────────
// Import a single book directly into the review queue and trigger backfill.
router.post('/import-book', async (req, res, next) => {
  try {
    const { title, author, year, genre, isbn, description, coverUrl, pages, sources } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: 'title and author are required' });
    }

    const { isDuplicate } = require('../../utils/dedup');
    const { generateCoverDesign } = require('../../services/coverResolver');

    const check = await isDuplicate(title, author, isbn);
    if (check.isDup) {
      return res.status(409).json({ error: 'Book already exists in the database', existingId: check.existingId });
    }

    const GENRE_EDITOR_MAP = {
      'Fiction': 'Mira Okafor', 'Sci-Fi': 'Dae Han', 'Nature': 'Dae Han',
      'History': 'Jules Park', 'Business': 'Jules Park',
      'Essays': 'Noor Saleh', 'Memoir': 'Noor Saleh',
    };
    const editor = GENRE_EDITOR_MAP[genre] || 'Mira Okafor';

    const book = await Book.create({
      title, author, year, genre, isbn, description, pages,
      coverImageUrl: coverUrl || null,
      coverDesign: generateCoverDesign(title, author),
      editor,
      status: 'metadata_complete',
      sources: {
        googleBooksId: sources?.googleBooksId || null,
        openLibraryKey: sources?.openLibraryKey || null,
        discoveredAt: new Date(),
      },
    });

    // Kick off backfill immediately so the review is generated ASAP
    const backfillAgent = req.app.get('backfillAgent');
    if (backfillAgent && !backfillAgent.running) {
      backfillAgent.run().catch(err => logger.error(`Import-triggered backfill: ${err.message}`));
    }

    res.json({ book, message: 'Book imported and queued for review generation' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Book already exists' });
    }
    next(err);
  }
});

module.exports = router;
