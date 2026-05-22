const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function getApiKey() {
  return process.env.PEXELS_API_KEY || '';
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'ReviewerInsight-NatureLive/1.0' };
    if (getApiKey()) headers.Authorization = getApiKey();
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Pexels invalid JSON: ${data.slice(0, 200)}`));
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
        return reject(new Error(`Download failed HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

/**
 * Search Pexels videos and download first suitable MP4 (portrait or landscape).
 */
async function downloadNatureVideo(query, destPath, { minDuration = 15, maxDuration = 60 } = {}) {
  const key = getApiKey();
  if (!key) throw new Error('PEXELS_API_KEY not set');

  const q = encodeURIComponent(query);
  const searchUrl = `https://api.pexels.com/videos/search?query=${q}&per_page=15&orientation=landscape`;
  const data = await fetchJson(searchUrl);
  const videos = data.videos || [];
  if (!videos.length) throw new Error(`No Pexels videos for "${query}"`);

  for (const video of videos) {
    const dur = video.duration || 0;
    if (dur < minDuration || dur > maxDuration + 30) continue;

    const files = video.video_files || [];
    const mp4s = files
      .filter((f) => f.file_type === 'video/mp4' && f.width && f.height)
      .sort((a, b) => {
        const target = 1920 * 1080;
        const da = Math.abs(a.width * a.height - target);
        const db = Math.abs(b.width * b.height - target);
        return da - db;
      });

    const best = mp4s.find((f) => f.width >= 1280) || mp4s[0];
    if (!best?.link) continue;

    logger.info(`[Pexels] Downloading "${query}" (${best.width}x${best.height}, ${dur}s)`);
    await downloadFile(best.link, destPath);
    return destPath;
  }

  throw new Error(`No suitable Pexels MP4 for "${query}"`);
}

module.exports = { downloadNatureVideo, getApiKey };
