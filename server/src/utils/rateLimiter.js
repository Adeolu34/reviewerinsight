/**
 * Token bucket rate limiter for external API calls.
 */
class RateLimiter {
  constructor({ maxTokens, refillRate, refillIntervalMs = 1000 }) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.refillIntervalMs = refillIntervalMs;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.refillIntervalMs) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire(tokens = 1) {
    this._refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }
    // Wait until enough tokens are available
    const deficit = tokens - this.tokens;
    const waitMs = (deficit / this.refillRate) * this.refillIntervalMs;
    await new Promise(r => setTimeout(r, waitMs + 50));
    this._refill();
    this.tokens -= tokens;
  }
}

// Pre-configured limiters
const googleBooksLimiter = new RateLimiter({ maxTokens: 10, refillRate: 1.0, refillIntervalMs: 1000 }); // ~1 req/s, burst 10
const openLibraryLimiter = new RateLimiter({ maxTokens: 3, refillRate: 1, refillIntervalMs: 1000 }); // 1 req/s

const rssLimiter = new RateLimiter({ maxTokens: 2, refillRate: 0.5, refillIntervalMs: 1000 }); // 1 req per 2s
const nytLimiter = new RateLimiter({ maxTokens: 5, refillRate: 0.083, refillIntervalMs: 1000 }); // ~5 req/min

module.exports = { RateLimiter, googleBooksLimiter, openLibraryLimiter, rssLimiter, nytLimiter };
