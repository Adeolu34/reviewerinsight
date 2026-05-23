const { google } = require('googleapis');
const config = require('../config/env');
const logger = require('../utils/logger');

const NATURE_CALLBACK_PATH = '/api/admin/nature-live/youtube/callback';

const REFRESH_TOKEN_KEY = 'nature_youtube_refresh_token';

const LIVE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
];

async function _getRefreshToken() {
  if (process.env.NATURE_YOUTUBE_REFRESH_TOKEN) return process.env.NATURE_YOUTUBE_REFRESH_TOKEN;
  const AppSetting = require('../models/AppSetting');
  const setting = await AppSetting.findOne({ key: REFRESH_TOKEN_KEY });
  return setting?.value || null;
}

function getRedirectUri(req) {
  const explicit = process.env.NATURE_YOUTUBE_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const bookUri = process.env.YOUTUBE_REDIRECT_URI?.trim();
  if (bookUri?.includes('/api/admin/youtube/callback')) {
    return bookUri.replace('/api/admin/youtube/callback', NATURE_CALLBACK_PATH);
  }

  if (config.siteUrl) {
    return `${config.siteUrl}${NATURE_CALLBACK_PATH}`;
  }

  if (req) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    return `${proto}://${req.get('host')}${NATURE_CALLBACK_PATH}`;
  }

  return 'urn:ietf:wg:oauth:2.0:oob';
}

function createOAuth2Client(redirectUri) {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri,
  );
}

async function isConfigured() {
  const token = await _getRefreshToken();
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && token);
}

async function getClient() {
  const token = await _getRefreshToken();
  if (!token) throw new Error('Nature YouTube refresh token not configured');
  const auth = createOAuth2Client(getRedirectUri());
  auth.setCredentials({ refresh_token: token });
  return auth;
}

async function getChannelInfo() {
  const auth = await getClient();
  const yt = google.youtube({ version: 'v3', auth });
  const ch = await yt.channels.list({ part: ['snippet'], mine: true });
  const item = ch.data.items?.[0];
  return {
    channelName: item?.snippet?.title || null,
    channelId: item?.id || null,
  };
}

/**
 * Create liveStream + liveBroadcast, bind, return ingest details.
 */
async function createLiveSession({ title, description, tags = [] }) {
  const auth = await getClient();
  const yt = google.youtube({ version: 'v3', auth });

  const streamRes = await yt.liveStreams.insert({
    part: ['snippet', 'cdn', 'status'],
    requestBody: {
      snippet: { title: title.slice(0, 128), description: description?.slice(0, 5000) || '' },
      cdn: {
        frameRate: '30fps',
        ingestionType: 'rtmp',
        resolution: '1080p',
      },
      status: { streamStatus: 'active' },
    },
  });

  const stream = streamRes.data;
  const streamId = stream.id;
  const ingestionAddress = stream.cdn?.ingestionInfo?.ingestionAddress;
  const streamName = stream.cdn?.ingestionInfo?.streamName;
  if (!ingestionAddress || !streamName) {
    throw new Error('YouTube did not return RTMP ingestion details');
  }

  const start = new Date(Date.now() + 60 * 1000);
  const broadcastRes = await yt.liveBroadcasts.insert({
    part: ['snippet', 'status', 'contentDetails'],
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description: description?.slice(0, 5000) || '',
        scheduledStartTime: start.toISOString(),
      },
      status: {
        privacyStatus: process.env.NATURE_YOUTUBE_PRIVACY || 'public',
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: false,
        enableAutoStop: false,
        monitorStream: { enableMonitorStream: true },
      },
    },
  });

  const broadcastId = broadcastRes.data.id;

  await yt.liveBroadcasts.bind({
    id: broadcastId,
    part: ['id', 'contentDetails'],
    streamId,
  });

  if (tags.length > 0) {
    try {
      await yt.videos.update({
        part: ['snippet'],
        requestBody: {
          id: broadcastId,
          snippet: {
            title: title.slice(0, 100),
            description: description?.slice(0, 5000) || '',
            tags: tags.slice(0, 500),
            categoryId: '22', // People & Blogs — closest for ambient/chill live
          },
        },
      });
      logger.info(`[NatureYouTube] Tags set on broadcast ${broadcastId}`);
    } catch (err) {
      logger.warn(`[NatureYouTube] Could not set tags: ${err.message}`);
    }
  }

  const watchUrl = `https://www.youtube.com/watch?v=${broadcastId}`;
  const studioUrl = `https://studio.youtube.com/video/${broadcastId}/livestreaming`;

  logger.info(`[NatureYouTube] Live session created broadcast=${broadcastId} stream=${streamId}`);

  return {
    youtubeBroadcastId: broadcastId,
    youtubeStreamId: streamId,
    ingestionAddress,
    streamKey: streamName,
    youtubeWatchUrl: watchUrl,
    youtubeStudioUrl: studioUrl,
  };
}

async function enterPreviewMode(broadcastId) {
  await transitionBroadcast(broadcastId, 'testing');
}

async function transitionBroadcast(broadcastId, status) {
  const auth = await getClient();
  const yt = google.youtube({ version: 'v3', auth });
  await yt.liveBroadcasts.transition({
    id: broadcastId,
    broadcastStatus: status,
    part: ['status'],
  });
  logger.info(`[NatureYouTube] Broadcast ${broadcastId} → ${status}`);
}

async function goLive(broadcastId) {
  try {
    await transitionBroadcast(broadcastId, 'testing');
  } catch (err) {
    logger.warn(`[NatureYouTube] testing transition skipped: ${err.message}`);
  }
  await transitionBroadcast(broadcastId, 'live');
}

async function endBroadcast(broadcastId) {
  if (!broadcastId) return;
  try {
    await transitionBroadcast(broadcastId, 'complete');
  } catch (err) {
    logger.warn(`[NatureYouTube] endBroadcast: ${err.message}`);
  }
}

async function getBroadcastStatus(broadcastId) {
  const auth = await getClient();
  const yt = google.youtube({ version: 'v3', auth });
  const res = await yt.liveBroadcasts.list({
    part: ['status', 'snippet'],
    id: [broadcastId],
  });
  return res.data.items?.[0] || null;
}

module.exports = {
  REFRESH_TOKEN_KEY,
  LIVE_SCOPES,
  getRedirectUri,
  createOAuth2Client,
  isConfigured,
  getClient,
  getChannelInfo,
  createLiveSession,
  enterPreviewMode,
  goLive,
  endBroadcast,
  getBroadcastStatus,
  transitionBroadcast,
};
