const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

const NPR_FEEDS = [
  'https://feeds.npr.org/1032/rss.xml',   // Book Reviews
  'https://feeds.npr.org/1161/rss.xml',   // Books (broader)
];

class NprBooksScraper extends BaseScraper {
  constructor() {
    super('npr');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of NPR_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) books.push(parsed);
        }
      } catch (err) {
        logger.error(`[Scraper:npr] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  /**
   * NPR review titles often follow patterns like:
   * "Review: 'Book Title' by Author Name"
   * "'Book Title,' by Author Name, is a..."
   * "In 'Book Title,' Author Name explores..."
   */
  extractBookFromItem(item) {
    if (!item.title) return null;

    const title = item.title;
    let match;

    // Pattern 1: quotes around title + "by Author"
    match = title.match(
      /['\u2018\u2019\u201C\u201D"]+([^'\u2018\u2019\u201C\u201D"]+)['\u2018\u2019\u201C\u201D"]+[\s,]+by\s+(.+?)(?:\s*[,.]|$)/i
    );

    if (!match) {
      // Pattern 2: quotes + author name with capital letters
      match = title.match(
        /['\u2018\u2019\u201C\u201D"]+([^'\u2018\u2019\u201C\u201D"]+)['\u2018\u2019\u201C\u201D"]+.*?by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i
      );
    }

    if (!match) return null;

    const bookTitle = match[1].trim();
    let author = match[2].trim();

    // Clean author: remove trailing verb phrases
    author = author.replace(
      /\s+(is|was|has|offers|takes|explores|weaves|crafts|delivers|brings|captures|paints|follows|tells|shows|proves|continues|returns).*$/i,
      ''
    ).trim();

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceReviewSnippet: item.description ? this.stripHtml(item.description).substring(0, 500) : null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
    };
  }
}

module.exports = NprBooksScraper;
