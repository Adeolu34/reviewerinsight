const rateLimit = require('express-rate-limit');

const make = (windowMs, limit, message) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: message || 'Too many requests, please try again later' },
});

module.exports = {
  // Whole API baseline (per IP)
  api: make(15 * 60 * 1000, 600),
  // Brute-force protection for admin login
  login: make(15 * 60 * 1000, 8, 'Too many login attempts, try again in 15 minutes'),
  // Public search
  search: make(60 * 1000, 60),
  // Calls an LLM — cost-sensitive
  recommendations: make(10 * 60 * 1000, 15),
};
