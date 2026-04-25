const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

// Publishers Weekly is the trade standard — every item is a book review
const PW_FEEDS = [
  'https://www.publishersweekly.com/pw/feeds/starred-reviews.xml',
  'https://www.publishersweekly.com/pw/feeds/book-reviews.xml',
  'https://www.publishersweekly.com/pw/by-topic/industry-news/publisher-news/rss.xml',
];

const PW_GENRE_KEYWORDS = {
  'Sci-Fi': ['science fiction', 'sci-fi', 'fantasy', 'speculative'],
  'Memoir': ['memoir', 'biography', 'autobiography'],
  'History': ['history', 'historical', 'nonfiction-history'],
  'Business': ['business', 'economics', 'finance', 'management'],
  'Essays': ['nonfiction', 'self-help', 'psychology', 'science', 'nature', 'religion'],
  'Fiction': ['fiction', 'novel', 'mystery', 'thriller', 'romance'],
};

class PublishersWeeklyScraper extends BaseScraper {
  constructor() {
    super('pw');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of PW_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) books.push(parsed);
        }

        logger.info(`[Scraper:pw] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:pw] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  extractBookFromItem(item) {
    if (!item.title) return null;

    const t = item.title;
    let bookTitle, author;

    // PW format: "Title by Author" or "TITLE by Author"
    let match = t.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—(]|$)/i);
    if (match) {
      bookTitle = this._normalizeTitle(match[1].trim());
      author = match[2].trim();
    }

    // Fallback: "Title, by Author"
    if (!match) {
      match = t.match(/^(.+?),\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
      if (match) {
        bookTitle = this._normalizeTitle(match[1].trim());
        author = match[2].trim();
      }
    }

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    author = author.replace(/\s+(is|was|has|offers|takes|explores|creates|presents).*$/i, '').trim();

    // Extract starred review indicator
    const desc = item.description || '';
    const isStarred = /starred/i.test(desc) || feedUrl?.includes('starred');
    const sourceRating = isStarred ? 'Starred Review' : null;

    const descText = this.stripHtml(desc).substring(0, 500);

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceRating,
      sourceReviewSnippet: descText || null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
      genre: this._guessGenre(t + ' ' + descText),
    };
  }

  _normalizeTitle(str) {
    if (str === str.toUpperCase() && str.length > 3) {
      return str.toLowerCase().replace(/(?:^|\s|[-"'(])\w/g, c => c.toUpperCase());
    }
    return str;
  }

  _guessGenre(text) {
    const t = text.toLowerCase();
    for (const [genre, keywords] of Object.entries(PW_GENRE_KEYWORDS)) {
      if (keywords.some(k => t.includes(k))) return genre;
    }
    return null;
  }
}

module.exports = PublishersWeeklyScraper;
