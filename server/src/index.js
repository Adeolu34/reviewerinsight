const express = require('express');
const path = require('path');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const corsMiddleware = require('./middleware/cors');
const securityHeaders = require('./middleware/securityHeaders');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const AgentOrchestrator = require('./agents/AgentOrchestrator');
const BackfillAgent = require('./agents/BackfillAgent');

// Route imports
const booksRouter = require('./routes/books');
const genresRouter = require('./routes/genres');
const editorsRouter = require('./routes/editors');
const searchRouter = require('./routes/search');
const statsRouter = require('./routes/stats');
const adminRouter = require('./routes/admin');
const scraperRouter = require('./routes/scraper');
const recommendationsRouter = require('./routes/recommendations');
const trendingRouter = require('./routes/trending');
const sitemapRouter = require('./routes/sitemap');
const feedRouter = require('./routes/feed');
const seoMiddleware = require('./middleware/seoMiddleware');

async function startServer() {
  // Connect to MongoDB
  await connectDB(config.mongoUri);

  if (typeof adminRouter.seedInitialAdmin === 'function') {
    await adminRouter.seedInitialAdmin();
  }

  const app = express();

  // Middleware
  app.use(corsMiddleware);
  app.use(securityHeaders);
  app.use(express.json());

  // Serve the frontend static files
  app.use(express.static(path.join(__dirname, '../../project')));

  // API routes
  app.use('/api/books', booksRouter);
  app.use('/api/genres', genresRouter);
  app.use('/api/editors', editorsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin', scraperRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/books', trendingRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Sitemap + RSS feed (before catch-all)
  app.use(sitemapRouter);
  app.use(feedRouter);

  // Fallback: serve the frontend with SEO meta injection for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    seoMiddleware(req, res, next);
  });

  // Error handler (must be last)
  app.use(errorHandler);

  // Initialize agent orchestrator
  const orchestrator = new AgentOrchestrator();
  app.set('orchestrator', orchestrator);

  // Start scheduled agent runs (only if API keys are configured)
  if (config.openaiKey && config.openaiKey !== 'sk-your-openai-key-here') {
    orchestrator.startSchedule();

    // Continuous backfill: catches all books stuck in incomplete states
    // (metadata_complete, failed, published-no-chapters) every 20 minutes
    const backfillAgent = new BackfillAgent();
    app.set('backfillAgent', backfillAgent);
    backfillAgent.startSchedule();
  } else {
    logger.warn('OpenAI API key not configured — agent scheduling disabled');
  }

  const cron = require('node-cron');
  const { runAllScrapers } = require('./services/scrapers');
  const { autoImportBatch } = require('./services/autoImport');

  // Daily scrape: all sources at 1:00 AM UTC (before agent runs)
  cron.schedule('0 1 * * *', async () => {
    logger.info('[Scraper] Scheduled daily scrape started');
    try {
      await runAllScrapers('scheduled');
      logger.info('[Scraper] Scheduled daily scrape completed');
    } catch (err) {
      logger.error(`[Scraper] Scheduled scrape failed: ${err.message}`);
    }
  }, { timezone: 'UTC' });
  logger.info('Scraper schedule: daily at 1:00 AM UTC');

  // Auto-import: promote pending scraped books into the review queue every 30 min
  cron.schedule('*/30 * * * *', async () => {
    try {
      const stats = await autoImportBatch(500);
      if (stats.imported > 0) {
        logger.info(`[AutoImport] ${stats.imported} books added to review queue`);
      }
    } catch (err) {
      logger.error(`[AutoImport] Batch failed: ${err.message}`);
    }
  }, { timezone: 'UTC' });
  logger.info('AutoImport schedule: every 30 minutes');

  app.listen(config.port, () => {
    logger.info(`Reviewer Insight server running on http://localhost:${config.port}`);
    logger.info(`Frontend: http://localhost:${config.port}`);
    logger.info(`API: http://localhost:${config.port}/api/books`);
  });

  return app;
}

startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
