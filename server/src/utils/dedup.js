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

  // Remove punctuation, collapse whitespace
  t = t.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  a = a.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

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

  const byTitle = await Book.findOne({
    title: { $regex: new RegExp(`^${escapeRegex(norm.title)}`, 'i') },
    author: { $regex: new RegExp(escapeRegex(norm.author), 'i') },
  }).select('_id title').lean();

  if (byTitle) return { isDup: true, existingId: byTitle._id, reason: 'title+author' };

  return { isDup: false };
}

module.exports = { normalize, isDuplicate };
