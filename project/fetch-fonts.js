/**
 * One-off helper: downloads the Latin and Latin-Extended subsets of the site's Google Fonts into ./fonts
 * and writes fonts/fonts.css (self-hosted @font-face rules). Each subset keeps its unicode-range, so the
 * browser only downloads latin-ext when a page actually contains such characters (e.g. "Ł", "ő", "ș").
 * Identical files (variable fonts repeated per weight) are deduplicated by content hash.
 *
 * Run: node fetch-fonts.js   (commit the generated files; it is not part of the normal build)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const CSS_URL = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SUBSETS = ['latin', 'latin-ext'];
const outDir = path.join(__dirname, 'fonts');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${url} -> ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const css = (await get(CSS_URL)).toString('utf8');
  const blocks = css.split('/* ').slice(1).map((b) => ({ subset: b.split(' */')[0].trim(), face: b.slice(b.indexOf('@font-face')) }));

  const byHash = new Map(); // hash -> file name
  const faces = new Map(); // file|family|style|subset -> { weights:Set, range }
  for (const { subset, face } of blocks.filter((b) => SUBSETS.includes(b.subset))) {
    const family = /font-family: '([^']+)'/.exec(face)[1];
    const style = /font-style: (\w+)/.exec(face)[1];
    const weight = parseInt(/font-weight: (\w+)/.exec(face)[1], 10);
    const url = /url\((https:[^)]+)\)/.exec(face)[1];
    const range = /unicode-range: ([^;]+);/.exec(face)[1];
    const data = await get(url);
    const hash = crypto.createHash('sha1').update(data).digest('hex');
    if (!byHash.has(hash)) {
      const file = `${family.replace(/\s+/g, '')}-${style}-${subset}.woff2`;
      fs.writeFileSync(path.join(outDir, file), data);
      byHash.set(hash, file);
    }
    const file = byHash.get(hash);
    const key = `${file}|${family}|${style}`;
    const entry = faces.get(key) || { file, family, style, range, weights: [] };
    entry.weights.push(weight);
    faces.set(key, entry);
  }

  const rules = [...faces.values()].map(({ file, family, style, range, weights }) => {
    const lo = Math.min(...weights); const hi = Math.max(...weights);
    const w = lo === hi ? `${lo}` : `${lo} ${hi}`;
    return `@font-face{font-family:'${family}';font-style:${style};font-weight:${w};font-display:swap;src:url(${file}) format('woff2');unicode-range:${range}}`;
  });
  fs.writeFileSync(path.join(outDir, 'fonts.css'), rules.join('\n') + '\n');
  console.log([...byHash.values()].join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
