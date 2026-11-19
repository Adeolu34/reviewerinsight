require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { clampInt } = require('../src/utils/pagination');
const { parseRange } = require('../src/routes/videos');
const { oauthPopupPage, safeJson } = require('../src/utils/oauthPopup');
const { guarded, isRunning } = require('../src/utils/jobGuard');
const sanitizeQuery = require('../src/middleware/sanitizeQuery');
const requireAdmin = require('../src/middleware/requireAdmin');
const { buildJsonLd } = require('../src/middleware/seoMiddleware');

test('clampInt handles NaN, bounds and junk', () => {
  assert.equal(clampInt('abc', 5, 1, 100), 5);
  assert.equal(clampInt(undefined, 5, 1, 100), 5);
  assert.equal(clampInt('-4', 1, 1, 100), 1);
  assert.equal(clampInt('9999', 30, 1, 100), 100);
  assert.equal(clampInt('7', 30, 1, 100), 7);
});

test('parseRange: valid, open-ended, suffix and malformed headers', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=0-99999', 1000), { start: 0, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.equal(parseRange('bytes=abc-def', 1000), null);
  assert.equal(parseRange('bytes=-', 1000), null);
  assert.equal(parseRange('bytes=2000-3000', 1000), null);
  assert.equal(parseRange('bytes=50-10', 1000), null);
  assert.equal(parseRange('', 1000), null);
});

test('oauthPopupPage never emits attacker-controlled markup', () => {
  const evil = '"><script>alert(1)</script><img src=x onerror=alert(1)>';
  const html = oauthPopupPage({ label: evil, ok: false, msg: evil, successEvent: 'ok', errorPrefix: 'err' });
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!/<script>/.test(html), 'no inline script');
  assert.ok(html.includes('<script src="/oauth-popup.js"></script>'));
  assert.ok(!html.includes('postMessage'), 'logic lives in the static file');
});

test('safeJson escapes </script>, & and line separators', () => {
  const out = safeJson('</script>&' + String.fromCharCode(0x2028));
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('&'));
  assert.ok(!out.includes(String.fromCharCode(0x2028)));
});

test('buildJsonLd cannot be broken out of its <script> block', () => {
  const out = buildJsonLd({ name: '</script><script>alert(1)</script>' });
  assert.equal(out.match(/<\/script>/g).length, 1, 'only the closing tag we add');
  assert.ok(!out.includes('<script>alert'));
});

test('sanitizeQuery rejects operator objects and repeated params', () => {
  const run = (query) => {
    let status = null; let nexted = false;
    sanitizeQuery({ query }, { status(c) { status = c; return { json() {} }; } }, () => { nexted = true; });
    return { status, nexted };
  };
  assert.deepEqual(run({ q: 'x', page: '2' }), { status: null, nexted: true });
  assert.equal(run({ genre: { $ne: 'x' } }).status, 400);
  assert.equal(run({ q: ['a', 'b'] }).status, 400);
});

test('requireAdmin: media-scoped tokens are not admin tokens', async () => {
  const secret = process.env.JWT_SECRET;
  const media = jwt.sign({ userId: 'u', scope: 'media' }, secret, { expiresIn: '1m' });
  const call = async (req) => {
    let status = null; let nexted = false;
    await requireAdmin({ headers: {}, query: {}, ...req }, { status(c) { status = c; return { json() {} }; } }, () => { nexted = true; });
    return { status, nexted };
  };
  assert.equal((await call({ headers: { authorization: `Bearer ${media}` } })).status, 401);
  assert.equal((await call({ headers: {} })).status, 401);
  assert.equal((await call({ headers: { 'x-admin-key': 'short' } })).status, 401);
  assert.equal((await call({ mediaAuthed: true })).nexted, true);
});

test('mediaTokenAuth only honours media tokens on GET preview/export paths', () => {
  const secret = process.env.JWT_SECRET;
  const media = jwt.sign({ userId: 'u', scope: 'media' }, secret, { expiresIn: '1m' });
  const admin = jwt.sign({ userId: 'u' }, secret, { expiresIn: '1m' });
  const run = (req) => { const r = { headers: {}, ...req }; requireAdmin.mediaTokenAuth(r, {}, () => {}); return !!r.mediaAuthed; };
  assert.equal(run({ method: 'GET', path: '/rain/preview', query: { token: media } }), true);
  assert.equal(run({ method: 'GET', path: '/rain/export-test/stream', query: { token: media } }), true);
  assert.equal(run({ method: 'GET', path: '/rain/start', query: { token: media } }), false);
  assert.equal(run({ method: 'POST', path: '/rain/preview', query: { token: media } }), false);
  assert.equal(run({ method: 'GET', path: '/rain/preview', query: { token: admin } }), false, 'full admin JWT in URL is not accepted');
  assert.equal(run({ method: 'GET', path: '/rain/preview', query: { token: 'garbage' } }), false);
});

test('jobGuard prevents overlapping runs and swallows errors', async () => {
  let active = 0; let maxActive = 0; let calls = 0;
  const job = guarded('t-overlap', async () => {
    calls++; active++; maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 40));
    active--;
  });
  await Promise.all([job(), job(), job()]);
  assert.equal(calls, 1);
  assert.equal(maxActive, 1);
  assert.equal(isRunning('t-overlap'), false);

  const failing = guarded('t-fail', async () => { throw new Error('boom'); });
  await assert.doesNotReject(failing());
  assert.equal(isRunning('t-fail'), false, 'lock released after failure');
});
