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
   * Schedule: All 4 editors run every 6 hours, staggered by 15 minutes.
   *   :00 UTC — Mira Okafor  (50 books × 4 runs = 200/day)
   *   :15 UTC — Jules Park   (50 books × 4 runs = 200/day)
   *   :30 UTC — Dae Han      (50 books × 4 runs = 200/day)
   *   :45 UTC — Noor Saleh   (50 books × 4 runs = 200/day)
   * Total: ~800 books/day reviewed
   */
  startSchedule() {
    const schedule = [
      { cron: '0 */6 * * *',  editor: 'Mira Okafor', batchSize: 50 },
      { cron: '15 */6 * * *', editor: 'Jules Park',  batchSize: 50 },
      { cron: '30 */6 * * *', editor: 'Dae Han',     batchSize: 50 },
      { cron: '45 */6 * * *', editor: 'Noor Saleh',  batchSize: 50 },
    ];

    for (const { cron: cronExpr, editor, batchSize } of schedule) {
      const job = cron.schedule(cronExpr, async () => {
        logger.info(`Scheduled run triggered for ${editor} (batch: ${batchSize})`);
        try {
          await this.runAgent(editor, { batchSize });
        } catch (err) {
          logger.error(`Scheduled run failed for ${editor}: ${err.message}`);
        }
      }, { timezone: 'UTC' });

      this.scheduledJobs.push(job);
      logger.info(`Scheduled ${editor}: ${cronExpr} UTC (batch: ${batchSize})`);
    }

    logger.info('Agent orchestrator started — 4 editors × every 6h × 50 books = ~800 books/day');
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
