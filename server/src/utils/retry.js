const logger = require('./logger');

/**
 * Retry a function with exponential backoff and jitter.
 */
async function withRetry(fn, options = {}) {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 30000, label = 'operation' } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      // Don't retry on 4xx client errors (except 429 rate limit).
      // Scrapers attach err.status when throwing; fall back to parsing the message.
      const httpStatus = error.status || parseInt((error.message || '').match(/\b([45]\d{2})\b/)?.[1]);
      if (httpStatus && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);

      logger.warn(`${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(jitter)}ms: ${error.message}`);
      await new Promise(r => setTimeout(r, jitter));
    }
  }
}

module.exports = { withRetry };
