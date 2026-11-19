const express = require('express');
const logger = require('../../utils/logger');
const { oauthPopupPage } = require('../../utils/oauthPopup');
const router = express.Router();

// ─── GET /api/admin/youtube/callback (PUBLIC — Google redirects here) ──────────
// Handles book-review YouTube AND football YouTube via state param:
//   state=football  → stores token as football_youtube_refresh_token
//   (default)       → stores token as youtube_refresh_token
router.get('/youtube/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const isFootball = state === 'football';

  const successEvent = isFootball ? 'football-youtube-connected' : 'youtube-connected';
  const errorPrefix  = isFootball ? 'football-youtube-error'     : 'youtube-error';
  const tokenKey     = isFootball ? 'football_youtube_refresh_token' : 'youtube_refresh_token';
  const label        = isFootball ? 'Football YouTube' : 'YouTube';

  const page = (ok, msg) => res.type('html').send(oauthPopupPage({ label, ok, msg, successEvent, errorPrefix }));

  if (error) return page(false, error);
  if (!code) return page(false, 'no_code');

  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    return page(false, 'YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET not set');
  }

  const { google } = require('googleapis');
  const AppSetting = require('../../models/AppSetting');
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI
    || `${req.protocol}://${req.get('host')}/api/admin/youtube/callback`;

  const oauth2 = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri,
  );

  try {
    const { tokens } = await oauth2.getToken(code.trim());
    if (!tokens.refresh_token) {
      return page(false, 'No refresh_token returned — revoke app access in Google and try again');
    }
    await AppSetting.findOneAndUpdate(
      { key: tokenKey },
      { $set: { value: tokens.refresh_token } },
      { upsert: true }
    );
    logger.info(`[${label}] Refresh token saved to database via OAuth callback`);
    return page(true, 'connected');
  } catch (err) {
    logger.error(`[${label}] OAuth callback failed: ${err.message}`);
    return page(false, err.message.slice(0, 120));
  }
});

module.exports = router;
