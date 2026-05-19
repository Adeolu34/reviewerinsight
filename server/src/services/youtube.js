const { google } = require('googleapis');
const fs = require('fs');
const logger = require('../utils/logger');

async function _getRefreshToken() {
  if (process.env.YOUTUBE_REFRESH_TOKEN) return process.env.YOUTUBE_REFRESH_TOKEN;
  const AppSetting = require('../models/AppSetting');
  const setting = await AppSetting.findOne({ key: 'youtube_refresh_token' });
  return setting?.value || null;
}

async function isConfigured() {
  const token = await _getRefreshToken();
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && token);
}

async function getClient() {
  const token = await _getRefreshToken();
  if (!token) throw new Error('YouTube refresh token not configured');
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob',
  );
  auth.setCredentials({ refresh_token: token });
  return auth;
}

/**
 * Upload an MP4 file to YouTube.
 * @param {Object} opts
 * @param {string} opts.filePath       - Absolute path to the MP4
 * @param {string} opts.title          - Video title (max 100 chars)
 * @param {string} opts.description
 * @param {string[]} [opts.tags]
 * @param {string} [opts.privacyStatus] - 'public' | 'unlisted' | 'private'
 * @returns {Promise<{ videoId: string, videoUrl: string }>}
 */
async function uploadVideo({ filePath, title, description, tags = [], privacyStatus = 'public' }) {
  if (!(await isConfigured())) throw new Error('YouTube credentials not configured');
  if (!fs.existsSync(filePath)) throw new Error(`Video file not found: ${filePath}`);

  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });
  const stat = fs.statSync(filePath);

  logger.info(`[YouTube] Uploading "${title}" (${(stat.size / 1024 / 1024).toFixed(1)} MB)…`);

  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title:           title.slice(0, 100),
        description,
        tags,
        categoryId:      '27',  // Education
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
