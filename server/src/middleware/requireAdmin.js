const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const config = require('../config/env');

const MIN_LEGACY_KEY_LENGTH = 24;

/** Constant-time string comparison (avoids leaking key content via timing). */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * JWT auth middleware with legacy API key fallback.
 * Only full admin tokens are accepted here; short-lived "media" tokens (scope: 'media')
 * are accepted solely by the media-URL middleware, which sets req.mediaAuthed.
 */
async function requireAdmin(req, res, next) {
  if (req.mediaAuthed === true) return next();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret, { algorithms: ['HS256'] });
      if (!decoded.scope) {
        const user = await AdminUser.findById(decoded.userId);
        if (user) {
          req.admin = user;
          return next();
        }
      }
    } catch (err) {
      // Token invalid/expired — fall through
    }
  }

  // Fallback: legacy API key (must be long enough to resist guessing)
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_API_KEY;
  if (key && expected && expected.length >= MIN_LEGACY_KEY_LENGTH && safeEqual(key, expected)) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Allows <video src="...?token=..."> style requests (cannot send headers) using a
 * short-lived, scope-limited media token. Only valid for GET on preview/export-test paths.
 */
function mediaTokenAuth(req, res, next) {
  if (req.method === 'GET' && /\/(preview|export-test)/.test(req.path) && typeof req.query.token === 'string' && !req.headers.authorization) {
    try {
      const decoded = jwt.verify(req.query.token, config.jwtSecret, { algorithms: ['HS256'] });
      if (decoded.scope === 'media') req.mediaAuthed = true;
    } catch (_) { /* fall through to requireAdmin → 401 */ }
  }
  next();
}

function signMediaToken(userId) {
  return jwt.sign({ userId: String(userId || 'legacy'), scope: 'media' }, config.jwtSecret, { expiresIn: '30m' });
}

module.exports = requireAdmin;
module.exports.mediaTokenAuth = mediaTokenAuth;
module.exports.signMediaToken = signMediaToken;
