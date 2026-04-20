const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

const GUARDIAN_FEEDS = [
  'https://www.theguardian.com/books/fiction/rss',
  'https://www.theguardian.com/books/non-fiction/rss',
];

class GuardianBooksScraper extends BaseScraper {
  constructor() {
    super('guardian');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of GUARDIAN_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) books.push(parsed);
        }
      } catch (err) {
        logger.error(`[Scraper:guardian] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  /**
   * Guardian review titles follow patterns like:
   * "Book Title by Author Name review - description"
   * "Book Title by Author Name – a thrilling tale"
   */
  extractBookFromItem(item) {
    if (!item.title) return null;

    const match = item.title.match(
      /^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]+?)(?:\s+review|\s+[-\u2013\u2014]|\s*$)/i
    );
    if (!match) return null;

    const bookTitle = match[1].trim();
    const author = match[2].trim();

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    // Try to extract star rating from description
    let sourceRating = null;
    if (item.description) {
      const starMatch = item.description.match(/(\d)\s*(?:out of\s*5|\/\s*5|stars?)/i);
      if (starMatch) sourceRating = `${starMatch[1]}/5`;
    }

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceRating,
      sourceReviewSnippet: item.description ? this.stripHtml(item.description).substring(0, 500) : null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
      genre: this.guessGenre(item),
    };
  }

  guessGenre(item) {
    const url = item.link || '';
    if (url.includes('/fiction/')) return 'Fiction';
    if (url.includes('/non-fiction/')) return 'Essays';
    return null;
  }
}

module.exports = GuardianBooksScraper;
