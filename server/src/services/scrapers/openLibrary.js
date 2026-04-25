const BaseScraper = require('./baseScraper');
const { openLibraryLimiter } = require('../../utils/rateLimiter');
const { withRetry } = require('../../utils/retry');
const logger = require('../../utils/logger');

const OL_ENDPOINTS = [
  'https://openlibrary.org/trending/now.json',
  'https://openlibrary.org/trending/daily.json',
  'https://openlibrary.org/trending/weekly.json',
  'https://openlibrary.org/trending/yearly.json', // surfaces sustained popular books
];

class OpenLibraryScraper extends BaseScraper {
  constructor() {
    super('openlibrary');
  }

  async fetchBooks() {
    const books = [];

    for (const url of OL_ENDPOINTS) {
      try {
        await openLibraryLimiter.acquire();
        const data = await withRetry(async () => {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) { const e = new Error(`OL fetch failed: ${res.status}`); e.status = res.status; throw e; }
          return res.json();
        }, { label: `OL: ${url}` });

        for (const work of (data.works || [])) {
          if (!work.title || !work.author_name?.length) continue;

          books.push({
            title: work.title,
            author: work.author_name[0],
            isbn: work.isbn?.[0] || null,
            coverImageUrl: work.cover_i
              ? `https://covers.openlibrary.org/b/id/${work.cover_i}-L.jpg`
              : null,
            year: work.first_publish_year || null,
            sourceUrl: work.key ? `https://openlibrary.org${work.key}` : null,
            description: work.subtitle || null,
          });
        }
      } catch (err) {
        logger.error(`[Scraper:openlibrary] Error for ${url}: ${err.message}`);
      }
    }

    return books;
  }
}

module.exports = OpenLibraryScraper;
