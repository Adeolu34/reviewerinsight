const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

const MILLIONS_FEEDS = [
  'https://themillions.com/feed/',
  'https://themillions.com/category/reviews/feed/',
  'https://themillions.com/category/features/feed/',
];

class TheMillionsScraper extends BaseScraper {
  constructor() {
    super('themillions');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of MILLIONS_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) books.push(parsed);
        }

        logger.info(`[Scraper:themillions] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:themillions] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  extractBookFromItem(item) {
    if (!item.title) return null;

    const t = item.title;

    // The Millions review titles: "Book Title by Author Name"
    // or "On Book Title" or "A Review of Book Title"
    let match = t.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    if (!match) {
      // "A Review of 'Book Title'" or "On 'Book Title'"
      match = t.match(/(?:review of|on)\s+['""''"]*([^'""''"]{3,60})['""''"]*.*?\bby\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    }

    if (!match) return null;

    const bookTitle = match[1].trim().replace(/^['""''"]+|['""''"]+$/g, '');
    let author = match[2].trim();
    author = author.replace(
      /\s+(is|was|has|offers|takes|explores|weaves|crafts|delivers).*$/i, ''
    ).trim();

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceReviewSnippet: item.description ? this.stripHtml(item.description).substring(0, 500) : null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
      genre: this._guessGenre(t, item.link),
    };
  }

  _guessGenre(text, url = '') {
    const t = (text + ' ' + url).toLowerCase();
    if (t.includes('sci-fi') || t.includes('science fiction') || t.includes('fantasy') || t.includes('speculative')) return 'Sci-Fi';
    if (t.includes('memoir') || t.includes('biography')) return 'Memoir';
    if (t.includes('history') || t.includes('historical')) return 'History';
    if (t.includes('mystery') || t.includes('thriller') || t.includes('crime')) return 'Fiction';
    if (t.includes('essay') || t.includes('nonfiction') || t.includes('non-fiction')) return 'Essays';
    return 'Fiction'; // The Millions skews literary fiction
  }
}

module.exports = TheMillionsScraper;
