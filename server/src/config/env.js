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
  openaiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  openaiDailyBudget: parseFloat(process.env.OPENAI_DAILY_BUDGET_USD) || 3.0,
  googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY,
  nytApiKey: process.env.NYT_BOOKS_API_KEY,
  adminApiKey: process.env.ADMIN_API_KEY,
  jwtSecret: process.env.JWT_SECRET || process.env.ADMIN_API_KEY || 'reviewer-insight-default-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
};
