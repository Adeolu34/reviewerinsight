const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

const BOOKRIOT_FEEDS = [
  'https://bookriot.com/feed/',
  'https://bookriot.com/category/reviews/feed/',
  'https://bookriot.com/category/book-recommendations/feed/',
];

class BookRiotScraper extends BaseScraper {
  constructor() {
    super('bookriot');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of BOOKRIOT_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) books.push(...parsed);
        }

        logger.info(`[Scraper:bookriot] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:bookriot] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  extractBookFromItem(item) {
    if (!item.title) return [];

    const t = item.title;
    const results = [];

    // Pattern 1: single "Book Title by Author"
    const byMatch = t.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    if (byMatch) {
      const bookTitle = byMatch[1].trim();
      let author = byMatch[2].trim();
      author = author.replace(
        /\s+(is|was|has|offers|takes|explores|weaves|delivers|captures).*$/i, ''
      ).trim();
      if (bookTitle.length >= 2 && author.length >= 3) {
        results.push({
          title: bookTitle,
          author,
          sourceUrl: item.link,
          sourceReviewSnippet: item.description ? this.stripHtml(item.description).substring(0, 500) : null,
          year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
          genre: this._guessGenre(t, item.link),
        });
        return results;
      }
    }

    // Pattern 2: "Best X Books" list posts — extract books from description
    if (/\bbest\b.*\bbooks?\b/i.test(t) || /\bmust.read\b/i.test(t) || /\brecommend/i.test(t)) {
      const desc = item.description ? this.stripHtml(item.description) : '';
      const mentions = this._extractMentions(desc, item);
      results.push(...mentions);
    }

    return results;
  }

  _extractMentions(text, item) {
    const results = [];
    // Match quoted title + by author pattern in body text
    const re = /['""''"]+([^'""''"]{3,60})['""''"]+\s+by\s+([A-Z][a-zA-Z'\-.\s]{3,40}?)(?=[,.\n]|$)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const bookTitle = m[1].trim();
      let author = m[2].trim().replace(
        /\s+(is|was|has|offers|takes|explores|weaves).*$/i, ''
      ).trim();
      if (bookTitle.length >= 2 && author.length >= 3) {
        results.push({
          title: bookTitle,
          author,
          sourceUrl: item.link,
          sourceReviewSnippet: null,
          year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
          genre: this._guessGenre(bookTitle, item.link),
        });
      }
    }
    return results.slice(0, 10); // cap list posts at 10 books each
  }

  _guessGenre(text, url = '') {
    const t = (text + ' ' + url).toLowerCase();
    if (t.includes('sci-fi') || t.includes('science fiction') || t.includes('fantasy')) return 'Sci-Fi';
    if (t.includes('memoir') || t.includes('biography')) return 'Memoir';
    if (t.includes('history') || t.includes('historical')) return 'History';
    if (t.includes('mystery') || t.includes('thriller') || t.includes('crime')) return 'Fiction';
    if (t.includes('romance')) return 'Fiction';
    if (t.includes('business') || t.includes('finance')) return 'Business';
    if (t.includes('essay') || t.includes('nonfiction')) return 'Essays';
    return null;
  }
}

module.exports = BookRiotScraper;
