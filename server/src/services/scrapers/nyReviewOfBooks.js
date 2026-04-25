const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

const NYRB_FEEDS = [
  'https://feeds.feedburner.com/nybooks',
  'https://www.nybooks.com/feed/articles/',
];

class NyReviewOfBooksScraper extends BaseScraper {
  constructor() {
    super('nybooks');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of NYRB_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);
        const items = this.parseRssItems(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) books.push(...parsed);
        }

        logger.info(`[Scraper:nybooks] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:nybooks] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  extractBookFromItem(item) {
    if (!item.title) return [];

    const t = item.title;
    const results = [];

    // NYRB titles often: "The Title of the Book by Author Name"
    // or "On 'Book Title'" or just an essay title
    const byMatch = t.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    if (byMatch) {
      const bookTitle = byMatch[1].trim().replace(/^['""''"]+|['""''"]+$/g, '');
      let author = byMatch[2].trim();
      author = author.replace(/\s+(is|was|has|offers|takes|explores|reviews).*$/i, '').trim();
      if (bookTitle.length >= 2 && author.length >= 3) {
        results.push({
          title: bookTitle,
          author,
          sourceUrl: item.link,
          sourceReviewSnippet: item.description ? this.stripHtml(item.description).substring(0, 500) : null,
          year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
          genre: 'Essays',
        });
        return results;
      }
    }

    // Try extracting from description body (NYRB often lists reviewed books in subtitle)
    const desc = item.description ? this.stripHtml(item.description) : '';
    const quotedMatch = desc.match(/['""''"]+([^'""''"]{3,60})['""''"]+\s+by\s+([A-Z][a-zA-Z'\-.\s]{3,40}?)(?=[,.\n(])/i);
    if (quotedMatch) {
      const bookTitle = quotedMatch[1].trim();
      let author = quotedMatch[2].trim().replace(/\s+(is|was|has|offers).*$/i, '').trim();
      if (bookTitle.length >= 2 && author.length >= 3) {
        results.push({
          title: bookTitle,
          author,
          sourceUrl: item.link,
          sourceReviewSnippet: desc.substring(0, 500) || null,
          year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
          genre: 'Essays',
        });
      }
    }

    return results;
  }
}

module.exports = NyReviewOfBooksScraper;
