/**
 * Seed the Author collection from published books.
 * Creates one Author document per unique author name, with AI-generated bio
 * and photo fetched from Open Library.
 *
 * Usage:
 *   node scripts/populateAuthors.js              # all authors, with AI bios
 *   node scripts/populateAuthors.js --no-bio     # skip AI generation (fast)
 *   node scripts/populateAuthors.js --limit=50   # first 50 authors only
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../src/models/Book');
const Author = require('../src/models/Author');
const { generateAuthorBio } = require('../src/services/openaiAuthor');
const logger = require('../src/utils/logger');

const SKIP_BIO = process.argv.includes('--no-bio');
const LIMIT = parseInt(
  (process.argv.find(a => a.startsWith('--limit=')) || '--limit=0').split('=')[1], 10
) || 0;

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function fetchOpenLibraryPhoto(authorName) {
  try {
    const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ReviewerInsight/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const key = data.docs?.[0]?.key;
    if (!key) return null;
    const olid = key.replace('/authors/', '');
    return `https://covers.openlibrary.org/a/olid/${olid}-L.jpg`;
  } catch {
    return null;
  }
}

function fmt(n) { return n.toLocaleString(); }

async function main() {
  console.log(`\nAuthor population — mode: ${SKIP_BIO ? 'no-bio (fast)' : 'with AI bios'}\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  const pipeline = [
    { $match: { status: 'published' } },
    {
      $group: {
        _id: '$author',
        bookCount: { $sum: 1 },
        genres: { $addToSet: '$genre' },
        titles: { $push: '$title' },
      },
    },
    { $sort: { bookCount: -1 } },
  ];
  if (LIMIT > 0) pipeline.push({ $limit: LIMIT });

  const groups = await Book.aggregate(pipeline);
  console.log(`Unique authors in published books: ${fmt(groups.length)}\n`);

  let created = 0, updated = 0, failed = 0;

  for (let i = 0; i < groups.length; i++) {
    const { _id: name, bookCount, genres, titles } = groups[i];
    if (!name) continue;

    const slug = slugify(name);
    const pct = `[${i + 1}/${groups.length}]`;
    process.stdout.write(`\r${pct} ${name.substring(0, 45).padEnd(45)} `);

    try {
      const existing = await Author.findOne({ slug });

      // If already fully generated, just refresh the book count
      if (existing?.bioStatus === 'generated' && !SKIP_BIO) {
        await Author.updateOne({ _id: existing._id }, {
          bookCount,
          genres: [...new Set(genres.filter(Boolean))],
        });
        updated++;
        continue;
      }

      const doc = {
        name,
        slug,
        bookCount,
        genres: [...new Set(genres.filter(Boolean))],
      };

      if (!SKIP_BIO) {
        try {
          const bio = await generateAuthorBio(name, titles.slice(0, 5));
          Object.assign(doc, {
            bio:         bio.bio,
            shortBio:    bio.shortBio,
            birthYear:   bio.birthYear,
            deathYear:   bio.deathYear,
            nationality: bio.nationality,
            bioStatus:   'generated',
          });
          if (bio.genres.length > 0) {
            doc.genres = [...new Set([...doc.genres, ...bio.genres].filter(Boolean))];
          }
        } catch (err) {
          doc.bioStatus = 'failed';
          logger.warn(`Bio failed for "${name}": ${err.message}`);
        }

        const photo = await fetchOpenLibraryPhoto(name);
        if (photo) doc.photoUrl = photo;
      } else {
        doc.bioStatus = 'pending';
      }

      await Author.findOneAndUpdate({ slug }, { $set: doc }, { upsert: true });
      if (existing) updated++; else created++;

    } catch (err) {
      failed++;
      logger.error(`Failed "${name}": ${err.message}`);
    }
  }

  console.log(`\n\nDone.`);
  console.log(`  Created : ${fmt(created)}`);
  console.log(`  Updated : ${fmt(updated)}`);
  console.log(`  Failed  : ${fmt(failed)}`);
  console.log(`\nTotal authors: ${fmt(await Author.countDocuments())}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
