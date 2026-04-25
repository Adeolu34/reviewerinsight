const Book = require('../models/Book');
const ScrapedBook = require('../models/ScrapedBook');
const { generateCoverDesign } = require('./coverResolver');
const { isDuplicate } = require('../utils/dedup');
const logger = require('../utils/logger');

// Assign scraped books to editors that match their persona's beat
const GENRE_EDITOR_MAP = {
  'Fiction': 'Mira Okafor',
  'Sci-Fi':  'Dae Han',
  'Nature':  'Dae Han',
  'History': 'Jules Park',
  'Business':'Jules Park',
  'Essays':  'Noor Saleh',
  'Memoir':  'Noor Saleh',
};

const VALID_GENRES = ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature'];

/**
 * Promote pending ScrapedBooks into the main Book collection (metadata_complete).
 * The agent pipeline picks them up from there and generates reviews.
 *
 * @param {number} limit - Max books to process per call (default 500)
 * @returns {{ imported, skipped, failed }}
 */
async function autoImportBatch(limit = 500) {
  const pending = await ScrapedBook.find({ status: 'scraped' })
    .sort({ scrapedAt: 1 })
    .limit(limit)
    .lean();

  if (pending.length === 0) {
    logger.debug('[AutoImport] No pending scraped books to import');
    return { imported: 0, skipped: 0, failed: 0 };
  }

  const stats = { imported: 0, skipped: 0, failed: 0 };

  for (const scraped of pending) {
    try {
      const dup = await isDuplicate(scraped.title, scraped.author, scraped.isbn);
      if (dup.isDup) {
        await ScrapedBook.findByIdAndUpdate(scraped._id, { status: 'skipped' });
        stats.skipped++;
        continue;
      }

      const genre = VALID_GENRES.includes(scraped.genre) ? scraped.genre : 'Fiction';
      const editor = GENRE_EDITOR_MAP[genre] || 'Mira Okafor';

      await Book.create({
        title: scraped.title,
        author: scraped.author,
        year: scraped.year,
        genre,
        isbn: scraped.isbn,
        description: scraped.description || scraped.sourceReviewSnippet,
        coverImageUrl: scraped.coverImageUrl,
        coverDesign: generateCoverDesign(scraped.title, scraped.author),
        editor,
        sources: { discoveredAt: new Date() },
        status: 'metadata_complete',
      });

      await ScrapedBook.findByIdAndUpdate(scraped._id, {
        status: 'imported',
        importedAt: new Date(),
      });

      stats.imported++;
    } catch (err) {
      if (err.code === 11000) {
        await ScrapedBook.findByIdAndUpdate(scraped._id, { status: 'skipped' });
        stats.skipped++;
      } else {
        stats.failed++;
        logger.error(`[AutoImport] Failed to import "${scraped.title}": ${err.message}`);
      }
    }
  }

  logger.info(`[AutoImport] Batch done — imported: ${stats.imported}, skipped: ${stats.skipped}, failed: ${stats.failed}`);
  return stats;
}

module.exports = { autoImportBatch };
