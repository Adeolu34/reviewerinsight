const BaseScraper = require('./baseScraper');
const config = require('../../config/env');
const { googleBooksLimiter } = require('../../utils/rateLimiter');
const { withRetry } = require('../../utils/retry');
const logger = require('../../utils/logger');

const SUBJECTS = [
  // New releases — ordered by recency
  { query: 'subject:fiction', genre: 'Fiction' },
  { query: 'subject:nonfiction', genre: 'Essays' },
  { query: 'subject:biography', genre: 'Memoir' },
  { query: 'subject:science+fiction', genre: 'Sci-Fi' },
  { query: 'subject:history', genre: 'History' },
  { query: 'subject:business', genre: 'Business' },
  // Popular/evergreen — ordered by relevance to surface high-engagement books
  // (e.g. Atomic Habits, Psychology of Money, Thinking Fast and Slow)
  { query: 'subject:self-help', genre: 'Essays', orderBy: 'relevance' },
  { query: 'subject:psychology', genre: 'Essays', orderBy: 'relevance' },
  { query: 'subject:personal+finance', genre: 'Business', orderBy: 'relevance' },
];

class GoogleBooksTrendingScraper extends BaseScraper {
  constructor() {
    super('googlebooks');
  }

  async fetchBooks() {
    const books = [];

    for (const { query, genre, orderBy = 'newest' } of SUBJECTS) {
      try {
        await googleBooksLimiter.acquire();

        let url = `https://www.googleapis.com/books/v1/volumes?q=${query}&orderBy=${orderBy}&maxResults=20&printType=books&langRestrict=en`;
        if (config.googleBooksKey) url += `&key=${config.googleBooksKey}`;

        const data = await withRetry(async () => {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) { const e = new Error(`Google Books API ${res.status}`); e.status = res.status; throw e; }
          return res.json();
        }, { label: `GoogleBooks: ${query}` });

        for (const item of (data.items || [])) {
          const v = item.volumeInfo;
          if (!v || !v.title || !v.authors?.length) continue;

          // Skip very short descriptions or items without enough metadata
          const isbn = this._extractIsbn(v.industryIdentifiers);

          books.push({
            title: v.title,
            author: v.authors[0],
            description: v.description ? v.description.substring(0, 500) : null,
            isbn,
            coverImageUrl: this._getCoverUrl(v.imageLinks),
            sourceUrl: v.infoLink || null,
            sourceRating: v.averageRating ? `${v.averageRating}/5` : null,
            genre,
            year: v.publishedDate ? parseInt(v.publishedDate.substring(0, 4), 10) || null : null,
          });
        }

        logger.info(`[Scraper:googlebooks] ${query}: ${(data.items || []).length} results`);
      } catch (err) {
        logger.error(`[Scraper:googlebooks] Error for ${query}: ${err.message}`);
      }
    }

    return books;
  }

  _extractIsbn(identifiers) {
    if (!identifiers) return null;
    const isbn13 = identifiers.find(i => i.type === 'ISBN_13');
    if (isbn13) return isbn13.identifier;
    const isbn10 = identifiers.find(i => i.type === 'ISBN_10');
    return isbn10 ? isbn10.identifier : null;
  }

  _getCoverUrl(imageLinks) {
    if (!imageLinks) return null;
    // Prefer larger images
    const url = imageLinks.thumbnail || imageLinks.smallThumbnail;
    if (!url) return null;
    // Upgrade zoom level for better resolution
    return url.replace('zoom=1', 'zoom=2').replace(/^http:/, 'https:');
  }
}

module.exports = GoogleBooksTrendingScraper;
