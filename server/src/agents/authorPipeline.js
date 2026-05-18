const Author = require('../models/Author');
const AgentRun = require('../models/AgentRun');
const Book = require('../models/Book');
const { generateAuthorBio } = require('../services/openaiAuthor');
const logger = require('../utils/logger');

const CONCURRENCY = 3;

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
    return `https://covers.openlibrary.org/a/olid/${key.replace('/authors/', '')}-L.jpg`;
  } catch {
    return null;
  }
}

async function processAuthor(author) {
  // Get their books for context
  const books = await Book.find({
    author: { $regex: new RegExp(`^${author.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    status: 'published',
  }).select('title').limit(5).lean();

  const titles = books.map(b => b.title);

  const bio = await generateAuthorBio(author.name, titles);

  const update = {
    bio:         bio.bio,
    shortBio:    bio.shortBio,
    birthYear:   bio.birthYear,
    deathYear:   bio.deathYear,
    nationality: bio.nationality,
    bioStatus:   'generated',
  };

  if (bio.genres?.length > 0) {
    update.genres = [...new Set([...(author.genres || []), ...bio.genres].filter(Boolean))];
  }

  if (!author.photoUrl) {
    const photo = await fetchOpenLibraryPhoto(author.name);
    if (photo) update.photoUrl = photo;
  }

  await Author.findByIdAndUpdate(author._id, { $set: update });

  return { tokensUsed: bio.tokensUsed };
}

async function runAuthorPipeline(persona, options = {}) {
  const { batchSize = 50 } = options;

  const run = await AgentRun.create({
    editor: persona.name,
    status: 'running',
    searchQueries: [],
  });

  logger.info(`Author bio run started: ${persona.name} (batch: ${batchSize})`);

  try {
    const authors = await Author.find({
      bioStatus: { $in: ['pending', 'failed'] },
    })
      .sort({ bookCount: -1 })
      .limit(batchSize)
      .lean();

    run.booksDiscovered = authors.length;
    logger.info(`Authors pending bio: ${authors.length}`);

    if (authors.length === 0) {
      run.status = 'completed';
      run.completedAt = new Date();
      run.durationMs = 0;
      await run.save();
      logger.info('No authors pending bio — run complete.');
      return run._id.toString();
    }

    for (let i = 0; i < authors.length; i += CONCURRENCY) {
      const chunk = authors.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        chunk.map(author => processAuthor(author))
      );

      for (let j = 0; j < results.length; j++) {
        const author = chunk[j];
        const r = results[j];

        if (r.status === 'fulfilled') {
          run.booksReviewed += 1;
          run.tokensUsed += r.value.tokensUsed;
          run.estimatedCost += (r.value.tokensUsed * 0.6) / 1000000;
          logger.info(`Bio generated: "${author.name}"`);
        } else {
          run.booksFailed += 1;
          run.errors.push({ bookTitle: author.name, error: r.reason?.message || 'Unknown error', timestamp: new Date() });
          await Author.findByIdAndUpdate(author._id, { bioStatus: 'failed' });
          logger.error(`Bio failed for "${author.name}": ${r.reason?.message}`);
        }
      }

      await run.save();
    }

    run.status = run.booksFailed > 0 && run.booksReviewed > 0 ? 'partial'
               : run.booksFailed > 0 ? 'failed'
               : 'completed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();
    await run.save();

    logger.info(`Author bio run complete: ${persona.name} — Done: ${run.booksReviewed}, Failed: ${run.booksFailed}`);
    return run._id.toString();

  } catch (err) {
    run.status = 'failed';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();
    run.errors.push({ bookTitle: 'pipeline', error: err.message, timestamp: new Date() });
    await run.save();
    logger.error(`Author bio run failed: ${err.message}`);
    throw err;
  }
}

module.exports = { runAuthorPipeline };
