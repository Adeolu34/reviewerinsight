const { runAuthorPipeline } = require('./authorPipeline');
const logger = require('../utils/logger');

const persona = require('./prompts/sofiaKwon');

class AuthorBioAgent {
  constructor() {
    this.persona = persona;
    this.name = persona.name;
    this.running = false;
  }

  async run(options = {}) {
    if (this.running) {
      logger.warn(`${this.name} is already running. Skipping.`);
      return null;
    }
    this.running = true;
    try {
      return await runAuthorPipeline(this.persona, options);
    } finally {
      this.running = false;
    }
  }
}

module.exports = AuthorBioAgent;
