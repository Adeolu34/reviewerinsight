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

/**
 * Fetch current channel branding/snippet settings.
 * @returns {Promise<Object>} channel data
 */
async function getChannel() {
  if (!(await isConfigured())) throw new Error('YouTube credentials not configured');
  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });

  const res = await yt.channels.list({
    part: ['snippet', 'brandingSettings', 'statistics'],
    mine: true,
  });

  const channel = res.data.items?.[0];
  if (!channel) throw new Error('No YouTube channel found for this account');
  return channel;
}

/**
 * Update channel branding settings.
 * @param {Object} opts
 * @param {string} [opts.title]                  - Channel name (max 100 chars)
 * @param {string} [opts.description]            - Channel description (max 1000 chars)
 * @param {string[]} [opts.keywords]             - Search keywords array
 * @param {string} [opts.country]                - ISO 3166-1 alpha-2 country code e.g. 'US' 'GB'
 * @param {string} [opts.defaultLanguage]        - BCP-47 language code e.g. 'en'
 * @param {string} [opts.unsubscribedTrailer]    - YouTube video ID shown to non-subscribers
 * @param {string[]} [opts.featuredChannelsUrls] - YouTube channel IDs to feature
 * @param {string} [opts.featuredChannelsTitle]  - Label above featured channels
 */
async function updateChannel(opts = {}) {
  if (!(await isConfigured())) throw new Error('YouTube credentials not configured');
  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });

  // Fetch current channel so we can merge (partial updates require the full object)
  const current = await getChannel();
  const channelId = current.id;
  const existing  = current.brandingSettings || {};

  const channel = { ...existing.channel };

  if (opts.title !== undefined)                  channel.title                  = opts.title.slice(0, 100);
  if (opts.description !== undefined)            channel.description            = opts.description.slice(0, 1000);
  if (opts.keywords !== undefined)               channel.keywords               = opts.keywords.join(' ');
  if (opts.country !== undefined)                channel.country                = opts.country;
  if (opts.defaultLanguage !== undefined)        channel.defaultLanguage        = opts.defaultLanguage;
  if (opts.unsubscribedTrailer !== undefined)    channel.unsubscribedTrailer    = opts.unsubscribedTrailer;
  if (opts.featuredChannelsUrls !== undefined)   channel.featuredChannelsUrls   = opts.featuredChannelsUrls;
  if (opts.featuredChannelsTitle !== undefined)  channel.featuredChannelsTitle  = opts.featuredChannelsTitle;

  const res = await yt.channels.update({
    part: ['brandingSettings'],
    requestBody: {
      id: channelId,
      brandingSettings: {
        ...existing,
        channel,
      },
    },
  });

  logger.info(`[YouTube] Channel settings updated for channel ${channelId}`);
  return res.data;
}

/**
 * Upload a channel banner image (JPG/PNG, min 2048x1152px recommended).
 * @param {string} filePath - Absolute path to the image file
 */
async function uploadChannelBanner(filePath) {
  if (!(await isConfigured())) throw new Error('YouTube credentials not configured');
  if (!fs.existsSync(filePath)) throw new Error(`Banner file not found: ${filePath}`);

  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });

  const ext      = filePath.split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const bannerRes = await yt.channelBanners.insert({
    part: ['snippet'],
    requestBody: {},
    media: { mimeType, body: fs.createReadStream(filePath) },
  });

  const bannerUrl = bannerRes.data.url;

  // Apply the uploaded banner to the channel
  const current = await getChannel();
  await yt.channels.update({
    part: ['brandingSettings'],
    requestBody: {
      id: current.id,
      brandingSettings: {
        ...current.brandingSettings,
        image: {
          ...current.brandingSettings?.image,
          bannerExternalUrl: bannerUrl,
        },
      },
    },
  });

  logger.info(`[YouTube] Channel banner updated → ${bannerUrl}`);
  return { bannerUrl };
}

module.exports = { uploadVideo, isConfigured, getClient, getChannel, updateChannel, uploadChannelBanner };
