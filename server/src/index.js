const express = require('express');
const path = require('path');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const AgentOrchestrator = require('./agents/AgentOrchestrator');

// Route imports
const booksRouter = require('./routes/books');
const genresRouter = require('./routes/genres');
const editorsRouter = require('./routes/editors');
const searchRouter = require('./routes/search');
const statsRouter = require('./routes/stats');
const adminRouter = require('./routes/admin');
const recommendationsRouter = require('./routes/recommendations');

async function startServer() {
  // Connect to MongoDB
  await connectDB(config.mongoUri);

  const app = express();

  // Middleware
  app.use(corsMiddleware);
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
  app.use('/api/recommendations', recommendationsRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Fallback: serve the frontend for non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../../project/Reviewer Insight.html'));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  // Initialize agent orchestrator
  const orchestrator = new AgentOrchestrator();
  app.set('orchestrator', orchestrator);

  // Start scheduled agent runs (only if API keys are configured)
  if (config.openaiKey && config.openaiKey !== 'sk-your-openai-key-here') {
    orchestrator.startSchedule();
  } else {
    logger.warn('OpenAI API key not configured — agent scheduling disabled');
  }

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
