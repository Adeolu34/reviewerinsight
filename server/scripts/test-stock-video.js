#!/usr/bin/env node
/**
 * Quick check: Pexels + Pixabay search + optional small download.
 * Usage: node scripts/test-stock-video.js [--download]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const QUERY = 'rain forest';
const download = process.argv.includes('--download');

function mask(key) {
  if (!key) return '(not set)';
  if (key.length <= 8) return '***';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ReviewerInsight-Test/1.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data.slice(0, 300) });
        }
      });
    }).on('error', reject);
  });
}

async function testPexelsSearch() {
  const key = process.env.PEXELS_API_KEY || '';
  console.log(`\n[Pexels] key: ${mask(key)}`);
  if (!key) return { ok: false, error: 'PEXELS_API_KEY not set' };

  const q = encodeURIComponent(QUERY);
  const { status, body } = await fetchJson(
    `https://api.pexels.com/videos/search?query=${q}&per_page=3&orientation=landscape`,
    { Authorization: key },
  );

  if (status === 401 || status === 403) {
    return { ok: false, error: `HTTP ${status} — invalid or unauthorized API key` };
  }
  if (status !== 200) {
    return { ok: false, error: `HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}` };
  }

  const count = (body.videos || []).length;
  if (!count) return { ok: false, error: 'HTTP 200 but zero videos returned' };
  const first = body.videos[0];
  return {
    ok: true,
    count,
    sample: `${first.duration}s, files=${(first.video_files || []).length}`,
  };
}

async function testPixabaySearch() {
  const key = process.env.PIXABAY_API_KEY || '';
  console.log(`\n[Pixabay] key: ${mask(key)}`);
  if (!key) return { ok: false, error: 'PIXABAY_API_KEY not set' };

  const q = encodeURIComponent(QUERY);
  const { status, body } = await fetchJson(
    `https://pixabay.com/api/videos/?key=${key}&q=${q}&per_page=3&video_type=film&category=nature`,
  );

  if (status !== 200) {
    return { ok: false, error: `HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}` };
  }
  if (body.error) {
    return { ok: false, error: `API error: ${body.error}` };
  }

  const count = (body.hits || []).length;
  if (!count) return { ok: false, error: 'HTTP 200 but zero hits returned' };
  const first = body.hits[0];
  const renditions = Object.keys(first.videos || {}).join(', ');
  return { ok: true, count, sample: `${first.duration}s, renditions=${renditions}` };
}

async function testDownload() {
  if (!download) return;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ri-stock-'));
  console.log(`\n[Download] temp dir: ${tmp}`);

  const stockVideo = require('../src/services/stockVideo');
  const dest = path.join(tmp, 'test.mp4');
  try {
    const result = await stockVideo.downloadNatureVideo(QUERY, dest);
    const stat = fs.statSync(dest);
    console.log(`[Download] OK via ${result.provider}, ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.log(`[Download] FAIL: ${err.message}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`Query: "${QUERY}"${download ? ' (+ download)' : ''}`);

  const pexels = await testPexelsSearch();
  console.log(pexels.ok ? `[Pexels] OK — ${pexels.count} results, sample: ${pexels.sample}` : `[Pexels] FAIL — ${pexels.error}`);

  const pixabay = await testPixabaySearch();
  console.log(
    pixabay.ok
      ? `[Pixabay] OK — ${pixabay.count} results, sample: ${pixabay.sample}`
      : `[Pixabay] FAIL — ${pixabay.error}`,
  );

  await testDownload();

  const allOk = pexels.ok && pixabay.ok;
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
