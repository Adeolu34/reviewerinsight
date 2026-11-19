const cors = require('cors');

function allowedOrigins() {
  const list = [process.env.FRONTEND_URL, process.env.PUBLIC_SITE_URL, process.env.SITE_URL]
    .filter(Boolean)
    .map((u) => u.trim().replace(/\/+$/, ''));
  return new Set(list);
}

module.exports = cors((req, callback) => {
  const origin = req.headers.origin;
  const base = { credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'] };

  // No Origin header: same-origin navigation, curl, server-to-server
  if (!origin) return callback(null, { ...base, origin: true });
  if (process.env.NODE_ENV !== 'production') return callback(null, { ...base, origin: true });

  // Same-origin requests (browsers send Origin on POST) are always allowed
  let sameHost = false;
  try { sameHost = new URL(origin).host === req.headers.host; } catch (_) { /* invalid origin */ }
  const ok = sameHost || allowedOrigins().has(origin.replace(/\/+$/, ''));

  // Disallowed origins simply get no CORS headers (browser blocks) instead of a 500 error
  return callback(null, { ...base, origin: ok });
});
