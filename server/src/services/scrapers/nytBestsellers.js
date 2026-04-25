const BaseScraper = require('./baseScraper');
const config = require('../../config/env');
const { nytLimiter } = require('../../utils/rateLimiter');
const { withRetry } = require('../../utils/retry');
const logger = require('../../utils/logger');

const NYT_LISTS = [
  'hardcover-fiction',
  'hardcover-nonfiction',
  'paperback-nonfiction',
  'young-adult-hardcover',
  'business-books',                      // Psychology of Money, etc.
  'advice-how-to-and-miscellaneous',     // Atomic Habits, self-help, etc.
  'combined-print-and-e-book-nonfiction', // Broad nonfiction catch-all
];

const LIST_GENRE_MAP = {
  'hardcover-fiction': 'Fiction',
  'hardcover-nonfiction': 'Essays',
  'paperback-nonfiction': 'Essays',
  'young-adult-hardcover': 'Fiction',
  'business-books': 'Business',
  'advice-how-to-and-miscellaneous': 'Essays',
  'combined-print-and-e-book-nonfiction': 'Essays',
};

class NytBestsellersScraper extends BaseScraper {
  constructor() {
    super('nyt');
  }

  async fetchBooks() {
    if (!config.nytApiKey) {
      logger.info('[Scraper:nyt] No NYT_BOOKS_API_KEY configured — skipping');
      return [];
    }

    const books = [];

    for (const list of NYT_LISTS) {
      try {
        await nytLimiter.acquire();
        const url = `https://api.nytimes.com/svc/books/v3/lists/current/${list}.json?api-key=${config.nytApiKey}`;

        const data = await withRetry(async () => {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) { const e = new Error(`NYT API ${res.status} for ${list}`); e.status = res.status; throw e; }
          return res.json();
        }, { label: `NYT: ${list}` });

        const results = data.results?.books || [];
        for (const b of results) {
          if (!b.title || !b.author) continue;

          const weeksText = b.weeks_on_list > 0 ? `${b.weeks_on_list} week${b.weeks_on_list > 1 ? 's' : ''}` : '';
          const rankText = `#${b.rank}`;

          books.push({
            title: this._titleCase(b.title),
            author: this._cleanAuthor(b.author),
            description: b.description || null,
            isbn: b.primary_isbn13 || b.primary_isbn10 || null,
            coverImageUrl: b.book_image || null,
            sourceUrl: b.amazon_product_url || b.book_uri || null,
            sourceRating: weeksText ? `${rankText} · ${weeksText}` : rankText,
            sourceReviewSnippet: b.book_review_link ? `NYT ${list} bestseller` : null,
            genre: LIST_GENRE_MAP[list] || 'Fiction',
            year: new Date().getFullYear(),
          });
        }

        logger.info(`[Scraper:nyt] ${list}: ${results.length} books`);
      } catch (err) {
        logger.error(`[Scraper:nyt] Error fetching ${list}: ${err.message}`);
      }
    }

    return books;
  }

  _titleCase(str) {
    // NYT returns UPPERCASE titles — convert to title case
    if (str === str.toUpperCase()) {
      return str.toLowerCase().replace(/(?:^|\s|[-"'(])\w/g, c => c.toUpperCase());
    }
    return str;
  }

  _cleanAuthor(author) {
    // NYT sometimes returns "Last, First" — normalize
    if (/^[^,]+,\s*[^,]+$/.test(author) && !author.includes(' and ')) {
      const [last, first] = author.split(',').map(s => s.trim());
      return `${first} ${last}`;
    }
    return author;
  }
}

module.exports = NytBestsellersScraper;
