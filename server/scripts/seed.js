/**
 * Seed script — migrates the static 30 books and 4 editors into MongoDB.
 * Run: node scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// We need to eval the books.js file since it uses window.BOOKS = ...
const booksJsPath = path.join(__dirname, '../../project/data/books.js');
const booksJsContent = fs.readFileSync(booksJsPath, 'utf-8');

// Create a fake window object to capture the data
const window = {};
eval(booksJsContent.replace(/window\./g, 'window.'));

const BOOKS = window.BOOKS;
const EDITORS = window.EDITORS;
const REVIEW_BODY = window.REVIEW_BODY;
const GENRES = window.GENRES;

// Import models
const Book = require('../src/models/Book');
const Editor = require('../src/models/Editor');

const editorGenreMap = {
  'Mira Okafor': ['Fiction'],
  'Jules Park': ['Essays', 'Business', 'History'],
  'Dae Han': ['Memoir', 'Nature'],
  'Noor Saleh': ['Sci-Fi'],
};

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  // Clear existing data
  await Book.deleteMany({});
  await Editor.deleteMany({});
  console.log('Cleared existing data.\n');

  // Seed editors
  console.log('Seeding editors...');
  for (const e of EDITORS) {
    await Editor.create({
      name: e.name,
      role: e.role,
      beat: e.beat,
      initials: e.initials,
      bg: e.bg,
      genres: editorGenreMap[e.name] || [],
      active: true,
      reviewCount: BOOKS.filter(b => b.editor === e.name).length,
    });
    console.log(`  ✓ ${e.name} (${e.role})`);
  }

  // Seed books
  console.log('\nSeeding books...');
  for (const b of BOOKS) {
    // Normalize genre: the data uses Unicode non-breaking hyphen in "Sci‑Fi"
    const normalizedGenre = (b.genre || '').replace(/\u2011/g, '-');

    const bookDoc = {
      title: b.title,
      author: b.author,
      year: b.year,
      genre: normalizedGenre,
      pages: b.pages,
      readTime: b.readTime,
      rating: b.rating,
      blurb: b.blurb,
      takeaways: b.takeaways || [],
      editor: b.editor || null,
      issue: b.issue || 'No. 048',
      featured: b.featured || false,
      coverDesign: {
        style: b.cover.style,
        bg: b.cover.bg,
        fg: b.cover.fg,
        motif: b.cover.motif,
      },
      status: 'published',
      sources: { discoveredAt: new Date() },
    };

    // Book #1 gets the full review body
    if (b.id === 1) {
      bookDoc.review = {
        headline: REVIEW_BODY.headline,
        stand: REVIEW_BODY.stand,
        paragraphs: REVIEW_BODY.paragraphs,
        pullQuote: REVIEW_BODY.pullQuote,
        summaryBullets: REVIEW_BODY.summaryBullets,
      };
      bookDoc.sources.reviewGeneratedAt = new Date();
    }

    await Book.create(bookDoc);
    console.log(`  ✓ [${b.id}] ${b.title} by ${b.author}${b.id === 1 ? ' (with full review)' : ''}`);
  }

  console.log(`\nSeeding complete: ${EDITORS.length} editors, ${BOOKS.length} books.`);
  console.log('Book #1 has full review content. Books 2-30 have metadata only.');
  console.log('\nTo generate reviews for the remaining books, run:');
  console.log('  node scripts/runAgent.js "Mira Okafor" --backfill\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
