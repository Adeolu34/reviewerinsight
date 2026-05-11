require('dotenv').config();

const required = ['MONGODB_URI'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  mongoUri: process.env.MONGODB_URI,
  /** Canonical public origin (no trailing slash). Used for sitemap, feeds, and absolute URLs. */
  siteUrl: (() => {
    const raw = (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://reviewerinsight.com')
      .trim()
      .replace(/\/+$/, '');
    return raw || 'https://reviewerinsight.com';
  })(),
  openaiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  /** When set, all chat completions use OpenRouter (cheapest Claude default: claude-3-haiku). */
  openrouterKey: process.env.OPENROUTER_API_KEY,
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  openrouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
  openrouterHttpReferer: process.env.OPENROUTER_HTTP_REFERER || '',
  openrouterAppTitle: process.env.OPENROUTER_APP_TITLE || 'Reviewer Insight',
  openaiDailyBudget: parseFloat(process.env.OPENAI_DAILY_BUDGET_USD) || 3.0,
  googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY,
  nytApiKey: process.env.NYT_BOOKS_API_KEY,
  adminApiKey: process.env.ADMIN_API_KEY,
  jwtSecret: process.env.JWT_SECRET || process.env.ADMIN_API_KEY || 'reviewer-insight-default-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
};
