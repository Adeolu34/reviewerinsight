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
   * Schedule: All 4 editors run every 12 hours, staggered by 15 minutes.
   *   :00 UTC — Mira Okafor  (20 books × 2 runs = 40/day)
   *   :15 UTC — Jules Park   (20 books × 2 runs = 40/day)
   *   :30 UTC — Dae Han      (20 books × 2 runs = 40/day)
   *   :45 UTC — Noor Saleh   (20 books × 2 runs = 40/day)
   * Total: ~160 books/day reviewed
   */
  startSchedule() {
    const schedule = [
      { cron: '0 */12 * * *',  editor: 'Mira Okafor', batchSize: 20 },
      { cron: '15 */12 * * *', editor: 'Jules Park',  batchSize: 20 },
      { cron: '30 */12 * * *', editor: 'Dae Han',     batchSize: 20 },
      { cron: '45 */12 * * *', editor: 'Noor Saleh',  batchSize: 20 },
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

    logger.info('Agent orchestrator started — 4 editors × every 12h × 20 books = ~160 books/day');
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
