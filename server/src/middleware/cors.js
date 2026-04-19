const cors = require('cors');

module.exports = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (file://, mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // In production, restrict to your domain
    const allowed = [process.env.FRONTEND_URL].filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
});
