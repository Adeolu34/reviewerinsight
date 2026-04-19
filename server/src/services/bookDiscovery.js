const googleBooks = require('./googleBooks');
const openLibrary = require('./openLibrary');
const { isDuplicate } = require('../utils/dedup');
const { resolveCovers, generateCoverDesign } = require('./coverResolver');
const logger = require('../utils/logger');

// Map API categories to our genre set
const GENRE_MAP = {
  'fiction': 'Fiction', 'literary fiction': 'Fiction', 'novels': 'Fiction',
  'literature': 'Fiction', 'contemporary fiction': 'Fiction',
  'essays': 'Essays', 'essay': 'Essays', 'literary criticism': 'Essays',
  'cultural criticism': 'Essays', 'humor': 'Essays',
  'memoir': 'Memoir', 'biography': 'Memoir', 'autobiography': 'Memoir',
  'biography & autobiography': 'Memoir',
  'science fiction': 'Sci-Fi', 'sci-fi': 'Sci-Fi', 'speculative fiction': 'Sci-Fi',
  'fantasy': 'Sci-Fi', 'dystopian': 'Sci-Fi',
  'history': 'History', 'world history': 'History', 'historical': 'History',
  'business': 'Business', 'economics': 'Business', 'management': 'Business',
  'self-help': 'Business', 'entrepreneurship': 'Business',
  'nature': 'Nature', 'environment': 'Nature', 'ecology': 'Nature',
  'travel': 'Nature', 'nature writing': 'Nature',
};

function mapGenre(categories) {
  for (const cat of categories) {
    const lower = cat.toLowerCase().trim();
    if (GENRE_MAP[lower]) return GENRE_MAP[lower];
    // Check partial matches
    for (const [key, genre] of Object.entries(GENRE_MAP)) {
      if (lower.includes(key)) return genre;
    }
  }
  return 'Fiction'; // Default
}

function calculateReadTime(pages) {
  if (!pages) return null;
  const hours = Math.floor(pages / 47);
  const minutes = Math.round((pages / 47 - hours) * 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Discover new books for a given set of search queries.
 * Returns deduplicated, enriched book objects ready for DB insertion.
 */
async function discoverBooks(queries, { batchSize = 10, editorName } = {}) {
  const candidates = [];
  const seen = new Set();

  logger.info(`Discovering books for ${editorName || 'unknown'}. Queries: ${queries.length}`);

  for (const query of queries) {
    try {
      // Fetch from both sources
      const [gResults, olResults] = await Promise.all([
        googleBooks.search(query, 15).catch(err => { logger.warn(`Google Books search failed: ${err.message}`); return []; }),
        openLibrary.search(query, 15).catch(err => { logger.warn(`Open Library search failed: ${err.message}`); return []; }),
      ]);

      const combined = [...gResults, ...olResults];

      for (const book of combined) {
        // Skip if we've already seen this title+author in this batch
        const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Check against database
        const dup = await isDuplicate(book.title, book.author, book.isbn);
        if (dup.isDup) {
          logger.debug(`Skipping duplicate: "${book.title}" (${dup.reason})`);
          continue;
        }

        candidates.push(book);
        if (candidates.length >= batchSize) break;
      }
    } catch (err) {
      logger.error(`Discovery query failed "${query}": ${err.message}`);
    }

    if (candidates.length >= batchSize) break;
  }

  logger.info(`Discovered ${candidates.length} new books`);

  // Enrich each candidate
  const enriched = candidates.map(book => ({
    title: book.title,
    author: book.author,
    year: book.year,
    genre: mapGenre(book.categories || []),
    pages: book.pages,
    readTime: calculateReadTime(book.pages),
    isbn: book.isbn,
    description: book.description,
    coverImageUrl: book.coverUrl,
    coverDesign: generateCoverDesign(book.title, book.author),
    editor: editorName,
    sources: {
      googleBooksId: book.googleBooksId || null,
      openLibraryKey: book.openLibraryKey || null,
      discoveredAt: new Date(),
    },
    status: 'metadata_complete',
  }));

  return enriched;
}

module.exports = { discoverBooks, mapGenre, calculateReadTime };
