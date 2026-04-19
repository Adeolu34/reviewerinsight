const OpenAI = require('openai');
const config = require('./env');

const openai = config.openaiKey ? new OpenAI({ apiKey: config.openaiKey }) : null;

module.exports = { openai, model: config.openaiModel };
