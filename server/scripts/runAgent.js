/**
 * CLI tool to manually trigger an agent run.
 *
 * Book review editors:
 *   node scripts/runAgent.js "Mira Okafor" --batch=20
 *   node scripts/runAgent.js "Jules Park"  --backfill --batch=10
 *
 * Author bio editor (Sofia Kwon):
 *   node scripts/runAgent.js "Sofia Kwon" --batch=100
 *   node scripts/runAgent.js "Sofia Kwon" --batch=500   # blast through backlog
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EditorAgent = require('../src/agents/EditorAgent');
const AuthorBioAgent = require('../src/agents/AuthorBioAgent');
const logger = require('../src/utils/logger');

const AUTHOR_BIO_EDITOR = 'Sofia Kwon';

const args = process.argv.slice(2);
const editorName = args.find(a => !a.startsWith('--'));
const batchSize = parseInt((args.find(a => a.startsWith('--batch=')) || '--batch=20').split('=')[1], 10);
const backfill = args.includes('--backfill');

if (!editorName) {
  console.log('Usage: node scripts/runAgent.js "<editor name>" [--batch=N] [--backfill]');
  console.log(`\nBook editors : ${EditorAgent.getAvailableEditors().join(', ')}`);
  console.log(`Author bios  : ${AUTHOR_BIO_EDITOR}`);
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('MongoDB connected');

  if (editorName === AUTHOR_BIO_EDITOR) {
    logger.info(`Starting author bio run: ${editorName} (batch: ${batchSize})`);
    const agent = new AuthorBioAgent();
    const runId = await agent.run({ batchSize });
    logger.info(`Author bio run completed: ${runId}`);
  } else {
    logger.info(`Starting book review run: ${editorName} (batch: ${batchSize}, backfill: ${backfill})`);
    const agent = new EditorAgent(editorName);
    const runId = await agent.run({ batchSize, backfill });
    logger.info(`Book review run completed: ${runId}`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  logger.error('Agent run failed:', err);
  process.exit(1);
});
