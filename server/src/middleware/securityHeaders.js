const helmet = require('helmet');

const isProd = process.env.NODE_ENV === 'production';

// Strict CSP: no inline/eval scripts. Frontend is precompiled JSX (no in-browser Babel);
// React is loaded from unpkg with SRI hashes. Inline *styles* remain (React style props).
const csp = {
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://unpkg.com'],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'", 'data:'],
    imgSrc: ["'self'", 'data:', 'https:'],
    mediaSrc: ["'self'", 'blob:'],
    connectSrc: ["'self'", 'https://openlibrary.org', 'https://www.googleapis.com', 'https://books.google.com'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    ...(isProd ? { upgradeInsecureRequests: [] } : {}),
  },
};

module.exports = helmet({
  contentSecurityPolicy: csp,
  // Cover images/videos are loaded cross-origin by design
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
});
