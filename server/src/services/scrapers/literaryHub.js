const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

const LITHUB_FEEDS = [
  'https://lithub.com/feed/',
  'https://lithub.com/book/feed/',
  'https://crimereads.com/feed/',
];

class LiteraryHubScraper extends BaseScraper {
  constructor() {
    super('lithub');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of LITHUB_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item, feedUrl);
          if (parsed) books.push(parsed);
        }

        logger.info(`[Scraper:lithub] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:lithub] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  extractBookFromItem(item, feedUrl) {
    if (!item.title) return null;

    const t = item.title;
    let bookTitle, author;

    // Pattern: "Book Title by Author Name"
    let match = t.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    if (match) {
      bookTitle = match[1].trim();
      author = match[2].trim();
    }

    // Pattern: "Review: 'Book Title' by Author"
    if (!match) {
      match = t.match(/['“”‘’"]+([^'“”‘’"]+)['“”‘’"]+.*?\bby\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
      if (match) {
        bookTitle = match[1].trim();
        author = match[2].trim();
      }
    }

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    // Remove trailing verb phrases from author
    author = author.replace(
      /\s+(is|was|has|offers|takes|explores|weaves|crafts|delivers|brings|captures|paints|follows|tells|shows|proves|continues|returns|discusses|writes|asks|considers).*$/i,
      ''
    ).trim();

    if (author.length < 3) return null;

    const isCrimeReads = feedUrl.includes('crimereads');
    const genre = isCrimeReads ? 'Fiction' : this._guessGenre(item);

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceReviewSnippet: item.description ? this.stripHtml(item.description).substring(0, 500) : null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
      genre,
    };
  }

  _guessGenre(item) {
    const text = `${item.title || ''} ${item.link || ''}`.toLowerCase();
    if (text.includes('sci-fi') || text.includes('science fiction') || text.includes('fantasy')) return 'Sci-Fi';
    if (text.includes('memoir') || text.includes('biography')) return 'Memoir';
    if (text.includes('history') || text.includes('historical')) return 'History';
    if (text.includes('mystery') || text.includes('thriller') || text.includes('crime')) return 'Fiction';
    if (text.includes('essay') || text.includes('nonfiction') || text.includes('non-fiction')) return 'Essays';
    return null;
  }
}

module.exports = LiteraryHubScraper;
