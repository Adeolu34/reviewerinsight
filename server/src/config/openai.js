const OpenAI = require('openai');
const config = require('./env');

const usingOpenRouter = !!config.openrouterKey;

let openai = null;
if (usingOpenRouter) {
  const defaultHeaders = {};
  if (config.openrouterHttpReferer) {
    defaultHeaders['HTTP-Referer'] = config.openrouterHttpReferer;
  }
  if (config.openrouterAppTitle) {
    defaultHeaders['X-Title'] = config.openrouterAppTitle;
  }
  openai = new OpenAI({
    apiKey: config.openrouterKey,
    baseURL: config.openrouterBaseUrl,
    ...(Object.keys(defaultHeaders).length ? { defaultHeaders } : {}),
  });
} else if (config.openaiKey) {
  openai = new OpenAI({ apiKey: config.openaiKey });
}

const model = usingOpenRouter ? config.openrouterModel : config.openaiModel;
/** json_object mode is supported by OpenAI and Anthropic/Claude models via OpenRouter. */
const chatJsonObjectMode = true;

module.exports = {
  openai,
  model,
  usingOpenRouter,
  chatJsonObjectMode,
};
