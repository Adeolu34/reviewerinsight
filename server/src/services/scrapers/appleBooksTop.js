const BaseScraper = require('./baseScraper');
const { rssLimiter } = require('../../utils/rateLimiter');
const { withRetry } = require('../../utils/retry');
const logger = require('../../utils/logger');

const APPLE_FEEDS = [
  'https://rss.marketingtools.apple.com/api/v2/us/books/top-paid/50/books.json',
  'https://rss.marketingtools.apple.com/api/v2/us/books/top-free/50/books.json',
];

const APPLE_GENRE_MAP = {
  'Fiction & Literature': 'Fiction',
  'Mysteries & Thrillers': 'Fiction',
  'Romance': 'Fiction',
  'Sci-Fi & Fantasy': 'Sci-Fi',
  'Science Fiction & Fantasy': 'Sci-Fi',
  'Biographies & Memoirs': 'Memoir',
  'History': 'History',
  'Business & Personal Finance': 'Business',
  'Nonfiction': 'Essays',
  'Science & Nature': 'Nature',
};

class AppleBooksTopScraper extends BaseScraper {
  constructor() {
    super('applebooks');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of APPLE_FEEDS) {
      try {
        await rssLimiter.acquire();

        const data = await withRetry(async () => {
          const res = await fetch(feedUrl, {
            headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`Apple Books feed ${res.status}`);
          return res.json();
        }, { label: `AppleBooks: ${feedUrl.includes('top-paid') ? 'top-paid' : 'top-free'}` });

        const results = data.feed?.results || [];
        for (const item of results) {
          if (!item.name || !item.artistName) continue;

          books.push({
            title: item.name,
            author: item.artistName,
            coverImageUrl: this._getHighResCover(item.artworkUrl100),
            sourceUrl: item.url || null,
            genre: this._mapGenre(item.genres),
            description: null,
            year: item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) || null : null,
          });
        }

        logger.info(`[Scraper:applebooks] ${feedUrl.includes('top-paid') ? 'top-paid' : 'top-free'}: ${results.length} books`);
      } catch (err) {
        logger.error(`[Scraper:applebooks] Error for feed: ${err.message}`);
      }
    }

    return books;
  }

  _getHighResCover(url) {
    if (!url) return null;
    // Apple provides 100x100 by default — scale up
    return url.replace('100x100', '400x400');
  }

  _mapGenre(genres) {
    if (!Array.isArray(genres) || genres.length === 0) return null;
    for (const g of genres) {
      const name = g.name || g;
      if (APPLE_GENRE_MAP[name]) return APPLE_GENRE_MAP[name];
    }
    return null;
  }
}

module.exports = AppleBooksTopScraper;
