/**
 * Rejects non-string query parameters (e.g. ?genre[$ne]=x or ?q=a&q=b) which qs parses into
 * objects/arrays and could otherwise be interpreted as MongoDB operators downstream.
 */
module.exports = function sanitizeQuery(req, res, next) {
  for (const value of Object.values(req.query || {})) {
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'Invalid query parameter' });
    }
  }
  next();
};
