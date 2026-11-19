const cron = require('node-cron');
const config = require('../config/env');
const logger = require('../utils/logger');
const { guarded } = require('../utils/jobGuard');
const AgentOrchestrator = require('../agents/AgentOrchestrator');
const BackfillAgent = require('../agents/BackfillAgent');

/**
 * Start every scheduled background job. Each job is wrapped in guarded() so a slow run
 * can never overlap with the next tick. Returns the objects the routes need via app.set().
 */
function startSchedules(app) {
  const orchestrator = new AgentOrchestrator();
  app.set('orchestrator', orchestrator);

  // Agents only run when an LLM key is configured
  const openAiPlaceholder = !config.openaiKey || config.openaiKey === 'sk-your-openai-key-here';
  const llmReady = !!config.openrouterKey || !openAiPlaceholder;

  if (llmReady) {
    orchestrator.startSchedule();
    // Continuous backfill: catches books stuck in incomplete states every hour
    const backfillAgent = new BackfillAgent();
    app.set('backfillAgent', backfillAgent);
    backfillAgent.startSchedule();
  } else {
    logger.warn('No LLM API key configured (OPENROUTER_API_KEY or OPENAI_API_KEY) — agent scheduling disabled');
  }

  const { runAllScrapers } = require('../services/scrapers');
  const { autoImportBatch } = require('../services/autoImport');

  // Daily scrape: all sources at 1:00 AM UTC (before agent runs)
  cron.schedule('0 1 * * *', guarded('scrape-all', async () => {
    logger.info('[Scraper] Scheduled daily scrape started');
    await runAllScrapers('scheduled');
    logger.info('[Scraper] Scheduled daily scrape completed');
  }), { timezone: 'UTC' });
  logger.info('Scraper schedule: daily at 1:00 AM UTC');

  // Auto-import: promote pending scraped books into the review queue every 30 min
  cron.schedule('*/30 * * * *', guarded('auto-import', async () => {
    const stats = await autoImportBatch(500);
    if (stats.imported > 0) logger.info(`[AutoImport] ${stats.imported} books added to review queue`);
  }), { timezone: 'UTC' });
  logger.info('AutoImport schedule: every 30 minutes');

  // Video generation: 1 video at 03:00, 09:00, 15:00 and 21:00 UTC
  const VideoAgent = require('../agents/VideoAgent');
  const videoAgent = new VideoAgent();
  app.set('videoAgent', videoAgent);

  const runScheduledVideo = guarded('video-batch', async () => {
    logger.info('[VideoAgent] Scheduled run starting');
    const results = await videoAgent.runBatch(1);
    logger.info(`[VideoAgent] Scheduled run done: ${JSON.stringify(results)}`);
  });
  for (const expr of ['0 3 * * *', '0 9 * * *', '0 15 * * *', '0 21 * * *']) {
    cron.schedule(expr, runScheduledVideo, { timezone: 'UTC' });
  }
  logger.info('VideoAgent schedule: daily at 3:00 AM, 9:00 AM, 3:00 PM and 9:00 PM UTC');

  // Stream watchdogs, storage cleanup, resume-on-start
  const natureSupervisor = require('../services/natureStreamSupervisor');
  const footballSupervisor = require('../services/footballStreamSupervisor');
  const storageCleanup = require('../services/storageCleanup');

  natureSupervisor.startWatchdogCron();
  footballSupervisor.startWatchdogCron();
  storageCleanup.startStorageCleanupCron();

  natureSupervisor.resumeLiveOnStartup().catch((err) => {
    logger.error(`[NatureStream] Startup resume failed: ${err.message}`);
  });
  footballSupervisor.resumeLiveOnStartup().catch((err) => {
    logger.error(`[FootballStream] Startup resume failed: ${err.message}`);
  });
}

module.exports = { startSchedules };
