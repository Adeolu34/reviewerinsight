const cron = require('node-cron');
const EditorAgent = require('./EditorAgent');
const logger = require('../utils/logger');

class AgentOrchestrator {
  constructor() {
    this.agents = {};
    this.scheduledJobs = [];

    // Initialize agents for all editors
    for (const name of EditorAgent.getAvailableEditors()) {
      this.agents[name] = new EditorAgent(name);
    }
  }

  /**
   * Start scheduled agent runs.
   * Schedule: All 4 editors run daily, staggered by 30 minutes.
   *   2:00 AM UTC — Mira Okafor  (8 books)
   *   2:30 AM UTC — Jules Park   (8 books)
   *   3:00 AM UTC — Dae Han      (7 books)
   *   3:30 AM UTC — Noor Saleh   (7 books)
   * Total: ~30 books/day
   */
  startSchedule() {
    const schedule = [
      { cron: '0 2 * * *',  editor: 'Mira Okafor', batchSize: 8 },   // Daily 2:00 AM UTC
      { cron: '30 2 * * *', editor: 'Jules Park',  batchSize: 8 },   // Daily 2:30 AM UTC
      { cron: '0 3 * * *',  editor: 'Dae Han',     batchSize: 7 },   // Daily 3:00 AM UTC
      { cron: '30 3 * * *', editor: 'Noor Saleh',  batchSize: 7 },   // Daily 3:30 AM UTC
    ];

    for (const { cron: cronExpr, editor, batchSize } of schedule) {
      const job = cron.schedule(cronExpr, async () => {
        logger.info(`Scheduled daily run triggered for ${editor} (batch: ${batchSize})`);
        try {
          await this.runAgent(editor, { batchSize });
        } catch (err) {
          logger.error(`Scheduled run failed for ${editor}: ${err.message}`);
        }
      }, { timezone: 'UTC' });

      this.scheduledJobs.push(job);
      logger.info(`Scheduled ${editor}: ${cronExpr} UTC (batch: ${batchSize})`);
    }

    logger.info('Agent orchestrator started with daily schedule (4 editors, ~30 books/day)');
  }

  /**
   * Run a specific agent on demand.
   */
  async runAgent(editorName, options = {}) {
    const agent = this.agents[editorName];
    if (!agent) {
      throw new Error(`Unknown editor: "${editorName}". Available: ${Object.keys(this.agents).join(', ')}`);
    }

    return await agent.run(options);
  }

  /**
   * Stop all scheduled jobs.
   */
  stop() {
    for (const job of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs = [];
    logger.info('Agent orchestrator stopped');
  }
}

module.exports = AgentOrchestrator;
