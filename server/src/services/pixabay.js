const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function getApiKey() {
  return process.env.PIXABAY_API_KEY || '';
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ReviewerInsight-NatureLive/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Pixabay invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'ReviewerInsight/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`Pixabay download HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

function pickBestRendition(videos) {
  const order = ['large', 'medium', 'small', 'tiny'];
  const candidates = order
    .map((k) => videos[k])
    .filter((v) => v?.url && v.width >= 1280);
  if (candidates.length) {
    return candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
  }
  for (const k of order) {
    if (videos[k]?.url) return videos[k];
  }
  return null;
}

/**
 * Search Pixabay free stock videos and download best landscape MP4.
 * @see https://pixabay.com/api/docs/
 */
async function downloadNatureVideo(query, destPath, { minDuration = 10, maxDuration = 90 } = {}) {
  const key = getApiKey();
  if (!key) throw new Error('PIXABAY_API_KEY not set');

  const q = encodeURIComponent(query);
  const searchUrl = `https://pixabay.com/api/videos/?key=${key}&q=${q}&video_type=film&category=nature&per_page=20&safesearch=true&order=popular`;
  const data = await fetchJson(searchUrl);
  const hits = data.hits || [];
  if (!hits.length) throw new Error(`No Pixabay videos for "${query}"`);

  for (const hit of hits) {
    const dur = hit.duration || 0;
    if (dur < minDuration || dur > maxDuration + 30) continue;

    const rendition = pickBestRendition(hit.videos || {});
    if (!rendition?.url) continue;

    logger.info(`[Pixabay] Downloading "${query}" (${rendition.width}x${rendition.height}, ${dur}s)`);
    await downloadFile(rendition.url, destPath);
    return destPath;
  }

  throw new Error(`No suitable Pixabay MP4 for "${query}"`);
}

module.exports = { downloadNatureVideo, getApiKey };
