const express = require('express');
const path = require('path');
const compression = require('compression');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const corsMiddleware = require('./middleware/cors');
const securityHeaders = require('./middleware/securityHeaders');
const rateLimits = require('./middleware/rateLimits');
const sanitizeQuery = require('./middleware/sanitizeQuery');
const errorHandler = require('./middleware/errorHandler');
const seoMiddleware = require('./middleware/seoMiddleware');
const logger = require('./utils/logger');

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
const bookCanonicalRouter = require('./routes/bookCanonical');
const authorsRouter = require('./routes/authors');
const natureLiveRouter = require('./routes/natureLive');
const footballLiveRouter = require('./routes/footballLive');
const videosRouter = require('./routes/videos');

// Content-hashed bundles: compiled/site.<10 hex>.js and compiled/admin.<10 hex>.js (see project/build-bundle.js)
const HASHED_BUNDLE = /[\\/](site|admin)\.[0-9a-f]{10}\.js$/;

/** Build the Express app (no DB connection, no background jobs) — also used by tests. */
function createApp() {
  const app = express();

  // Behind Coolify/nginx — req.protocol and X-Forwarded-* for OAuth redirect URIs and rate limiting
  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(compression());
  app.use(corsMiddleware);
  app.use(securityHeaders);
  app.use(express.json({ limit: '100kb' }));

  // Rate limiting (per IP) and query hardening
  app.use('/api', rateLimits.api);
  app.use('/api', sanitizeQuery);
  app.use('/api/admin/login', rateLimits.login);
  app.use('/api/search', rateLimits.search);
  app.use('/api/recommendations', rateLimits.recommendations);

  // Sitemap + RSS before static — ensures /sitemap.xml and /feed.xml are always dynamic XML
  app.use(sitemapRouter);
  app.use(feedRouter);
  app.use(bookCanonicalRouter);

  // Frontend static files
  app.use(express.static(path.join(__dirname, '../../project'), {
    dotfiles: 'ignore',
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      // Content-hashed bundles never change at a given URL: cache for a year
      if (filePath.endsWith('.woff2') || HASHED_BUNDLE.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));

  // API routes — trendingRouter must be before booksRouter so /api/books/trending
  // isn't swallowed by booksRouter's /:id wildcard route
  app.use('/api/books', trendingRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/genres', genresRouter);
  app.use('/api/editors', editorsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/stats', statsRouter);
  // Nature Live and Football Live before /api/admin — admin router's requireAdmin blocks unmatched /api/admin/* paths
  app.use('/api/admin/nature-live', natureLiveRouter);
  app.use('/api/admin/football-live', footballLiveRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin', scraperRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/authors', authorsRouter);
  app.use('/videos', videosRouter);

  // Health check (503 when the database is down so the orchestrator can restart us)
  app.get('/api/health', (req, res) => {
    const dbUp = require('mongoose').connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  });

  // Fallback: serve the frontend with SEO meta injection for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    seoMiddleware(req, res, next);
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

async function startServer() {
  await connectDB(config.mongoUri);

  if (typeof adminRouter.seedInitialAdmin === 'function') {
    await adminRouter.seedInitialAdmin();
  }

  await require('./startup/recoverState').recoverInterruptedWork();

  const app = createApp();
  require('./startup/schedules').startSchedules(app);

  app.listen(config.port, () => {
    logger.info(`Reviewer Insight server running on http://localhost:${config.port}`);
    logger.info(`Frontend: http://localhost:${config.port}`);
    logger.info(`API: http://localhost:${config.port}/api/books`);
  });

  return app;
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
