const { listen } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let srv;
let adminToken;
let publishedId;

const json = (r) => r.json();
const auth = (t) => ({ authorization: `Bearer ${t}` });

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ri-test');
  process.env.ADMIN_INITIAL_EMAIL = 'admin@test.local';
  process.env.ADMIN_INITIAL_PASSWORD = 'correct-horse-battery';

  await mongoose.connect(process.env.MONGODB_URI);
  const { createApp } = require('../src/index');
  const adminRouter = require('../src/routes/admin');
  await adminRouter.seedInitialAdmin();

  const Book = require('../src/models/Book');
  await Book.syncIndexes();
  const pub = await Book.create({
    title: 'The Test Book', author: 'Ada Tester', genre: 'Fiction', status: 'published', rating: 4,
    editor: 'Mira Okafor', year: 2024, blurb: 'A story about </script> testing.',
  });
  await Book.create({ title: 'Hidden Draft', author: 'Ada Tester', genre: 'Fiction', status: 'discovered' });
  publishedId = String(pub._id);

  srv = await listen(createApp());
});

test.after(async () => {
  if (srv) await srv.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('health reports db up', async () => {
  const r = await fetch(`${srv.base}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await json(r)).db, 'up');
});

test('security headers are present and strict', async () => {
  const r = await fetch(`${srv.base}/api/health`);
  const csp = r.headers.get('content-security-policy');
  assert.ok(csp.includes("script-src 'self' https://unpkg.com"));
  assert.ok(!csp.includes("'unsafe-eval'"));
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(!csp.includes('fonts.googleapis') && !csp.includes('fonts.gstatic'), 'fonts are self-hosted');
  assert.ok(r.headers.get('strict-transport-security'));
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('public books API only lists published books and paginates safely', async () => {
  let r = await fetch(`${srv.base}/api/books`);
  const body = await json(r);
  assert.equal(body.total, 1);
  assert.equal(body.books[0].title, 'The Test Book');
  r = await fetch(`${srv.base}/api/books?page=abc&limit=-5`);
  assert.equal(r.status, 200, 'junk paging falls back instead of erroring');
});

test('NoSQL operator injection in query params is rejected', async () => {
  for (const q of ['genre[$ne]=x', 'editor[$regex]=.*', 'q=a&q=b']) {
    const r = await fetch(`${srv.base}/api/books?${q}`);
    assert.equal(r.status, 400, q);
  }
});

test('authors letter filter does not build regexes from user input', async () => {
  const t0 = Date.now();
  const r = await fetch(`${srv.base}/api/authors?letter=${encodeURIComponent('(a+)+$')}`);
  assert.equal(r.status, 200);
  assert.ok(Date.now() - t0 < 2000);
});

test('book detail: invalid id is a 400, unknown id is a 404', async () => {
  assert.equal((await fetch(`${srv.base}/api/books/not-an-id`)).status, 400);
  assert.equal((await fetch(`${srv.base}/api/books/${new mongoose.Types.ObjectId()}`)).status, 404);
  assert.equal((await fetch(`${srv.base}/api/books/${publishedId}`)).status, 200);
});

test('admin routes require authentication', async () => {
  for (const p of ['/api/admin/overview', '/api/admin/books', '/api/admin/videos', '/api/admin/scraped-books',
    '/api/admin/nature-live/status', '/api/admin/football-live/status', '/api/admin/youtube/status']) {
    const r = await fetch(srv.base + p);
    assert.equal(r.status, 401, p);
  }
});

test('login: bad input and wrong credentials are rejected without leaking details', async () => {
  const post = (body) => fetch(`${srv.base}/api/admin/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ email: { $ne: '' }, password: { $ne: '' } })).status, 400);
  const wrongPw = await post({ email: 'admin@test.local', password: 'nope' });
  const noUser = await post({ email: 'ghost@test.local', password: 'nope' });
  assert.equal(wrongPw.status, 401);
  assert.equal(noUser.status, 401);
  assert.deepEqual(await json(wrongPw), await json(noUser), 'same error for unknown user and wrong password');
});

test('login succeeds and the token unlocks admin routes', async () => {
  const r = await fetch(`${srv.base}/api/admin/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.local', password: 'correct-horse-battery' }),
  });
  assert.equal(r.status, 200);
  adminToken = (await json(r)).token;
  assert.ok(adminToken);

  const o = await fetch(`${srv.base}/api/admin/overview`, { headers: auth(adminToken) });
  assert.equal(o.status, 200);
  const b = await fetch(`${srv.base}/api/admin/books?status=published`, { headers: auth(adminToken) });
  assert.equal(b.status, 200);
  assert.equal((await json(b)).total, 1);
});

test('admin book PATCH validates fields', async () => {
  const patch = (body) => fetch(`${srv.base}/api/admin/books/${publishedId}`, {
    method: 'PATCH', headers: { ...auth(adminToken), 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await patch({ status: 'hacked' })).status, 400);
  assert.equal((await patch({ rating: 99 })).status, 400);
  assert.equal((await patch({ title: 'ignored field' })).status, 400, 'non-whitelisted fields are not applied');
  const ok = await patch({ featured: true });
  assert.equal(ok.status, 200);
  assert.equal((await json(ok)).book.featured, true);
});

test('media token: scoped, short-lived, and the only token accepted in URLs', async () => {
  const mt = await fetch(`${srv.base}/api/admin/nature-live/media-token`, { method: 'POST', headers: auth(adminToken) });
  assert.equal(mt.status, 200);
  const media = (await json(mt)).token;

  // Media token cannot be used as an admin credential
  assert.equal((await fetch(`${srv.base}/api/admin/overview`, { headers: auth(media) })).status, 401);
  // Admin JWT in the URL is not accepted
  const viaAdmin = await fetch(`${srv.base}/api/admin/nature-live/rain/preview?token=${adminToken}`);
  assert.equal(viaAdmin.status, 401);
  // Media token in the URL passes auth (route itself may 404 when no preview exists)
  const viaMedia = await fetch(`${srv.base}/api/admin/nature-live/rain/preview?token=${media}`);
  assert.notEqual(viaMedia.status, 401);
  // ...but not on non-media paths
  const other = await fetch(`${srv.base}/api/admin/nature-live/status?token=${media}`);
  assert.equal(other.status, 401);
});

test('YouTube OAuth callback reflects nothing executable', async () => {
  const evil = '"><script>alert(1)</script>';
  for (const p of ['/api/admin/youtube/callback', '/api/admin/nature-live/youtube/callback', '/api/admin/football-live/youtube/callback']) {
    const r = await fetch(`${srv.base}${p}?error=${encodeURIComponent(evil)}`);
    const html = await r.text();
    assert.ok(!html.includes('<script>alert'), p);
    assert.ok(!/<script>/.test(html), `${p}: no inline script`);
  }
});

test('video streaming honours Range requests and rejects bad ones', async () => {
  const VideoJob = require('../src/models/VideoJob');
  const file = path.join(os.tmpdir(), `ri-test-${Date.now()}.mp4`);
  fs.writeFileSync(file, Buffer.alloc(1000, 7));
  const job = await VideoJob.create({ bookId: new mongoose.Types.ObjectId(), status: 'done', videoPath: file });
  const url = `${srv.base}/videos/${job._id}/stream`;

  const full = await fetch(url);
  assert.equal(full.status, 200);
  assert.equal((await full.arrayBuffer()).byteLength, 1000);

  const part = await fetch(url, { headers: { range: 'bytes=100-199' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 100-199/1000');
  assert.equal((await part.arrayBuffer()).byteLength, 100);

  assert.equal((await fetch(url, { headers: { range: 'bytes=abc-' } })).status, 416);
  assert.equal((await fetch(url, { headers: { range: 'bytes=5000-6000' } })).status, 416);
  fs.unlinkSync(file);
});

test('SEO page: book HTML is escaped and JSON-LD cannot break out', async () => {
  const r = await fetch(`${srv.base}/book/${publishedId}/the-test-book`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(html.includes('The Test Book'));
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(ld.length > 0, 'has JSON-LD');
  for (const m of ld) assert.doesNotThrow(() => JSON.parse(m[1]));
  assert.ok(!html.includes('A story about </script>'));
});

test('sitemap and feed render', async () => {
  const s = await fetch(`${srv.base}/sitemap.xml`);
  assert.equal(s.status, 200);
  assert.ok((await s.text()).includes('<urlset'));
  assert.equal((await fetch(`${srv.base}/feed.xml`)).status, 200);
});

test('unknown API route is a JSON 404', async () => {
  const r = await fetch(`${srv.base}/api/nope`);
  assert.equal(r.status, 404);
  assert.equal((await json(r)).error, 'API endpoint not found');
});

// Regression guard for the admin router split: every authenticated GET must resolve its lazy requires
// and respond without a 5xx (catches wrong relative require() paths that only fail at request time).
test('all authenticated admin GET endpoints respond without server errors', async () => {
  const paths = [
    '/runs', '/costs', '/overview', '/books', '/analytics', '/editors/stats', '/system', '/duplicates',
    '/author-stats', '/authors', '/youtube/status', '/youtube/auth-url', '/videos', '/video-stats',
    '/scraped-books', '/nature-live/status', '/football-live/status',
  ];
  const failures = [];
  for (const p of paths) {
    const r = await fetch(`${srv.base}/api/admin${p}`, { headers: auth(adminToken) });
    if (r.status >= 500) failures.push(`${p} -> ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  assert.deepEqual(failures, []);
});

test('frontend: single hashed bundle is immutable-cached, admin code is not in the page', async () => {
  const html = await (await fetch(`${srv.base}/`)).text();
  const site = /compiled\/(site\.[0-9a-f]{10}\.js)/.exec(html);
  assert.ok(site, 'HTML references the hashed site bundle');
  assert.ok(!/compiled\/admin\.[0-9a-f]{10}\.js/.test(html), 'admin bundle is lazy-loaded, not in the HTML');
  assert.ok(/<main|skip-link|id="root"/.test(html));
  const r = await fetch(`${srv.base}/compiled/${site[1]}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /immutable/);
  assert.equal(html.includes('<script>'), false, 'no inline scripts in the page shell');
});

test('self-hosted fonts: every file referenced by the HTML and fonts.css is served', async () => {
  const html = await (await fetch(`${srv.base}/`)).text();
  const css = await (await fetch(`${srv.base}/fonts/fonts.css`)).text();
  const urls = new Set([
    ...[...html.matchAll(/href="(fonts\/[^"]+\.woff2)"/g)].map((m) => m[1]),
    ...[...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => `fonts/${m[1]}`),
  ]);
  assert.ok(urls.size >= 6, 'latin and latin-ext faces are declared');
  assert.ok([...urls].some((u) => u.includes('latin-ext')), 'latin-ext subset is included');
  for (const u of urls) {
    const r = await fetch(`${srv.base}/${u}`);
    assert.equal(r.status, 200, u);
    assert.match(r.headers.get('cache-control') || '', /immutable/, u);
  }
});

// Keep last: exhausts the login limiter for this IP
test('login is rate limited after repeated failures', async () => {
  let last;
  for (let i = 0; i < 12; i++) {
    last = await fetch(`${srv.base}/api/admin/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.local', password: `bad-${i}` }),
    });
  }
  assert.equal(last.status, 429);
});
