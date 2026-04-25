const BaseScraper = require('./baseScraper');
const { openLibraryLimiter } = require('../../utils/rateLimiter');
const { withRetry } = require('../../utils/retry');
const logger = require('../../utils/logger');

// 50 subjects × 5 pages × 100 results = up to 25,000 candidates per run
const SUBJECTS = [
  // Fiction
  { term: 'literary+fiction',        genre: 'Fiction' },
  { term: 'contemporary+fiction',    genre: 'Fiction' },
  { term: 'historical+fiction',      genre: 'Fiction' },
  { term: 'short+stories',           genre: 'Fiction' },
  { term: 'mystery',                 genre: 'Fiction' },
  { term: 'thriller',                genre: 'Fiction' },
  { term: 'crime+fiction',           genre: 'Fiction' },
  { term: 'romance',                 genre: 'Fiction' },
  { term: 'horror',                  genre: 'Fiction' },
  { term: 'adventure',               genre: 'Fiction' },
  { term: 'coming+of+age',           genre: 'Fiction' },
  { term: 'african+american+fiction',genre: 'Fiction' },
  { term: 'young+adult+fiction',     genre: 'Fiction' },
  { term: 'womens+fiction',          genre: 'Fiction' },
  // Sci-Fi / Fantasy
  { term: 'science+fiction',         genre: 'Sci-Fi' },
  { term: 'fantasy',                 genre: 'Sci-Fi' },
  { term: 'dystopian',               genre: 'Sci-Fi' },
  { term: 'epic+fantasy',            genre: 'Sci-Fi' },
  { term: 'urban+fantasy',           genre: 'Sci-Fi' },
  { term: 'space+opera',             genre: 'Sci-Fi' },
  // Memoir / Biography
  { term: 'memoir',                  genre: 'Memoir' },
  { term: 'autobiography',           genre: 'Memoir' },
  { term: 'biography',               genre: 'Memoir' },
  { term: 'personal+narrative',      genre: 'Memoir' },
  // Essays / Nonfiction
  { term: 'essays',                  genre: 'Essays' },
  { term: 'cultural+criticism',      genre: 'Essays' },
  { term: 'philosophy',              genre: 'Essays' },
  { term: 'psychology',              genre: 'Essays' },
  { term: 'self-help',               genre: 'Essays' },
  { term: 'political+science',       genre: 'Essays' },
  { term: 'social+justice',          genre: 'Essays' },
  { term: 'feminism',                genre: 'Essays' },
  { term: 'true+crime',              genre: 'Essays' },
  { term: 'journalism',              genre: 'Essays' },
  { term: 'technology',              genre: 'Essays' },
  { term: 'neuroscience',            genre: 'Essays' },
  // History
  { term: 'world+history',           genre: 'History' },
  { term: 'american+history',        genre: 'History' },
  { term: 'ancient+history',         genre: 'History' },
  { term: 'military+history',        genre: 'History' },
  { term: 'european+history',        genre: 'History' },
  { term: 'african+history',         genre: 'History' },
  // Business
  { term: 'business',                genre: 'Business' },
  { term: 'economics',               genre: 'Business' },
  { term: 'entrepreneurship',        genre: 'Business' },
  { term: 'personal+finance',        genre: 'Business' },
  { term: 'leadership',              genre: 'Business' },
  { term: 'management',              genre: 'Business' },
  // Nature / Science
  { term: 'natural+history',         genre: 'Nature' },
  { term: 'popular+science',         genre: 'Nature' },
  { term: 'environment',             genre: 'Nature' },
  { term: 'ecology',                 genre: 'Nature' },
  { term: 'biology',                 genre: 'Nature' },
  { term: 'physics',                 genre: 'Nature' },
  { term: 'travel+writing',          genre: 'Nature' },
];

const PAGES_PER_SUBJECT = 5;
const RESULTS_PER_PAGE = 100;

class OpenLibraryBulkScraper extends BaseScraper {
  constructor() {
    super('openlibraryBulk');
  }

  async fetchBooks() {
    const books = [];

    for (const { term, genre } of SUBJECTS) {
      for (let page = 0; page < PAGES_PER_SUBJECT; page++) {
        try {
          await openLibraryLimiter.acquire();

          const offset = page * RESULTS_PER_PAGE;
          const url = `https://openlibrary.org/search.json?q=subject:${term}&fields=key,title,author_name,first_publish_year,isbn,cover_i&limit=${RESULTS_PER_PAGE}&offset=${offset}&lang=eng`;

          const data = await withRetry(async () => {
            const res = await fetch(url, {
              headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
              signal: AbortSignal.timeout(20000),
            });
            if (!res.ok) {
              const e = new Error(`OL bulk search failed: ${res.status}`);
              e.status = res.status;
              throw e;
            }
            return res.json();
          }, { label: `OL Bulk: ${term} p${page}` });

          const docs = data.docs || [];
          if (docs.length === 0) break; // no more pages for this subject

          for (const doc of docs) {
            if (!doc.title || !doc.author_name?.length) continue;
            books.push({
              title: doc.title,
              author: doc.author_name[0],
              isbn: doc.isbn?.[0] || null,
              coverImageUrl: doc.cover_i
                ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
                : null,
              year: doc.first_publish_year || null,
              sourceUrl: doc.key ? `https://openlibrary.org${doc.key}` : null,
              genre,
            });
          }

          logger.info(`[Scraper:openlibraryBulk] ${term} p${page}: ${docs.length} results (total so far: ${books.length})`);
        } catch (err) {
          logger.error(`[Scraper:openlibraryBulk] Error ${term} p${page}: ${err.message}`);
          break; // skip remaining pages for this subject on error
        }
      }
    }

    logger.info(`[Scraper:openlibraryBulk] Fetch complete — ${books.length} raw candidates`);
    return books;
  }
}

module.exports = OpenLibraryBulkScraper;
