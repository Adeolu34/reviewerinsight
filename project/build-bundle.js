/**
 * Bundles the Babel-compiled scripts into two minified, content-hashed files and patches the HTML:
 *   compiled/site.<hash>.js   — public site (loaded on every page)
 *   compiled/admin.<hash>.js  — admin UI (lazy-loaded only on the admin route)
 *
 * The scripts share one global scope (top-level const/function declarations plus window.X
 * assignments), so plain concatenation in the original load order is equivalent to the
 * previous many-<script> setup. Run via: npm run build:web
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const root = __dirname;
const compiled = path.join(root, 'compiled');
const htmlFile = path.join(root, 'Reviewer Insight.html');

const SITE_ORDER = [
  'components/ApiClient.js', 'components/Primitives.js', 'components/Cover.js', 'components/Home.js',
  'components/Browse.js', 'components/Review.js', 'components/Recommend.js', 'components/OtherPages.js',
  'components/Authors.js', 'app.js',
];
const ADMIN_ORDER = ['components/Admin.js'];

function bundle(files) {
  const code = files
    .map((f) => fs.readFileSync(path.join(compiled, f), 'utf8'))
    .join('\n;\n');
  // transform (not bundle): keeps top-level names intact, only minifies whitespace/syntax/locals
  return esbuild.transformSync(code, { minify: true, target: 'es2019', legalComments: 'none' }).code;
}

function emit(name, code) {
  const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 10);
  const file = `${name}.${hash}.js`;
  fs.writeFileSync(path.join(compiled, file), code);
  return file;
}

// Remove previous bundles
for (const f of fs.readdirSync(compiled)) {
  if (/^(site|admin)\.[0-9a-f]{10}\.js$/.test(f)) fs.unlinkSync(path.join(compiled, f));
}

const siteFile = emit('site', bundle(SITE_ORDER));
const adminFile = emit('admin', bundle(ADMIN_ORDER));

const START = '<!--BUNDLE:START-->';
const END = '<!--BUNDLE:END-->';
let html = fs.readFileSync(htmlFile, 'utf8');
const crlf = html.includes('\r\n');
html = html.replace(/\r\n/g, '\n');

const block = [
  START,
  `<script defer src="compiled/admin-path.js?v=${adminFile.split('.')[1]}"></script>`,
  `<script defer src="compiled/${siteFile}"></script>`,
  END,
].join('\n');

if (html.includes(START)) {
  html = html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length);
} else {
  // First run: replace the old list of individual compiled scripts
  const first = html.indexOf('<script defer src="compiled/components/ApiClient.js');
  const lastMarker = '<script defer src="compiled/app.js"></script>';
  const last = html.indexOf(lastMarker) + lastMarker.length;
  if (first < 0 || last < lastMarker.length) throw new Error('Could not find script block to replace');
  html = html.slice(0, first) + block + html.slice(last);
}
fs.writeFileSync(htmlFile, crlf ? html.replace(/\n/g, '\r\n') : html);

// Tiny non-inline script that tells app.jsx where the admin bundle lives (CSP forbids inline scripts)
fs.writeFileSync(
  path.join(compiled, 'admin-path.js'),
  `window.__ADMIN_BUNDLE='compiled/${adminFile}';\n`,
);

const kb = (f) => (fs.statSync(path.join(compiled, f)).size / 1024).toFixed(1);
console.log(`site:  ${siteFile} (${kb(siteFile)} KB)`);
console.log(`admin: ${adminFile} (${kb(adminFile)} KB)`);
