/**
 * CLI tool to manually trigger an agent run.
 * Usage:
 *   node scripts/runAgent.js "Mira Okafor" --batch=5
 *   node scripts/runAgent.js "Jules Park" --backfill --batch=10
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EditorAgent = require('../src/agents/EditorAgent');
const logger = require('../src/utils/logger');

const args = process.argv.slice(2);
const editorName = args.find(a => !a.startsWith('--'));
const batchSize = parseInt((args.find(a => a.startsWith('--batch=')) || '--batch=10').split('=')[1], 10);
const backfill = args.includes('--backfill');

if (!editorName) {
  console.log('Usage: node scripts/runAgent.js "<editor name>" [--batch=N] [--backfill]');
  console.log(`\nAvailable editors: ${EditorAgent.getAvailableEditors().join(', ')}`);
  process.exit(1);
}

async function main() {
  logger.info(`Starting agent run: ${editorName} (batch: ${batchSize}, backfill: ${backfill})`);

  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('MongoDB connected');

  const agent = new EditorAgent(editorName);
  const runId = await agent.run({ batchSize, backfill });

  logger.info(`Run completed: ${runId}`);
  await mongoose.disconnect();
}

main().catch(err => {
  logger.error('Agent run failed:', err);
  process.exit(1);
});
