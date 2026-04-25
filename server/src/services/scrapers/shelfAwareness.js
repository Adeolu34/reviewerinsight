const BaseScraper = require('./baseScraper');
const logger = require('../../utils/logger');

// Shelf Awareness is a daily newsletter for booksellers with professional reviews
const SHELF_FEEDS = [
  'https://www.shelf-awareness.com/shelf/articles.atom',
  'https://www.shelf-awareness.com/site/rss/',
];

class ShelfAwarenessScraper extends BaseScraper {
  constructor() {
    super('shelfawareness');
  }

  async fetchBooks() {
    const books = [];

    for (const feedUrl of SHELF_FEEDS) {
      try {
        const xml = await this.fetchRss(feedUrl);

        // Shelf Awareness may serve Atom feeds — normalise to RSS-like structure
        const items = this._parseAtomOrRss(xml);

        for (const item of items) {
          const parsed = this.extractBookFromItem(item);
          if (parsed) books.push(parsed);
        }

        logger.info(`[Scraper:shelfawareness] ${feedUrl}: ${items.length} items`);
      } catch (err) {
        logger.error(`[Scraper:shelfawareness] Feed error for ${feedUrl}: ${err.message}`);
      }
    }

    return books;
  }

  _parseAtomOrRss(xml) {
    // Try Atom <entry> first, fall back to RSS <item>
    const isAtom = xml.includes('<entry>') || xml.includes('<feed');
    if (isAtom) {
      const entries = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let m;
      while ((m = entryRegex.exec(xml)) !== null) {
        const c = m[1];
        const link = (/<link[^>]+href="([^"]+)"/.exec(c) || [])[1]
                  || this.extractTag(c, 'link')
                  || null;
        entries.push({
          title: this.extractTag(c, 'title'),
          link,
          description: this.extractTag(c, 'summary') || this.extractTag(c, 'content'),
          pubDate: this.extractTag(c, 'published') || this.extractTag(c, 'updated'),
          creator: this.extractTag(c, 'author'),
        });
      }
      return entries;
    }
    return this.parseRssItems(xml);
  }

  extractBookFromItem(item) {
    if (!item.title) return null;

    const t = item.title;

    // Shelf Awareness review titles: "Title by Author"
    let match = t.match(/^(.+?)\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    if (!match) {
      match = t.match(/['""''"]+([^'""''"]{3,60})['""''"]+\s+by\s+([A-Z][a-zA-Z'\-.\s]{2,}?)(?:\s*[|,\-–—]|$)/i);
    }

    if (!match) return null;

    const bookTitle = match[1].trim().replace(/^['""''"]+|['""''"]+$/g, '');
    let author = match[2].trim();
    author = author.replace(/\s+(is|was|has|offers|takes|explores|presents).*$/i, '').trim();

    if (!bookTitle || bookTitle.length < 2 || !author || author.length < 3) return null;

    const desc = item.description ? this.stripHtml(item.description) : '';

    return {
      title: bookTitle,
      author,
      sourceUrl: item.link,
      sourceReviewSnippet: desc.substring(0, 500) || null,
      year: item.pubDate ? new Date(item.pubDate).getFullYear() : null,
      genre: this._guessGenre(t + ' ' + desc),
    };
  }

  _guessGenre(text) {
    const t = text.toLowerCase();
    if (t.includes('sci-fi') || t.includes('science fiction') || t.includes('fantasy')) return 'Sci-Fi';
    if (t.includes('memoir') || t.includes('biography')) return 'Memoir';
    if (t.includes('history') || t.includes('historical')) return 'History';
    if (t.includes('mystery') || t.includes('thriller') || t.includes('crime')) return 'Fiction';
    if (t.includes('business') || t.includes('finance')) return 'Business';
    if (t.includes('nonfiction') || t.includes('essay')) return 'Essays';
    return null;
  }
}

module.exports = ShelfAwarenessScraper;
