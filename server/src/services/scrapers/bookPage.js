const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

const BOOKPAGE_FEED = 'https://www.bookpage.com/reviews/feed/';

class BookPageScraper extends BaseScraper {
  constructor() {
    super('bookpage');
  }

  async fetchBooks() {
    const books = [];

    try {
      const xml = await this.fetchRss(BOOKPAGE_FEED);
      const items = this.parseRssItems(xml);

      for (const item of items) {
        const parsed = this.extractBookFromItem(item);
        if (parsed) books.push(parsed);
      }
    } catch (err) {
      logger.error(`[Scraper:bookpage] Feed error: ${err.message}`);
    }

    return books;
  }

  /**
   * BookPage RSS items:
   * <title> is usually the book title directly
   * <description> contains the review, often starts with "By Author Name" or mentions the author
   */
  extractBookFromItem(item) {
    if (!item.title) return null;

    const bookTitle = item.title.trim();
    if (!bookTitle || bookTitle.length < 2) return null;

    // Try to extract author from description
    const desc = item.description ? this.stripHtml(item.description) : '';
    let author = null;

    // Pattern 1: "By Author Name" at the start of description
    let match = desc.match(/^By\s+([A-Z][a-zA-Z'\-.\s]+?)(?:\s*[,.|]|\s{2,})/i);
    if (match) {
      author = match[1].trim();
    }

    // Pattern 2: "by Author Name" anywhere early in the text
    if (!author) {
      match = desc.match(/by\s+([A-Z][a-zA-Z'\-.\s]+?)(?:\s*[,.|]|\s{2,})/i);
      if (match) author = match[1].trim();
    }

    // Pattern 3: Check if title has "by Author" (some feeds include this)
    if (!author) {
      match = bookTitle.match(/^(.+?)\s+by\s+(.+)$/i);
      if (match) {
        return {
          title: match[1].trim(),
          author: match[2].trim(),
          sourceUrl: item.link,
          sourceReviewSnippet: desc.substring(0, 500) || null,
          year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
        };
      }
    }

    if (!author || author.length < 3) return null;

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceReviewSnippet: desc.substring(0, 500) || null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
    };
  }
}

module.exports = BookPageScraper;
