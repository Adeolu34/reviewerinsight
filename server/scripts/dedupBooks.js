/**
 * One-shot duplicate cleanup script.
 *
 * Finds all duplicate books (same normalized title + author), keeps the best
 * copy (published > metadata_complete > others; most content wins ties), and
 * hard-deletes the rest.
 *
 * Usage:
 *   node scripts/dedupBooks.js           # dry-run — reports only
 *   node scripts/dedupBooks.js --delete  # actually deletes duplicates
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../src/models/Book');
const { normalize } = require('../src/utils/dedup');

const DRY_RUN = !process.argv.includes('--delete');

const STATUS_RANK = {
  published:         5,
  review_complete:   4,
  metadata_complete: 3,
  review_pending:    2,
  discovered:        1,
  failed:            0,
};

function score(book) {
  const statusScore = STATUS_RANK[book.status] ?? 0;
  const contentScore =
    (book.review?.headline ? 10 : 0) +
    (book.chapterSummaries?.length ?? 0) +
    (book.description ? 1 : 0) +
    (book.coverImageUrl ? 1 : 0) +
    (book.isbn ? 1 : 0);
  return statusScore * 100 + contentScore;
}

function fmt(n) { return n.toLocaleString(); }

async function main() {
  console.log(`\nBook deduplication — mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'DELETE'}\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  // Stream all books, build a map keyed by normalized "title|author"
  const total = await Book.countDocuments();
  console.log(`Total books in collection: ${fmt(total)}`);

  const cursor = Book.find({})
    .select('_id title author isbn status review chapterSummaries description coverImageUrl createdAt')
    .lean()
    .cursor();

  const groups = new Map(); // key -> [book, ...]

  let processed = 0;
  for await (const book of cursor) {
    const norm = normalize(book.title, book.author);
    const key = `${norm.title}|||${norm.author}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(book);
    processed++;
    if (processed % 5000 === 0) process.stdout.write(`\r  Scanned ${fmt(processed)} / ${fmt(total)}…`);
  }
  console.log(`\r  Scanned ${fmt(processed)} books.\n`);

  // Find groups with more than one book
  const dupGroups = [...groups.values()].filter(g => g.length > 1);

  if (dupGroups.length === 0) {
    console.log('No duplicates found. Collection is clean.');
    await mongoose.disconnect();
    return;
  }

  let totalDuplicates = 0;
  const idsToDelete = [];

  for (const group of dupGroups) {
    // Sort: highest score first
    group.sort((a, b) => score(b) - score(a));
    const [keep, ...discard] = group;

    totalDuplicates += discard.length;
    idsToDelete.push(...discard.map(b => b._id));

    if (DRY_RUN && dupGroups.indexOf(group) < 20) {
      console.log(`  KEEP  [${keep.status}] "${keep.title}" by ${keep.author}`);
      for (const d of discard) {
        console.log(`  DROP  [${d.status}] "${d.title}" by ${d.author} (id: ${d._id})`);
      }
      console.log();
    }
  }

  console.log(`Duplicate groups found : ${fmt(dupGroups.length)}`);
  console.log(`Books to delete        : ${fmt(totalDuplicates)}`);
  console.log(`Books to keep          : ${fmt(total - totalDuplicates)}\n`);

  if (DRY_RUN) {
    console.log('DRY RUN — no changes made. Re-run with --delete to remove duplicates.');
    await mongoose.disconnect();
    return;
  }

  // Delete in batches of 500
  let deleted = 0;
  for (let i = 0; i < idsToDelete.length; i += 500) {
    const batch = idsToDelete.slice(i, i + 500);
    const result = await Book.deleteMany({ _id: { $in: batch } });
    deleted += result.deletedCount;
    process.stdout.write(`\r  Deleted ${fmt(deleted)} / ${fmt(totalDuplicates)}…`);
  }

  console.log(`\n\nDone. Deleted ${fmt(deleted)} duplicate books.`);
  console.log(`Remaining books: ${fmt(await Book.countDocuments())}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
