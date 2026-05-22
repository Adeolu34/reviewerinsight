const express = require('express');
const fs = require('fs');
const path = require('path');
const AppSetting = require('../models/AppSetting');
const NatureStream = require('../models/NatureStream');
const { NATURE_THEMES } = require('../config/natureThemes');
const natureYoutube = require('../services/natureYoutube');
const stockVideo = require('../services/stockVideo');
const freesound = require('../services/freesound');
const { generateAssetsForTheme } = require('../services/natureAssets');
const supervisor = require('../services/natureStreamSupervisor');
const requireAdmin = require('../middleware/requireAdmin');
const logger = require('../utils/logger');

const router = express.Router();

function oauthPopupPage(ok, msg, eventName) {
  return `<!DOCTYPE html><html>
<head><title>Nature YouTube ${ok ? 'Connected' : 'Error'}</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#111;color:#eee">
<script>
if(window.opener){window.opener.postMessage(${JSON.stringify(ok ? eventName : `nature-youtube-error:${msg}`)},'*');window.close();}
else{document.body.innerHTML='<h2 style="color:${ok ? '#10B981' : '#EF4444'}">${ok ? 'Connected! You can close this tab.' : 'Error: ' + msg}</h2>';}
</script>
</body></html>`;
}

// ─── PUBLIC OAuth callback ───────────────────────────────────────
router.get('/youtube/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(oauthPopupPage(false, error, 'nature-youtube-connected'));
  if (!code) return res.send(oauthPopupPage(false, 'no_code', 'nature-youtube-connected'));

  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    return res.send(oauthPopupPage(false, 'YOUTUBE_CLIENT_ID/SECRET not set', 'nature-youtube-connected'));
  }

  const redirectUri = natureYoutube.getRedirectUri(req);
  const oauth2 = natureYoutube.createOAuth2Client(redirectUri);

  try {
    const { tokens } = await oauth2.getToken(code.trim());
    if (!tokens.refresh_token) {
      return res.send(oauthPopupPage(false, 'No refresh_token — revoke app access and reconnect', 'nature-youtube-connected'));
    }
    await AppSetting.findOneAndUpdate(
      { key: natureYoutube.REFRESH_TOKEN_KEY },
      { $set: { value: tokens.refresh_token } },
      { upsert: true },
    );
    logger.info('[NatureYouTube] Refresh token saved via OAuth');
    return res.send(oauthPopupPage(true, 'connected', 'nature-youtube-connected'));
  } catch (err) {
    logger.error(`[NatureYouTube] OAuth callback: ${err.message}`);
    return res.send(oauthPopupPage(false, err.message.slice(0, 120), 'nature-youtube-connected'));
  }
});

router.use(requireAdmin);

async function ensureStreamDocs() {
  for (const theme of NATURE_THEMES) {
    await NatureStream.findOneAndUpdate(
      { themeId: theme.id },
      {
        $setOnInsert: {
          themeId: theme.id,
          title: theme.title,
          description: theme.description,
          status: 'idle',
        },
      },
      { upsert: true },
    );
  }
}

// GET /api/admin/nature-live/status
router.get('/status', async (req, res, next) => {
  try {
    await ensureStreamDocs();
    const dbSetting = await AppSetting.findOne({ key: natureYoutube.REFRESH_TOKEN_KEY });
    const fromEnv = !!process.env.NATURE_YOUTUBE_REFRESH_TOKEN;
    const fromDb = !!dbSetting?.value;
    const connected = fromEnv || fromDb;

    let channelName = null;
    let channelId = null;
    if (connected) {
      try {
        const info = await natureYoutube.getChannelInfo();
        channelName = info.channelName;
        channelId = info.channelId;
      } catch (_) {}
    }

    const streams = await NatureStream.find({}).sort({ themeId: 1 }).lean();
    const liveCount = streams.filter((s) => s.status === 'live').length;

    res.json({
      youtube: {
        connected,
        source: fromEnv ? 'env' : fromDb ? 'database' : null,
        clientConfigured: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
        redirectUri: natureYoutube.getRedirectUri(req),
        channelName,
        channelId,
      },
      maxConcurrent: 7,
      liveCount,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
      audioProvider: process.env.NATURE_AUDIO_PROVIDER || 'auto',
      pexelsConfigured: !!process.env.PEXELS_API_KEY,
      pixabayConfigured: !!process.env.PIXABAY_API_KEY,
      videoProviders: stockVideo.getVideoProviders(),
      videoProvidersConfigured: stockVideo.getConfiguredProviders(),
      freesoundConfigured: freesound.isConfigured(),
      streams: await Promise.all(streams.map(async (s) => {
        let youtubeLifeCycle = null;
        if (s.youtubeBroadcastId && (s.status === 'preview' || s.status === 'live' || s.status === 'starting')) {
          try {
            const b = await natureYoutube.getBroadcastStatus(s.youtubeBroadcastId);
            youtubeLifeCycle = b?.status?.lifeCycleStatus || null;
          } catch (_) {}
        }
        return {
          ...s,
          hasAssets: !!(s.audioPath && s.videoPath && fs.existsSync(s.audioPath) && fs.existsSync(s.videoPath)),
          youtubeLifeCycle,
        };
      })),
      themes: NATURE_THEMES,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/youtube/auth-url', async (req, res, next) => {
  try {
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
      return res.status(400).json({ error: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET' });
    }
    const redirectUri = natureYoutube.getRedirectUri(req);
    const oauth2 = natureYoutube.createOAuth2Client(redirectUri);
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: natureYoutube.LIVE_SCOPES,
      prompt: 'consent',
    });
    res.json({ authUrl, redirectUri });
  } catch (err) {
    next(err);
  }
});

router.delete('/youtube/disconnect', async (req, res, next) => {
  try {
    await AppSetting.deleteOne({ key: natureYoutube.REFRESH_TOKEN_KEY });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/stop-all', async (req, res, next) => {
  try {
    await supervisor.stopAll();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:themeId/generate-assets', async (req, res, next) => {
  try {
    const { themeId } = req.params;
    if (!NATURE_THEMES.find((t) => t.id === themeId)) {
      return res.status(400).json({ error: 'Invalid theme' });
    }

    let doc = await NatureStream.findOne({ themeId });
    if (!doc) {
      const theme = NATURE_THEMES.find((t) => t.id === themeId);
      doc = await NatureStream.create({ themeId, title: theme.title, description: theme.description });
    }

    if (['live', 'preview', 'starting'].includes(doc.status)) {
      return res.status(400).json({ error: 'Stop stream before regenerating assets' });
    }

    await NatureStream.findByIdAndUpdate(doc._id, { $set: { status: 'generating', lastError: null } });

    generateAssetsForTheme(themeId)
      .then(async (assets) => {
        await NatureStream.findOneAndUpdate(
          { themeId },
          {
            $set: {
              status: 'ready',
              audioPath: assets.audioPath,
              videoPath: assets.videoPath,
              thumbnailPath: assets.thumbnailPath,
              title: assets.title,
              description: assets.description,
              assetsGeneratedAt: new Date(),
              lastError: null,
            },
          },
        );
        logger.info(`[NatureLive] Assets ready for ${themeId}`);
      })
      .catch(async (err) => {
        await NatureStream.findOneAndUpdate(
          { themeId },
          { $set: { status: 'error', lastError: err.message } },
        );
        logger.error(`[NatureLive] Asset gen failed ${themeId}: ${err.message}`);
      });

    res.json({ ok: true, message: 'Asset generation started' });
  } catch (err) {
    next(err);
  }
});

router.get('/:themeId/preview/video', async (req, res, next) => {
  try {
    const doc = await NatureStream.findOne({ themeId: req.params.themeId });
    if (!doc?.videoPath || !fs.existsSync(doc.videoPath)) {
      return res.status(404).json({ error: 'No video assets — click Regenerate first' });
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.sendFile(path.resolve(doc.videoPath));
  } catch (err) {
    next(err);
  }
});

router.get('/:themeId/preview/audio', async (req, res, next) => {
  try {
    const doc = await NatureStream.findOne({ themeId: req.params.themeId });
    if (!doc?.audioPath || !fs.existsSync(doc.audioPath)) {
      return res.status(404).json({ error: 'No audio assets — click Regenerate first' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.sendFile(path.resolve(doc.audioPath));
  } catch (err) {
    next(err);
  }
});

router.get('/:themeId/broadcast-status', async (req, res, next) => {
  try {
    const doc = await NatureStream.findOne({ themeId: req.params.themeId });
    if (!doc?.youtubeBroadcastId) {
      return res.json({ configured: false });
    }
    const broadcast = await natureYoutube.getBroadcastStatus(doc.youtubeBroadcastId);
    res.json({
      configured: true,
      lifeCycleStatus: broadcast?.status?.lifeCycleStatus || null,
      streamStatus: broadcast?.status?.streamStatus || null,
      privacyStatus: broadcast?.status?.privacyStatus || null,
      youtubeWatchUrl: doc.youtubeWatchUrl,
      youtubeStudioUrl: doc.youtubeStudioUrl || `https://studio.youtube.com/video/${doc.youtubeBroadcastId}/livestreaming`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:themeId/prepare', async (req, res, next) => {
  try {
    const doc = await supervisor.prepareStream(req.params.themeId);
    res.json({ ok: true, stream: doc, message: 'Encoder starting — YouTube preview in ~20s. Open Studio link when status is preview.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:themeId/go-live', async (req, res, next) => {
  try {
    const doc = await supervisor.publishStream(req.params.themeId);
    res.json({ ok: true, stream: doc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** One-click: prepare then auto go-live after preview window (set NATURE_SKIP_PREVIEW=true) */
router.post('/:themeId/start', async (req, res, next) => {
  try {
    const doc = await supervisor.startStream(req.params.themeId);
    res.json({ ok: true, stream: doc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:themeId/stop', async (req, res, next) => {
  try {
    await supervisor.stopEncoder(req.params.themeId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
