const express = require('express');
const fs = require('fs');
const path = require('path');
const AppSetting = require('../models/AppSetting');
const NatureStream = require('../models/NatureStream');
const { NATURE_THEMES } = require('../config/natureThemes');
const natureYoutube = require('../services/natureYoutube');
const stockVideo = require('../services/stockVideo');
const freesound = require('../services/freesound');
const { generateAssetsForTheme, buildPreviewMux, themeDir } = require('../services/natureAssets');
const natureExportManager = require('../services/natureExportManager');
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

// Allow <video src="/api/.../preview?token=..."> (cannot send Authorization header on media elements)
router.use((req, res, next) => {
  if (req.method === 'GET' && /\/(preview|export-test)/.test(req.path) && req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

router.use(requireAdmin);

function mediaFileStats(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false, bytes: 0 };
  const st = fs.statSync(filePath);
  return { exists: true, bytes: st.size };
}

async function resolvePreviewPath(doc) {
  if (doc.previewPath && fs.existsSync(doc.previewPath)) {
    const st = fs.statSync(doc.previewPath);
    if (st.size > 1000) return doc.previewPath;
  }
  if (!doc.videoPath || !doc.audioPath || !fs.existsSync(doc.videoPath) || !fs.existsSync(doc.audioPath)) {
    return null;
  }
  const dir = path.dirname(doc.videoPath);
  const previewPath = path.join(dir, 'preview.mp4');
  await buildPreviewMux(doc.videoPath, doc.audioPath, previewPath);
  await NatureStream.findByIdAndUpdate(doc._id, { $set: { previewPath } });
  return previewPath;
}

function sendMediaFile(res, filePath, contentType) {
  const st = fs.statSync(filePath);
  if (st.size < 500) {
    return res.status(404).json({ error: 'Media file is empty — run Build assets again' });
  }
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(st.size));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(path.resolve(filePath));
}

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
        const exportInfo = await natureExportManager.reconcileExportState(s);
        const fresh = exportInfo.recovered
          ? await NatureStream.findOne({ themeId: s.themeId }).lean()
          : s;
        const video = mediaFileStats(fresh.videoPath);
        const audio = mediaFileStats(fresh.audioPath);
        const preview = mediaFileStats(fresh.previewPath);
        const exportPath = fresh.testExportPath;
        const exportFile = mediaFileStats(exportPath);
        return {
          ...fresh,
          hasAssets: video.exists && audio.exists && video.bytes > 500 && audio.bytes > 500,
          hasPreview: preview.exists && preview.bytes > 1000,
          videoBytes: video.bytes,
          audioBytes: audio.bytes,
          previewBytes: preview.bytes,
          testExportReady: exportFile.exists && exportFile.bytes > 1_000_000,
          testExportMinutes: fresh.testExportMinutes || null,
          testExportBytes: exportFile.bytes,
          exportActive: exportInfo.exportActive,
          exportStartedAt: exportInfo.exportStartedAt || fresh.exportStartedAt,
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

// GET /api/admin/nature-live/youtube/channel — fetch channel branding & stats
router.get('/youtube/channel', async (req, res, next) => {
  try {
    const channel = await natureYoutube.getChannel();
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

// PATCH /api/admin/nature-live/youtube/channel — update channel branding settings
// Body: { title, description, keywords, country, defaultLanguage,
//         unsubscribedTrailer, featuredChannelsUrls, featuredChannelsTitle }
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
    const result = await natureYoutube.updateChannel(opts);
    res.json({ ok: true, channelId: result.id });
  } catch (err) { next(err); }
});

// POST /api/admin/nature-live/youtube/channel/banner — upload channel banner image
// Send raw JPEG or PNG bytes; set Content-Type accordingly. Min 2048x1152, max 10 MB.
router.post('/youtube/channel/banner',
  express.raw({ type: ['image/jpeg', 'image/png'], limit: '10mb' }),
  async (req, res, next) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No image body. Send raw JPEG or PNG bytes with matching Content-Type.' });
      }
      const os  = require('os');
      const ext = req.headers['content-type'] === 'image/png' ? 'png' : 'jpg';
      const tmp = path.join(os.tmpdir(), `nature-banner-${Date.now()}.${ext}`);
      await fs.promises.writeFile(tmp, req.body);
      try {
        const result = await natureYoutube.uploadChannelBanner(tmp);
        fs.promises.unlink(tmp).catch(() => {});
        res.json({ ok: true, bannerUrl: result.bannerUrl });
      } catch (uploadErr) {
        fs.promises.unlink(tmp).catch(() => {});
        next(uploadErr);
      }
    } catch (err) { next(err); }
  }
);

router.post('/stop-all', async (req, res, next) => {
  try {
    await supervisor.stopAll();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/nature-live/:themeId — edit stream metadata
// Body: { title, description, tags, categoryId }
// If the stream is currently live/preview, also updates the YouTube broadcast in real-time.
router.patch('/:themeId', async (req, res, next) => {
  try {
    const { themeId } = req.params;
    if (!NATURE_THEMES.find((t) => t.id === themeId)) {
      return res.status(404).json({ error: 'Unknown theme' });
    }

    const allowed = ['title', 'description', 'tags', 'categoryId'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields provided (title, description, tags, categoryId)' });
    }

    const { categoryId, ...dbUpdates } = updates;
    const doc = await NatureStream.findOneAndUpdate(
      { themeId },
      { $set: dbUpdates },
      { new: true },
    );

    // If there's an active broadcast, push the changes to YouTube live
    if (doc?.youtubeBroadcastId && ['live', 'preview', 'starting'].includes(doc.status)) {
      try {
        await natureYoutube.updateBroadcastMetadata(doc.youtubeBroadcastId, updates);
      } catch (ytErr) {
        logger.warn(`[NatureLive] Could not update live broadcast metadata: ${ytErr.message}`);
      }
    }

    res.json({ ok: true, stream: doc });
  } catch (err) { next(err); }
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

    if (['live', 'preview', 'starting', 'exporting'].includes(doc.status)) {
      return res.status(400).json({ error: 'Stop stream / wait for export before regenerating assets' });
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
              previewPath: assets.previewPath,
              thumbnailPath: assets.thumbnailPath,
              title: assets.title,
              description: assets.description,
              tags: assets.tags || [],
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

router.get('/:themeId/preview', async (req, res, next) => {
  try {
    const doc = await NatureStream.findOne({ themeId: req.params.themeId });
    if (!doc) return res.status(404).json({ error: 'Unknown theme' });
    const previewPath = await resolvePreviewPath(doc);
    if (!previewPath) {
      return res.status(404).json({ error: 'No assets — click Build assets first and wait until status is ready' });
    }
    return sendMediaFile(res, previewPath, 'video/mp4');
  } catch (err) {
    next(err);
  }
});

router.get('/:themeId/preview/video', async (req, res, next) => {
  try {
    const doc = await NatureStream.findOne({ themeId: req.params.themeId });
    if (!doc?.videoPath || !fs.existsSync(doc.videoPath)) {
      return res.status(404).json({ error: 'No video assets — click Build assets first' });
    }
    return sendMediaFile(res, doc.videoPath, 'video/mp4');
  } catch (err) {
    next(err);
  }
});

router.get('/:themeId/preview/audio', async (req, res, next) => {
  try {
    const doc = await NatureStream.findOne({ themeId: req.params.themeId });
    if (!doc?.audioPath || !fs.existsSync(doc.audioPath)) {
      return res.status(404).json({ error: 'No audio assets — click Build assets first' });
    }
    return sendMediaFile(res, doc.audioPath, 'audio/mpeg');
  } catch (err) {
    next(err);
  }
});

router.post('/:themeId/export-test', async (req, res, next) => {
  try {
    const { themeId } = req.params;
    if (!NATURE_THEMES.find((t) => t.id === themeId)) {
      return res.status(400).json({ error: 'Invalid theme' });
    }

    const defaultMin = parseInt(process.env.NATURE_EXPORT_DEFAULT_MINUTES, 10) || 15;
    const minutes = Math.min(Math.max(parseInt(req.body?.minutes, 10) || defaultMin, 1), 60);
    let doc = await NatureStream.findOne({ themeId });
    if (!doc?.videoPath || !doc?.audioPath || !fs.existsSync(doc.videoPath) || !fs.existsSync(doc.audioPath)) {
      return res.status(400).json({ error: 'Build assets first' });
    }

    if (doc.status === 'exporting') {
      if (natureExportManager.isActive(themeId)) {
        return res.status(400).json({ error: 'Export already running' });
      }
      await natureExportManager.resetStuckExport(themeId);
      doc = await NatureStream.findOne({ themeId });
    }

    const outPath = natureExportManager.expectedExportPath(themeId, minutes);
    await NatureStream.findByIdAndUpdate(doc._id, {
      $set: {
        status: 'exporting',
        lastError: null,
        testExportPath: outPath,
        testExportMinutes: minutes,
        exportStartedAt: new Date(),
      },
    });

    const estLo = Math.max(3, Math.round(minutes * 0.4));
    const estHi = Math.max(estLo + 2, Math.round(minutes * 1.2));
    res.json({
      ok: true,
      message: `Rendering ${minutes}-minute file (~${estLo}–${estHi} min on VPS). Status updates every 5s.`,
    });

    natureExportManager.startExport(themeId, doc, minutes).catch((err) => {
      logger.error(`[NatureExport] startExport ${themeId}: ${err.message}`);
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:themeId/export-test/cancel', async (req, res, next) => {
  try {
    await natureExportManager.cancelExport(req.params.themeId);
    res.json({ ok: true, message: 'Export cancelled' });
  } catch (err) {
    next(err);
  }
});

router.post('/:themeId/export-test/reset', async (req, res, next) => {
  try {
    const result = await natureExportManager.resetStuckExport(req.params.themeId);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

async function resolveTestExportPath(themeId) {
  let doc = await NatureStream.findOne({ themeId });
  if (!doc) return null;
  await natureExportManager.reconcileExportState(doc);
  doc = await NatureStream.findOne({ themeId });
  const minutes = doc.testExportMinutes || parseInt(process.env.NATURE_EXPORT_DEFAULT_MINUTES, 10) || 15;
  const candidate = doc.testExportPath || natureExportManager.expectedExportPath(themeId, minutes);
  if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).size > 1_000_000) {
    return { doc, filePath: candidate };
  }
  return null;
}

router.get('/:themeId/export-test/stream', async (req, res, next) => {
  try {
    const resolved = await resolveTestExportPath(req.params.themeId);
    if (!resolved) {
      return res.status(404).json({ error: 'No test export ready — wait for export to finish or reset and try again' });
    }
    res.setHeader('Content-Disposition', 'inline');
    return sendMediaFile(res, resolved.filePath, 'video/mp4');
  } catch (err) {
    next(err);
  }
});

router.get('/:themeId/export-test/download', async (req, res, next) => {
  try {
    const resolved = await resolveTestExportPath(req.params.themeId);
    if (!resolved) {
      return res.status(404).json({ error: 'No test export — wait for export to finish' });
    }
    const mins = resolved.doc.testExportMinutes || parseInt(process.env.NATURE_EXPORT_DEFAULT_MINUTES, 10) || 15;
    res.setHeader('Content-Disposition', `attachment; filename="nature-${resolved.doc.themeId}-${mins}min.mp4"`);
    return sendMediaFile(res, resolved.filePath, 'video/mp4');
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
