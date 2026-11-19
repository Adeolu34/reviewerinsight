// Shared test environment. Must be required before any app module.
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ri-test';
process.env.PUBLIC_SITE_URL = 'https://reviewerinsight.com';
process.env.ADMIN_API_KEY = '';
process.env.OPENAI_API_KEY = '';

const http = require('http');

/** Start an Express app on an ephemeral port; returns { base, close }. */
function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      resolve({
        base: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { listen };
