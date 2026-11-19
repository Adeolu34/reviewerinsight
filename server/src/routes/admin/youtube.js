const express = require('express');
const path = require('path');
const requireAdmin = require('../../middleware/requireAdmin');
const router = express.Router();

// GET /api/admin/youtube/status
router.get('/youtube/status', async (req, res, next) => {
  try {
    const AppSetting = require('../../models/AppSetting');
    const dbSetting = await AppSetting.findOne({ key: 'youtube_refresh_token' });
    const fromEnv = !!process.env.YOUTUBE_REFRESH_TOKEN;
    const fromDb  = !!dbSetting?.value;
    const connected = fromEnv || fromDb;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI
      || `${req.protocol}://${req.get('host')}/api/admin/youtube/callback`;

    let channelName = null;
    let channelId   = null;
    if (connected) {
      try {
        const { getClient } = require('../../services/youtube');
        const { google } = require('googleapis');
        const auth = await getClient();
        const yt   = google.youtube({ version: 'v3', auth });
        const ch   = await yt.channels.list({ part: ['snippet'], mine: true });
        const item = ch.data.items?.[0];
        channelName = item?.snippet?.title || null;
        channelId   = item?.id || null;
      } catch (_) {}
    }

    res.json({
      connected,
      source:          fromEnv ? 'env' : fromDb ? 'database' : null,
      clientConfigured: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
      redirectUri,
      channelName,
      channelId,
    });
  } catch (err) { next(err); }
});

// GET /api/admin/youtube/auth-url — returns the Google OAuth URL for the popup
router.get('/youtube/auth-url', async (req, res, next) => {
  try {
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
      return res.status(400).json({ error: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your environment first' });
    }
    const { google } = require('googleapis');
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI
      || `${req.protocol}://${req.get('host')}/api/admin/youtube/callback`;
    const oauth2 = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      redirectUri,
    );
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
      prompt: 'consent',
    });
    res.json({ authUrl, redirectUri });
  } catch (err) { next(err); }
});

// DELETE /api/admin/youtube/disconnect — removes stored token
router.delete('/youtube/disconnect', async (req, res, next) => {
  try {
    const AppSetting = require('../../models/AppSetting');
    await AppSetting.deleteOne({ key: 'youtube_refresh_token' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/admin/youtube/channel — fetch current channel settings
router.get('/youtube/channel', requireAdmin, async (req, res, next) => {
  try {
    const { getChannel } = require('../../services/youtube');
    const channel = await getChannel();
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

// PATCH /api/admin/youtube/channel — update channel branding settings
// Body: { title, description, keywords, country, defaultLanguage,
//         unsubscribedTrailer, featuredChannelsUrls, featuredChannelsTitle }
router.patch('/youtube/channel', requireAdmin, async (req, res, next) => {
  try {
    const { updateChannel } = require('../../services/youtube');
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
    const result = await updateChannel(opts);
    res.json({ ok: true, channelId: result.id });
  } catch (err) { next(err); }
});

// POST /api/admin/youtube/channel/banner — upload channel banner image
// Send raw image bytes in request body; set Content-Type to image/jpeg or image/png
// Recommended: min 2048x1152px, max 10 MB
router.post('/youtube/channel/banner', requireAdmin,
  express.raw({ type: ['image/jpeg', 'image/png'], limit: '10mb' }),
  async (req, res, next) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No image body. Send raw JPEG or PNG bytes with matching Content-Type.' });
      }
      const fs    = require('fs');
      const os    = require('os');
      const ext   = req.headers['content-type'] === 'image/png' ? 'png' : 'jpg';
      const tmp   = path.join(os.tmpdir(), `yt-banner-${Date.now()}.${ext}`);
      await fs.promises.writeFile(tmp, req.body);

      try {
        const { uploadChannelBanner } = require('../../services/youtube');
        const result = await uploadChannelBanner(tmp);
        fs.promises.unlink(tmp).catch(() => {});
        res.json({ ok: true, bannerUrl: result.bannerUrl });
      } catch (uploadErr) {
        fs.promises.unlink(tmp).catch(() => {});
        next(uploadErr);
      }
    } catch (err) { next(err); }
  }
);

// ─── VIDEO JOBS ─────────────────────────────────────────────────

module.exports = router;
