const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const AppSetting      = require('../models/AppSetting');
const FootballStream  = require('../models/FootballStream');
const footballYoutube = require('../services/footballYoutube');
const supervisor      = require('../services/footballStreamSupervisor');
const requireAdmin    = require('../middleware/requireAdmin');
const logger          = require('../utils/logger');

const router = express.Router();

function oauthPopupPage(ok, msg) {
  return `<!DOCTYPE html><html>
<head><title>Football YouTube ${ok ? 'Connected' : 'Error'}</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#111;color:#eee">
<script>
if(window.opener){window.opener.postMessage(${JSON.stringify(ok ? 'football-youtube-connected' : `football-youtube-error:${msg}`)},'*');window.close();}
else{document.body.innerHTML='<h2 style="color:${ok ? '#10B981' : '#EF4444'}">${ok ? 'Connected! You can close this tab.' : 'Error: ' + msg}</h2>';}
</script>
</body></html>`;
}

// ─── PUBLIC OAuth callback ───────────────────────────────────────
router.get('/youtube/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(oauthPopupPage(false, error));
  if (!code)  return res.send(oauthPopupPage(false, 'no_code'));

  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    return res.send(oauthPopupPage(false, 'YOUTUBE_CLIENT_ID/SECRET not set'));
  }

  const redirectUri = footballYoutube.getRedirectUri(req);
  const oauth2      = footballYoutube.createOAuth2Client(redirectUri);

  try {
    const { tokens } = await oauth2.getToken(code.trim());
    if (!tokens.refresh_token) {
      return res.send(oauthPopupPage(false, 'No refresh_token — revoke app access and reconnect'));
    }
    await AppSetting.findOneAndUpdate(
      { key: footballYoutube.REFRESH_TOKEN_KEY },
      { $set: { value: tokens.refresh_token } },
      { upsert: true },
    );
    logger.info('[FootballYouTube] Refresh token saved via OAuth');
    return res.send(oauthPopupPage(true, 'connected'));
  } catch (err) {
    logger.error(`[FootballYouTube] OAuth callback: ${err.message}`);
    return res.send(oauthPopupPage(false, err.message.slice(0, 120)));
  }
});

router.use(requireAdmin);

// ─── STATUS ─────────────────────────────────────────────────────
router.get('/status', async (req, res, next) => {
  try {
    const dbSetting = await AppSetting.findOne({ key: footballYoutube.REFRESH_TOKEN_KEY });
    const fromEnv   = !!process.env.FOOTBALL_YOUTUBE_REFRESH_TOKEN;
    const fromDb    = !!dbSetting?.value;
    const connected = fromEnv || fromDb;

    let channelName = null;
    let channelId   = null;
    if (connected) {
      try {
        const info  = await footballYoutube.getChannelInfo();
        channelName = info.channelName;
        channelId   = info.channelId;
      } catch (_) {}
    }

    let doc = await FootballStream.findOne({ streamId: 'football' });
    if (!doc) doc = await FootballStream.create({ streamId: 'football' });

    let youtubeLifeCycle = null;
    if (doc.youtubeBroadcastId && ['live', 'preview', 'starting'].includes(doc.status)) {
      try {
        const b = await footballYoutube.getBroadcastStatus(doc.youtubeBroadcastId);
        youtubeLifeCycle = b?.status?.lifeCycleStatus || null;
      } catch (_) {}
    }

    const videoPath    = process.env.FOOTBALL_VIDEO_PATH || '/var/data/reviewinsight/football/mynewstream.mp4';
    const videoExists  = fs.existsSync(videoPath);
    const videoBytes   = videoExists ? fs.statSync(videoPath).size : 0;

    res.json({
      youtube: {
        connected,
        source:           fromEnv ? 'env' : fromDb ? 'database' : null,
        clientConfigured: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
        redirectUri:      footballYoutube.getRedirectUri(req),
        channelName,
        channelId,
      },
      stream: {
        ...doc.toObject(),
        youtubeLifeCycle,
        encoderRunning: supervisor.isRunning(),
      },
      videoPath,
      videoExists,
      videoBytes,
    });
  } catch (err) { next(err); }
});

// ─── YouTube OAUTH ───────────────────────────────────────────────
router.get('/youtube/auth-url', async (req, res, next) => {
  try {
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
      return res.status(400).json({ error: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET' });
    }
    const redirectUri = footballYoutube.getRedirectUri(req);
    const oauth2      = footballYoutube.createOAuth2Client(redirectUri);
    const authUrl     = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope:       footballYoutube.LIVE_SCOPES,
      prompt:      'consent',
      state:       'football',
    });
    res.json({ authUrl, redirectUri });
  } catch (err) { next(err); }
});

router.delete('/youtube/disconnect', async (req, res, next) => {
  try {
    await AppSetting.deleteOne({ key: footballYoutube.REFRESH_TOKEN_KEY });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── CHANNEL CONFIG ──────────────────────────────────────────────
router.get('/youtube/channel', async (req, res, next) => {
  try {
    const channel = await footballYoutube.getChannel();
    res.json({
      id:          channel.id,
      title:       channel.snippet?.title,
      description: channel.snippet?.description,
      country:     channel.snippet?.country,
      language:    channel.snippet?.defaultLanguage,
      keywords:    channel.brandingSettings?.channel?.keywords?.split(' ').filter(Boolean) || [],
      unsubscribedTrailer:   channel.brandingSettings?.channel?.unsubscribedTrailer || null,
      featuredChannelsTitle: channel.brandingSettings?.channel?.featuredChannelsTitle || null,
      featuredChannelsUrls:  channel.brandingSettings?.channel?.featuredChannelsUrls || [],
      bannerUrl:             channel.brandingSettings?.image?.bannerExternalUrl || null,
      statistics: {
        subscribers: channel.statistics?.subscriberCount,
        views:       channel.statistics?.viewCount,
        videos:      channel.statistics?.videoCount,
      },
    });
  } catch (err) { next(err); }
});

router.patch('/youtube/channel', async (req, res, next) => {
  try {
    const allowed = [
      'title', 'description', 'keywords', 'country', 'defaultLanguage',
      'unsubscribedTrailer', 'featuredChannelsUrls', 'featuredChannelsTitle',
    ];
    const opts = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) opts[key] = req.body[key];
    }
    if (!Object.keys(opts).length) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }
    const result = await footballYoutube.updateChannel(opts);
    res.json({ ok: true, channelId: result.id });
  } catch (err) { next(err); }
});

router.post('/youtube/channel/banner',
  express.raw({ type: ['image/jpeg', 'image/png'], limit: '10mb' }),
  async (req, res, next) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No image body. Send raw JPEG or PNG bytes with matching Content-Type.' });
      }
      const os  = require('os');
      const ext = req.headers['content-type'] === 'image/png' ? 'png' : 'jpg';
      const tmp = path.join(os.tmpdir(), `football-banner-${Date.now()}.${ext}`);
      await fs.promises.writeFile(tmp, req.body);
      try {
        const result = await footballYoutube.uploadChannelBanner(tmp);
        fs.promises.unlink(tmp).catch(() => {});
        res.json({ ok: true, bannerUrl: result.bannerUrl });
      } catch (uploadErr) {
        fs.promises.unlink(tmp).catch(() => {});
        next(uploadErr);
      }
    } catch (err) { next(err); }
  }
);

// ─── VIDEO UPLOAD ────────────────────────────────────────────────
// POST /api/admin/football-live/upload-video
// Stream raw MP4 body directly to FOOTBALL_VIDEO_PATH (no size limit, no memory buffering).
// Set Content-Type: video/mp4 on the request.
router.post('/upload-video', requireAdmin, async (req, res, next) => {
  try {
    const videoPath = process.env.FOOTBALL_VIDEO_PATH || '/var/data/reviewinsight/football/mynewstream.mp4';
    const dir = path.dirname(videoPath);
    await fs.promises.mkdir(dir, { recursive: true });

    const tmpPath = `${videoPath}.uploading`;
    const writeStream = fs.createWriteStream(tmpPath);

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
      try {
        await fs.promises.rename(tmpPath, videoPath);
        const stat = fs.statSync(videoPath);
        logger.info(`[FootballLive] Video uploaded: ${(stat.size / 1024 / 1024).toFixed(1)} MB → ${videoPath}`);
        res.json({ ok: true, videoPath, bytes: stat.size });
      } catch (err) { next(err); }
    });

    writeStream.on('error', (err) => {
      fs.promises.unlink(tmpPath).catch(() => {});
      next(err);
    });
    req.on('error', (err) => {
      fs.promises.unlink(tmpPath).catch(() => {});
      next(err);
    });
  } catch (err) { next(err); }
});

// ─── STREAM METADATA ─────────────────────────────────────────────
// PATCH /api/admin/football-live/stream
// Body: { title, description, tags, categoryId, privacyStatus }
// If the stream is live/preview, also updates the YouTube broadcast in real-time.
router.patch('/stream', async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'tags', 'categoryId', 'privacyStatus'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields provided (title, description, tags, categoryId, privacyStatus)' });
    }

    const doc = await FootballStream.findOneAndUpdate(
      { streamId: 'football' },
      { $set: updates },
      { new: true, upsert: true },
    );

    // Push title/description/tags/categoryId to YouTube if stream is active
    if (doc.youtubeBroadcastId && ['live', 'preview', 'starting'].includes(doc.status)) {
      const { privacyStatus: _p, ...ytUpdates } = updates;
      if (Object.keys(ytUpdates).length) {
        try {
          await footballYoutube.updateBroadcastMetadata(doc.youtubeBroadcastId, ytUpdates);
        } catch (ytErr) {
          logger.warn(`[FootballLive] Could not update live broadcast: ${ytErr.message}`);
        }
      }
    }

    res.json({ ok: true, stream: doc });
  } catch (err) { next(err); }
});

// ─── STREAM CONTROL ──────────────────────────────────────────────
router.post('/prepare', async (req, res, next) => {
  try {
    const doc = await supervisor.prepareStream();
    res.json({ ok: true, stream: doc, message: 'Encoder starting — YouTube preview in ~20s. Open Studio link when status is preview.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/go-live', async (req, res, next) => {
  try {
    const doc = await supervisor.publishStream();
    res.json({ ok: true, stream: doc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** One-click: prepare + auto go-live (set FOOTBALL_SKIP_PREVIEW=true to skip testing phase) */
router.post('/start', async (req, res, next) => {
  try {
    const doc = await supervisor.startStream();
    res.json({ ok: true, stream: doc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/stop', async (req, res, next) => {
  try {
    await supervisor.stopStream();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/broadcast-status', async (req, res, next) => {
  try {
    const doc = await FootballStream.findOne({ streamId: 'football' });
    if (!doc?.youtubeBroadcastId) return res.json({ configured: false });
    const broadcast = await footballYoutube.getBroadcastStatus(doc.youtubeBroadcastId);
    res.json({
      configured:      true,
      lifeCycleStatus: broadcast?.status?.lifeCycleStatus || null,
      streamStatus:    broadcast?.status?.streamStatus    || null,
      privacyStatus:   broadcast?.status?.privacyStatus   || null,
      youtubeWatchUrl:  doc.youtubeWatchUrl,
      youtubeStudioUrl: doc.youtubeStudioUrl || `https://studio.youtube.com/video/${doc.youtubeBroadcastId}/livestreaming`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
