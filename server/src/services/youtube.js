const { google } = require('googleapis');
const fs = require('fs');
const logger = require('../utils/logger');

function isConfigured() {
  return !!(
    process.env.YOUTUBE_CLIENT_ID &&
    process.env.YOUTUBE_CLIENT_SECRET &&
    process.env.YOUTUBE_REFRESH_TOKEN
  );
}

function getClient() {
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob',
  );
  auth.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return auth;
}

/**
 * Upload an MP4 file to YouTube and return the video ID.
 * @param {Object} opts
 * @param {string} opts.filePath   - Absolute path to the MP4
 * @param {string} opts.title      - Video title (max 100 chars)
 * @param {string} opts.description - Video description
 * @param {string[]} [opts.tags]   - Tag array
 * @param {string} [opts.privacyStatus] - 'public' | 'unlisted' | 'private'
 * @returns {Promise<{ videoId: string, videoUrl: string }>}
 */
async function uploadVideo({ filePath, title, description, tags = [], privacyStatus = 'public' }) {
  if (!isConfigured()) throw new Error('YouTube credentials not configured (YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN)');
  if (!fs.existsSync(filePath)) throw new Error(`Video file not found: ${filePath}`);

  const auth    = getClient();
  const yt      = google.youtube({ version: 'v3', auth });
  const stat    = fs.statSync(filePath);

  logger.info(`[YouTube] Uploading "${title}" (${(stat.size / 1024 / 1024).toFixed(1)} MB)…`);

  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title:       title.slice(0, 100),
        description,
        tags,
        categoryId: '27',  // Education
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: 'video/mp4',
      body:     fs.createReadStream(filePath),
    },
  });

  const videoId  = res.data.id;
  const videoUrl = `https://youtu.be/${videoId}`;
  logger.info(`[YouTube] Upload complete → ${videoUrl}`);
  return { videoId, videoUrl };
}

module.exports = { uploadVideo, isConfigured };
