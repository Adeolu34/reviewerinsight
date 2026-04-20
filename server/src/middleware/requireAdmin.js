const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const config = require('../config/env');

/**
 * JWT auth middleware with legacy API key fallback.
 */
async function requireAdmin(req, res, next) {
  // Try JWT token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret);
      const user = await AdminUser.findById(decoded.userId);
      if (user) {
        req.admin = user;
        return next();
      }
    } catch (err) {
      // Token invalid/expired — fall through
    }
  }

  // Fallback: legacy API key
  const key = req.headers['x-admin-key'];
  if (key && key === process.env.ADMIN_API_KEY) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = requireAdmin;
