const { google } = require('googleapis');
const logger = require('../utils/logger');

const CALLBACK_PATH     = '/api/admin/football-live/youtube/callback';
const REFRESH_TOKEN_KEY = 'football_youtube_refresh_token';

const LIVE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
];

async function _getRefreshToken() {
  if (process.env.FOOTBALL_YOUTUBE_REFRESH_TOKEN) return process.env.FOOTBALL_YOUTUBE_REFRESH_TOKEN;
  const AppSetting = require('../models/AppSetting');
  const setting = await AppSetting.findOne({ key: REFRESH_TOKEN_KEY });
  return setting?.value || null;
}

// Football OAuth reuses the main /api/admin/youtube/callback with state=football
// so only one redirect URI needs to be registered in Google Cloud Console.
function getRedirectUri(req) {
  const explicit = process.env.YOUTUBE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (req) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    return `${proto}://${req.get('host')}/api/admin/youtube/callback`;
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
  if (!token) throw new Error('Football YouTube refresh token not configured');
  const auth = createOAuth2Client(getRedirectUri());
  auth.setCredentials({ refresh_token: token });
  return auth;
}

async function getChannelInfo() {
  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });
  const ch   = await yt.channels.list({ part: ['snippet'], mine: true });
  const item = ch.data.items?.[0];
  return { channelName: item?.snippet?.title || null, channelId: item?.id || null };
}

async function createLiveSession({ title, description = '', tags = [], categoryId = '17', privacyStatus = 'public' }) {
  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });

  const streamRes = await yt.liveStreams.insert({
    part: ['snippet', 'cdn', 'status'],
    requestBody: {
      snippet: { title: title.slice(0, 128), description: description.slice(0, 5000) },
      cdn: { frameRate: '30fps', ingestionType: 'rtmp', resolution: '1080p' },
      status: { streamStatus: 'active' },
    },
  });

  const stream           = streamRes.data;
  const streamId         = stream.id;
  const ingestionAddress = stream.cdn?.ingestionInfo?.ingestionAddress;
  const streamKey        = stream.cdn?.ingestionInfo?.streamName;

  if (!ingestionAddress || !streamKey) {
    throw new Error('YouTube did not return RTMP ingestion details');
  }

  const start = new Date(Date.now() + 60 * 1000);
  const broadcastRes = await yt.liveBroadcasts.insert({
    part: ['snippet', 'status', 'contentDetails'],
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description: description.slice(0, 5000),
        scheduledStartTime: start.toISOString(),
      },
      status: {
        privacyStatus: process.env.FOOTBALL_YOUTUBE_PRIVACY || privacyStatus,
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: false,
        enableAutoStop:  false,
        monitorStream:   { enableMonitorStream: true },
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
            description: description.slice(0, 5000),
            tags: tags.slice(0, 500),
            categoryId: String(categoryId),
          },
        },
      });
    } catch (err) {
      logger.warn(`[FootballYouTube] Could not set tags: ${err.message}`);
    }
  }

  const youtubeWatchUrl  = `https://www.youtube.com/watch?v=${broadcastId}`;
  const youtubeStudioUrl = `https://studio.youtube.com/video/${broadcastId}/livestreaming`;

  logger.info(`[FootballYouTube] Live session created broadcast=${broadcastId} stream=${streamId}`);
  return { youtubeBroadcastId: broadcastId, youtubeStreamId: streamId, ingestionAddress, streamKey, youtubeWatchUrl, youtubeStudioUrl };
}

async function transitionBroadcast(broadcastId, status) {
  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });
  await yt.liveBroadcasts.transition({ id: broadcastId, broadcastStatus: status, part: ['status'] });
  logger.info(`[FootballYouTube] Broadcast ${broadcastId} → ${status}`);
}

async function enterPreviewMode(broadcastId) {
  await transitionBroadcast(broadcastId, 'testing');
}

async function goLive(broadcastId) {
  try { await transitionBroadcast(broadcastId, 'testing'); } catch (_) {}
  await transitionBroadcast(broadcastId, 'live');
}

async function endBroadcast(broadcastId) {
  if (!broadcastId) return;
  try { await transitionBroadcast(broadcastId, 'complete'); } catch (err) {
    logger.warn(`[FootballYouTube] endBroadcast: ${err.message}`);
  }
}

async function getBroadcastStatus(broadcastId) {
  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });
  const res  = await yt.liveBroadcasts.list({ part: ['status', 'snippet'], id: [broadcastId] });
  return res.data.items?.[0] || null;
}

async function updateBroadcastMetadata(broadcastId, { title, description, tags, categoryId } = {}) {
  const auth    = await getClient();
  const yt      = google.youtube({ version: 'v3', auth });
  const current = await yt.videos.list({ part: ['snippet'], id: [broadcastId] });
  const snippet = current.data.items?.[0]?.snippet;
  if (!snippet) throw new Error(`Broadcast ${broadcastId} not found`);

  const updated = {
    ...snippet,
    ...(title !== undefined       && { title: title.slice(0, 100) }),
    ...(description !== undefined && { description: description.slice(0, 5000) }),
    ...(tags !== undefined        && { tags: tags.slice(0, 500) }),
    ...(categoryId !== undefined  && { categoryId: String(categoryId) }),
  };

  await yt.videos.update({ part: ['snippet'], requestBody: { id: broadcastId, snippet: updated } });
  logger.info(`[FootballYouTube] Broadcast ${broadcastId} metadata updated`);
}

async function getChannel() {
  if (!(await isConfigured())) throw new Error('Football YouTube credentials not configured');
  const auth = await getClient();
  const yt   = google.youtube({ version: 'v3', auth });
  const res  = await yt.channels.list({ part: ['snippet', 'brandingSettings', 'statistics'], mine: true });
  const channel = res.data.items?.[0];
  if (!channel) throw new Error('No YouTube channel found');
  return channel;
}

async function updateChannel(opts = {}) {
  if (!(await isConfigured())) throw new Error('Football YouTube credentials not configured');
  const auth    = await getClient();
  const yt      = google.youtube({ version: 'v3', auth });
  const current = await getChannel();
  const existing = current.brandingSettings || {};
  const channel  = { ...existing.channel };

  if (opts.title !== undefined)                 channel.title                  = opts.title.slice(0, 100);
  if (opts.description !== undefined)           channel.description            = opts.description.slice(0, 1000);
  if (opts.keywords !== undefined)              channel.keywords               = opts.keywords.join(' ');
  if (opts.country !== undefined)               channel.country                = opts.country;
  if (opts.defaultLanguage !== undefined)       channel.defaultLanguage        = opts.defaultLanguage;
  if (opts.unsubscribedTrailer !== undefined)   channel.unsubscribedTrailer    = opts.unsubscribedTrailer;
  if (opts.featuredChannelsUrls !== undefined)  channel.featuredChannelsUrls   = opts.featuredChannelsUrls;
  if (opts.featuredChannelsTitle !== undefined) channel.featuredChannelsTitle  = opts.featuredChannelsTitle;

  const res = await yt.channels.update({
    part: ['brandingSettings'],
    requestBody: { id: current.id, brandingSettings: { ...existing, channel } },
  });
  logger.info(`[FootballYouTube] Channel settings updated (${current.id})`);
  return res.data;
}

async function uploadChannelBanner(filePath) {
  const fs = require('fs');
  if (!(await isConfigured())) throw new Error('Football YouTube credentials not configured');
  if (!fs.existsSync(filePath)) throw new Error(`Banner file not found: ${filePath}`);

  const auth     = await getClient();
  const yt       = google.youtube({ version: 'v3', auth });
  const ext      = filePath.split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const bannerRes = await yt.channelBanners.insert({
    part: ['snippet'],
    requestBody: {},
    media: { mimeType, body: fs.createReadStream(filePath) },
  });
  const bannerUrl = bannerRes.data.url;

  const current = await getChannel();
  await yt.channels.update({
    part: ['brandingSettings'],
    requestBody: {
      id: current.id,
      brandingSettings: {
        ...current.brandingSettings,
        image: { ...current.brandingSettings?.image, bannerExternalUrl: bannerUrl },
      },
    },
  });
  logger.info(`[FootballYouTube] Channel banner updated → ${bannerUrl}`);
  return { bannerUrl };
}

module.exports = {
  REFRESH_TOKEN_KEY,
  LIVE_SCOPES,
  CALLBACK_PATH,
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
  updateBroadcastMetadata,
  getChannel,
  updateChannel,
  uploadChannelBanner,
};
