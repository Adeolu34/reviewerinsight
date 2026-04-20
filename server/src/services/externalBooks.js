const config = require('../config/env');
const Book = require('../models/Book');
const { normalize } = require('../utils/dedup');
const { googleBooksLimiter } = require('../utils/rateLimiter');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

// In-memory cache (10-minute TTL)
const _cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const GENRE_QUERY_MAP = {
  'Fiction': 'fiction+novels',
  'Essays': 'nonfiction+essays',
  'Memoir': 'memoir+biography',
  'Sci-Fi': 'science+fiction+fantasy',
  'History': 'history',
  'Business': 'business+economics',
  'Nature': 'nature+science+environment',
};

/**
 * Search Google Books for popular books matching reader profile.
 * Used in real-time during recommendation generation.
 */
async function searchBooks({ genres = [], moods = [], freeText = '', maxResults = 8 }) {
  // Build search query from profile
  const queryParts = [];

  if (genres.length > 0) {
    const subjects = genres
      .map(g => GENRE_QUERY_MAP[g])
      .filter(Boolean)
      .slice(0, 2);
    if (subjects.length > 0) queryParts.push(`subject:${subjects[0]}`);
  }

  if (freeText && freeText.trim().length > 2) {
    // Use first meaningful words from free text
    const words = freeText.trim().split(/\s+/).slice(0, 4).join('+');
    queryParts.push(words);
  } else if (moods.length > 0) {
    queryParts.push(moods.slice(0, 2).join('+'));
  }

  if (queryParts.length === 0) {
    queryParts.push('bestseller+books+' + new Date().getFullYear());
  }

  const query = queryParts.join('+');
  const cacheKey = `ext:${query}:${maxResults}`;

  // Check cache
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  try {
    await googleBooksLimiter.acquire();

    let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&orderBy=relevance&maxResults=${maxResults}&printType=books&langRestrict=en`;
    if (config.googleBooksKey) url += `&key=${config.googleBooksKey}`;

    const data = await withRetry(async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Google Books API ${res.status}`);
      return res.json();
    }, { label: 'ExternalBooks search', maxAttempts: 2 });

    const books = [];
    for (const item of (data.items || [])) {
      const v = item.volumeInfo;
      if (!v || !v.title || !v.authors?.length) continue;

      books.push({
        title: v.title,
        author: v.authors[0],
        description: v.description ? v.description.substring(0, 300) : null,
        pages: v.pageCount || null,
        year: v.publishedDate ? parseInt(v.publishedDate.substring(0, 4), 10) || null : null,
        genre: _mapCategories(v.categories),
        coverImageUrl: _getCoverUrl(v.imageLinks),
        rating: v.averageRating || null,
        buyLink: v.infoLink || null,
        previewLink: v.previewLink || null,
        source: 'google_books',
        isExternal: true,
      });
    }

    // Filter out books already in our collection
    const filtered = await _filterExistingBooks(books);

    _cache.set(cacheKey, { data: filtered, time: Date.now() });
    return filtered;
  } catch (err) {
    logger.error(`[ExternalBooks] Search failed: ${err.message}`);
    return [];
  }
}

/**
 * Fetch trending books (for /api/books/trending endpoint).
 */
async function fetchTrending() {
  const cacheKey = 'trending:all';
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.time < 30 * 60 * 1000) {
    return cached.data;
  }

  const queries = [
    { q: 'subject:fiction', genre: 'Fiction' },
    { q: 'subject:nonfiction', genre: 'Essays' },
  ];

  const results = [];

  for (const { q, genre } of queries) {
    try {
      await googleBooksLimiter.acquire();

      let url = `https://www.googleapis.com/books/v1/volumes?q=${q}&orderBy=newest&maxResults=10&printType=books&langRestrict=en`;
      if (config.googleBooksKey) url += `&key=${config.googleBooksKey}`;

      const data = await withRetry(async () => {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`Google Books ${res.status}`);
        return res.json();
      }, { label: `Trending: ${q}`, maxAttempts: 2 });

      for (const item of (data.items || [])) {
        const v = item.volumeInfo;
        if (!v || !v.title || !v.authors?.length) continue;

        results.push({
          title: v.title,
          author: v.authors[0],
          description: v.description ? v.description.substring(0, 200) : null,
          coverImageUrl: _getCoverUrl(v.imageLinks),
          rating: v.averageRating || null,
          year: v.publishedDate ? parseInt(v.publishedDate.substring(0, 4), 10) || null : null,
          genre,
          buyLink: v.infoLink || null,
          source: 'google_books',
        });
      }
    } catch (err) {
      logger.error(`[ExternalBooks] Trending fetch failed for ${q}: ${err.message}`);
    }
  }

  _cache.set(cacheKey, { data: results, time: Date.now() });
  return results;
}

async function _filterExistingBooks(books) {
  const filtered = [];
  for (const book of books) {
    const norm = normalize(book.title, book.author);
    if (!norm.title || !norm.author) { filtered.push(book); continue; }

    const exists = await Book.findOne({
      title: { $regex: new RegExp(`^${norm.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
      author: { $regex: new RegExp(norm.author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    }).select('_id').lean();

    if (!exists) filtered.push(book);
  }
  return filtered;
}

function _getCoverUrl(imageLinks) {
  if (!imageLinks) return null;
  const url = imageLinks.thumbnail || imageLinks.smallThumbnail;
  if (!url) return null;
  return url.replace('zoom=1', 'zoom=2').replace(/^http:/, 'https:');
}

function _mapCategories(categories) {
  if (!categories || categories.length === 0) return null;
  const cat = categories[0].toLowerCase();
  if (cat.includes('fiction') && !cat.includes('non')) return 'Fiction';
  if (cat.includes('science fiction') || cat.includes('fantasy')) return 'Sci-Fi';
  if (cat.includes('history')) return 'History';
  if (cat.includes('biography') || cat.includes('memoir')) return 'Memoir';
  if (cat.includes('business') || cat.includes('economics')) return 'Business';
  if (cat.includes('nature') || cat.includes('science')) return 'Nature';
  return 'Essays';
}

module.exports = { searchBooks, fetchTrending };
