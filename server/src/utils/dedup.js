const Book = require('../models/Book');

/**
 * Normalize title + author for deduplication.
 */
function normalize(title, author) {
  let t = (title || '').toLowerCase();
  let a = (author || '').toLowerCase();

  // Strip subtitles (after colon or em-dash)
  t = t.split(/[:\u2014\u2013\u2014\u2013—–]/)[0].trim();

  // Remove leading articles
  t = t.replace(/^(the|a|an)\s+/i, '');

  // Remove punctuation, collapse whitespace (Unicode-aware: keep all letters/numbers)
  t = t.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  a = a.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

  // Take first author only
  a = a.split(/\s*(?:and|,|&)\s*/)[0].trim();

  return { title: t, author: a };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a book already exists in the database.
 */
async function isDuplicate(title, author, isbn) {
  // Check by ISBN first (most reliable)
  if (isbn) {
    const byIsbn = await Book.findOne({ isbn }).select('_id title').lean();
    if (byIsbn) return { isDup: true, existingId: byIsbn._id, reason: 'isbn' };
  }

  // Check by normalized title + author
  const norm = normalize(title, author);
  if (!norm.title || !norm.author) return { isDup: false };

  // Match stored titles both with and without a leading article (the/a/an),
  // since normalize() strips them but stored titles retain the original form.
  const titleRegex = new RegExp(`^(?:(?:the|a|an)\\s+)?${escapeRegex(norm.title)}`, 'i');

  const byTitle = await Book.findOne({
    title: { $regex: titleRegex },
    author: { $regex: new RegExp(escapeRegex(norm.author), 'i') },
  }).select('_id title').lean();

  if (byTitle) return { isDup: true, existingId: byTitle._id, reason: 'title+author' };

  return { isDup: false };
}

module.exports = { normalize, isDuplicate };
