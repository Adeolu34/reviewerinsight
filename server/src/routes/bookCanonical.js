const express = require('express');
const Book = require('../models/Book');
const config = require('../config/env');
const { slugify } = require('../utils/slugify');

const router = express.Router();

/**
 * Wrong slug → 301 to canonical /book/:id/:slug (matches sitemap & meta).
 * Must be registered before the `/book/:bookId` handler below.
 */
router.get('/book/:bookId/:slug', async (req, res, next) => {
  const { bookId, slug } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(bookId)) return next();

  try {
    const book = await Book.findById(bookId).select('title status').lean();
    if (!book || book.status !== 'published') return next();
    const canonicalSlug = slugify(book.title) || 'book';
    if (slug !== canonicalSlug) {
      return res.redirect(301, `${config.siteUrl}/book/${bookId}/${canonicalSlug}`);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * 301 /book/:id → /book/:id/:slug so crawlers and users align with sitemap canonical URLs.
 */
router.get('/book/:bookId', async (req, res, next) => {
  const id = req.params.bookId;
  if (!/^[a-f0-9]{24}$/i.test(id)) return next();

  try {
    const book = await Book.findById(id).select('title status').lean();
    if (!book || book.status !== 'published') return next();
    const slug = slugify(book.title) || 'book';
    const loc = `${config.siteUrl}/book/${id}/${slug}`;
    return res.redirect(301, loc);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
