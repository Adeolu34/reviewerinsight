const { runPipeline } = require('./pipeline');
const logger = require('../utils/logger');

// Load all persona configs
const personas = {
  'Mira Okafor': require('./prompts/miraOkafor'),
  'Jules Park': require('./prompts/julesPark'),
  'Dae Han': require('./prompts/daeHan'),
  'Noor Saleh': require('./prompts/noorSaleh'),
};

class EditorAgent {
  constructor(editorName) {
    this.persona = personas[editorName];
    if (!this.persona) {
      throw new Error(`Unknown editor: "${editorName}". Available: ${Object.keys(personas).join(', ')}`);
    }
    this.name = editorName;
    this.running = false;
  }

  async run(options = {}) {
    if (this.running) {
      logger.warn(`Agent ${this.name} is already running. Skipping.`);
      return null;
    }

    this.running = true;
    try {
      const runId = await runPipeline(this.persona, options);
      return runId;
    } finally {
      this.running = false;
    }
  }

  static getAvailableEditors() {
    return Object.keys(personas);
  }

  static getPersona(editorName) {
    return personas[editorName] || null;
  }
}

module.exports = EditorAgent;
