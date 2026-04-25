const ScrapedBook = require('../../models/ScrapedBook');
const Book = require('../../models/Book');
const { normalize } = require('../../utils/dedup');
const { withRetry } = require('../../utils/retry');
const { rssLimiter } = require('../../utils/rateLimiter');
const logger = require('../../utils/logger');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class BaseScraper {
  constructor(sourceName) {
    this.source = sourceName;
  }

  /** Subclasses must implement this. Returns array of raw book objects. */
  async fetchBooks() {
    throw new Error('fetchBooks() must be implemented by subclass');
  }

  // ─── RSS helpers (shared by RSS-based scrapers) ───────────────

  async fetchRss(url) {
    await rssLimiter.acquire();
    return withRetry(async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ReviewerInsight/1.0 (book-review-aggregator)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const err = new Error(`RSS fetch failed: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res.text();
    }, { label: `RSS: ${url}` });
  }

  parseRssItems(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      items.push({
        title: this.extractTag(content, 'title'),
        link: this.extractTag(content, 'link'),
        description: this.extractTag(content, 'description'),
        pubDate: this.extractTag(content, 'pubDate'),
        creator: this.extractTag(content, 'dc:creator'),
      });
    }
    return items;
  }

  extractTag(xml, tag) {
    const regex = new RegExp(
      `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
      'i'
    );
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  stripHtml(str) {
    return str ? str.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim() : '';
  }

  // ─── Dedup ────────────────────────────────────────────────────

  async checkDuplicate(title, author, isbn) {
    const norm = normalize(title, author);
    if (!norm.title || !norm.author) return { isDup: false };

    // Match stored titles both with and without a leading article (the/a/an),
    // since normalize() strips them but stored titles retain the original form.
    const titleRegex = new RegExp(`^(?:(?:the|a|an)\\s+)?${escapeRegex(norm.title)}`, 'i');
    const authorRegex = new RegExp(escapeRegex(norm.author), 'i');

    // Check ScrapedBook (same source)
    const inScraped = await ScrapedBook.findOne({
      title: { $regex: titleRegex },
      author: { $regex: authorRegex },
      source: this.source,
    }).select('_id').lean();
    if (inScraped) return { isDup: true, reason: 'already_scraped' };

    // Check main Book collection
    if (isbn) {
      const byIsbn = await Book.findOne({ isbn }).select('_id').lean();
      if (byIsbn) return { isDup: true, reason: 'in_main_collection' };
    }

    const inMain = await Book.findOne({
      title: { $regex: titleRegex },
      author: { $regex: authorRegex },
    }).select('_id').lean();
    if (inMain) return { isDup: true, reason: 'in_main_collection' };

    return { isDup: false };
  }

  // ─── Main run loop ────────────────────────────────────────────

  async run(scraperRunId) {
    const stats = { booksFound: 0, booksNew: 0, booksDuplicate: 0, booksFailed: 0, errors: [] };

    let rawBooks;
    try {
      rawBooks = await this.fetchBooks();
    } catch (err) {
      logger.error(`[Scraper:${this.source}] fetchBooks failed: ${err.message}`);
      throw err;
    }

    stats.booksFound = rawBooks.length;
    logger.info(`[Scraper:${this.source}] Found ${rawBooks.length} candidate books`);

    for (const raw of rawBooks) {
      try {
        if (!raw.title || !raw.author) {
          stats.booksFailed++;
          continue;
        }

        const dup = await this.checkDuplicate(raw.title, raw.author, raw.isbn);
        if (dup.isDup) {
          stats.booksDuplicate++;
          continue;
        }

        await ScrapedBook.create({
          title: raw.title,
          author: raw.author,
          source: this.source,
          sourceUrl: raw.sourceUrl || null,
          sourceRating: raw.sourceRating || null,
          sourceReviewSnippet: raw.sourceReviewSnippet
            ? raw.sourceReviewSnippet.substring(0, 500)
            : null,
          genre: raw.genre || null,
          year: raw.year || null,
          isbn: raw.isbn || null,
          coverImageUrl: raw.coverImageUrl || null,
          description: raw.description || null,
          scraperRunId,
          status: 'scraped',
        });

        stats.booksNew++;
      } catch (err) {
        if (err.code === 11000) {
          stats.booksDuplicate++;
        } else {
          stats.booksFailed++;
          stats.errors.push({
            title: raw.title || 'Unknown',
            error: err.message,
            timestamp: new Date(),
          });
          logger.error(`[Scraper:${this.source}] Failed to save "${raw.title}": ${err.message}`);
        }
      }
    }

    logger.info(`[Scraper:${this.source}] Done — ${stats.booksNew} new, ${stats.booksDuplicate} dup, ${stats.booksFailed} failed`);
    return stats;
  }
}

module.exports = BaseScraper;
