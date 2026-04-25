const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

// Tor.com covers science fiction, fantasy, and speculative fiction exclusively
const TOR_FEEDS = [
  'https://www.tor.com/category/book-reviews/feed/',
  'https://www.tor.com/category/all-book-reviews/feed/',
  'https://www.tor.com/feed/',
];

class TorBooksScraper extends BaseScraper {
  constructor() {
    super('tor');
  }

  async fetchBooks() {
    const books = [];
    const seen = new Set();

    for (const feedUrl of TOR_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) {
            const key = `${parsed.title}|${parsed.author}`.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              books.push(parsed);
            }
          }
        }

        logger.info(`[Scraper:tor] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:tor] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  extractBookFromItem(item) {
    if (!item.title) return null;

    const t = item.title;

    // Tor patterns: "Book Title by Author Name" or "Review: Book Title by Author"
    let match = t.match(/^(?:review:\s*)?(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    if (!match) {
      // Quoted title: "Book Title" by Author
      match = t.match(/['""''"]+([^'""''"]{3,60})['""''"]+\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    }

    if (!match) return null;

    const bookTitle = match[1].trim().replace(/^['""''"]+|['""''"]+$/g, '');
    let author = match[2].trim();
    author = author.replace(/\s+(is|was|has|offers|takes|explores|delivers|wows|dazzles).*$/i, '').trim();

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceReviewSnippet: item.description ? this.stripHtml(item.description).substring(0, 500) : null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
      genre: 'Sci-Fi', // Tor exclusively covers speculative fiction
    };
  }
}

module.exports = TorBooksScraper;
