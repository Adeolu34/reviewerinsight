const config = require('../config/env');
const { googleBooksLimiter } = require('../utils/rateLimiter');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

const BASE_URL = 'https://www.googleapis.com/books/v1';

/**
 * Search Google Books API.
 * @param {string} query - Search query
 * @param {number} maxResults - Max results (up to 40)
 * @returns {Array} Array of normalized book objects
 */
async function search(query, maxResults = 40) {
  await googleBooksLimiter.acquire();

  const params = new URLSearchParams({
    q: query,
    maxResults: Math.min(40, maxResults),
    orderBy: 'relevance',
    printType: 'books',
    langRestrict: 'en',
  });
  if (config.googleBooksKey) params.set('key', config.googleBooksKey);

  const data = await withRetry(async () => {
    const res = await fetch(`${BASE_URL}/volumes?${params}`);
    if (!res.ok) {
      const err = new Error(`Google Books API error: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }, { label: `Google Books search: "${query}"` });

  if (!data.items) return [];

  return data.items.map(item => normalizeVolume(item)).filter(Boolean);
}

/**
 * Get a single volume by Google Books ID.
 */
async function getVolume(volumeId) {
  await googleBooksLimiter.acquire();

  const params = new URLSearchParams();
  if (config.googleBooksKey) params.set('key', config.googleBooksKey);

  const data = await withRetry(async () => {
    const res = await fetch(`${BASE_URL}/volumes/${volumeId}?${params}`);
    if (!res.ok) throw new Error(`Google Books volume error: ${res.status}`);
    return res.json();
  }, { label: `Google Books volume: ${volumeId}` });

  return normalizeVolume(data);
}

function normalizeVolume(item) {
  const v = item.volumeInfo;
  if (!v || !v.title || !v.authors?.length) return null;

  // Extract ISBN-13 or ISBN-10
  let isbn = null;
  if (v.industryIdentifiers) {
    const isbn13 = v.industryIdentifiers.find(i => i.type === 'ISBN_13');
    const isbn10 = v.industryIdentifiers.find(i => i.type === 'ISBN_10');
    isbn = isbn13?.identifier || isbn10?.identifier || null;
  }

  // Get best cover image
  let coverUrl = null;
  if (v.imageLinks) {
    coverUrl = v.imageLinks.thumbnail || v.imageLinks.smallThumbnail || null;
    if (coverUrl) {
      // Upgrade to higher resolution
      coverUrl = coverUrl.replace('zoom=1', 'zoom=2').replace('&edge=curl', '');
      // Ensure HTTPS
      coverUrl = coverUrl.replace('http://', 'https://');
    }
  }

  return {
    source: 'google',
    googleBooksId: item.id,
    title: v.title,
    author: v.authors[0],
    authors: v.authors,
    year: v.publishedDate ? parseInt(v.publishedDate.substring(0, 4), 10) : null,
    pages: v.pageCount || null,
    description: v.description || null,
    categories: v.categories || [],
    isbn,
    coverUrl,
    language: v.language,
  };
}

module.exports = { search, getVolume };
