const { openLibraryLimiter } = require('../utils/rateLimiter');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

const BASE_URL = 'https://openlibrary.org';

/**
 * Search Open Library.
 */
async function search(query, limit = 20) {
  await openLibraryLimiter.acquire();

  const params = new URLSearchParams({
    q: query,
    limit,
    language: 'eng',
    fields: 'key,title,author_name,first_publish_year,number_of_pages_median,subject,isbn,cover_i',
  });

  const data = await withRetry(async () => {
    const res = await fetch(`${BASE_URL}/search.json?${params}`);
    if (!res.ok) throw new Error(`Open Library search error: ${res.status}`);
    return res.json();
  }, { label: `Open Library search: "${query}"` });

  if (!data.docs) return [];

  return data.docs.map(doc => normalizeDoc(doc)).filter(Boolean);
}

/**
 * Get a work by Open Library key.
 */
async function getWork(key) {
  await openLibraryLimiter.acquire();

  const data = await withRetry(async () => {
    const res = await fetch(`${BASE_URL}${key}.json`);
    if (!res.ok) throw new Error(`Open Library work error: ${res.status}`);
    return res.json();
  }, { label: `Open Library work: ${key}` });

  return data;
}

function normalizeDoc(doc) {
  if (!doc.title || !doc.author_name?.length) return null;

  const isbn = doc.isbn?.[0] || null;
  let coverUrl = null;
  if (doc.cover_i) {
    coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
  } else if (isbn) {
    coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  }

  return {
    source: 'openlibrary',
    openLibraryKey: doc.key,
    title: doc.title,
    author: doc.author_name[0],
    authors: doc.author_name,
    year: doc.first_publish_year || null,
    pages: doc.number_of_pages_median || null,
    description: null, // Open Library search doesn't return descriptions
    categories: (doc.subject || []).slice(0, 10),
    isbn,
    coverUrl,
  };
}

module.exports = { search, getWork };
