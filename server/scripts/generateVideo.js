/**
 * CLI tool to generate a video for a book.
 *
 * Single book by ID:
 *   node scripts/generateVideo.js <bookId>
 *
 * Batch (next N unprocessed books):
 *   node scripts/generateVideo.js --batch=5
 */
require('dotenv').config();
const mongoose   = require('mongoose');
const VideoAgent = require('../src/agents/VideoAgent');
const logger     = require('../src/utils/logger');

const args      = process.argv.slice(2);
const bookId    = args.find(a => !a.startsWith('--'));
const batchArg  = args.find(a => a.startsWith('--batch='));
const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 0;

if (!bookId && !batchSize) {
  console.log('Usage:');
  console.log('  node scripts/generateVideo.js <bookId>        # single book');
  console.log('  node scripts/generateVideo.js --batch=5       # next 5 unprocessed');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('MongoDB connected');

  const agent = new VideoAgent();

  if (bookId) {
    logger.info(`Generating video for book: ${bookId}`);
    const job = await agent.generateForBook(bookId);
    logger.info(`Done — status: ${job.status}, path: ${job.videoPath}`);
  } else {
    logger.info(`Running batch of ${batchSize} videos`);
    const results = await agent.runBatch(batchSize);
    for (const r of results) {
      logger.info(`  ${r.status.padEnd(8)} ${r.title}${r.error ? ' — ' + r.error : ''}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  logger.error('generateVideo failed:', err);
  process.exit(1);
});
