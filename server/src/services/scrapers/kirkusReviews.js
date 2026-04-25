const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

// Kirkus is a professional review outlet — every item IS a book review
const KIRKUS_FEEDS = [
  'https://www.kirkusreviews.com/feeds/rss',
  'https://www.kirkusreviews.com/feeds/rss/fiction/',
  'https://www.kirkusreviews.com/feeds/rss/nonfiction/',
  'https://www.kirkusreviews.com/feeds/rss/science-fiction/',
];

class KirkusReviewsScraper extends BaseScraper {
  constructor() {
    super('kirkus');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of KIRKUS_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item, feedUrl);
          if (parsed) books.push(parsed);
        }

        logger.info(`[Scraper:kirkus] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:kirkus] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  extractBookFromItem(item, feedUrl) {
    if (!item.title) return null;

    const t = item.title;
    let bookTitle, author;

    // Kirkus titles: "BOOK TITLE by Author Name"
    // Often in ALL CAPS for the title portion
    let match = t.match(/^([A-Z0-9\s\-:'',.!?&]+?)\s+by\s+([A-Za-z'\-.\s]{3,}?)(?:\s*[,|]|$)/);
    if (match) {
      bookTitle = this._toTitleCase(match[1].trim());
      author = match[2].trim();
    }

    // Fallback: standard mixed case "Title by Author"
    if (!match) {
      match = t.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
      if (match) {
        bookTitle = match[1].trim();
        author = match[2].trim();
      }
    }

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    // Extract star rating if present
    let sourceRating = null;
    const desc = item.description || '';
    const starMatch = desc.match(/(\d)\s*(?:out of\s*5|\/\s*5|stars?)/i);
    if (starMatch) sourceRating = `${starMatch[1]}/5`;

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceRating,
      sourceReviewSnippet: this.stripHtml(desc).substring(0, 500) || null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
      genre: this._genreFromUrl(feedUrl),
    };
  }

  _toTitleCase(str) {
    // Convert UPPERCASE to Title Case
    if (str === str.toUpperCase() && str.length > 3) {
      return str.toLowerCase().replace(/(?:^|\s|[-"'(])\w/g, c => c.toUpperCase());
    }
    return str;
  }

  _genreFromUrl(url) {
    if (url.includes('science-fiction')) return 'Sci-Fi';
    if (url.includes('fiction')) return 'Fiction';
    if (url.includes('nonfiction')) return 'Essays';
    return null;
  }
}

module.exports = KirkusReviewsScraper;
