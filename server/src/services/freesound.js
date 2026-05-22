const https = require('https');
const { URLSearchParams } = require('url');
const logger = require('../utils/logger');

/**
 * Freesound API v2 credentials (https://freesound.org/apiv2/apply):
 *
 * - Client ID — only for OAuth2 "Log in with Freesound" (not needed for search/previews).
 * - Client secret / API key — use this for token auth on search + preview MP3 downloads.
 *
 * Set FREESOUND_API_KEY or FREESOUND_CLIENT_SECRET to the "Client secret/Api key" value.
 */
function getApiToken() {
  return (
    process.env.FREESOUND_API_KEY?.trim()
    || process.env.FREESOUND_CLIENT_SECRET?.trim()
    || ''
  );
}

function isConfigured() {
  return !!getApiToken();
}

function httpsRequest(options, postBody = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postBody) req.write(postBody);
    req.end();
  });
}

/**
 * Search CC0 sounds; returns parsed API JSON.
 */
async function searchCc0Sounds(query, pageSize = 5) {
  const token = getApiToken();
  if (!token) {
    throw new Error(
      'Set FREESOUND_API_KEY or FREESOUND_CLIENT_SECRET to your Freesound "Client secret/Api key" (not Client ID)',
    );
  }

  const q = encodeURIComponent(query);
  const filter = encodeURIComponent('license:"Creative Commons 0"');
  const path = `/apiv2/search/text/?query=${q}&filter=${filter}&fields=id,name,previews,duration&page_size=${pageSize}`;

  const { status, body } = await httpsRequest({
    hostname: 'freesound.org',
    path,
    method: 'GET',
    headers: {
      'User-Agent': 'ReviewerInsight-NatureLive/1.0',
      Authorization: `Token ${token}`,
    },
  });

  if (status === 401 || status === 403) {
    const hint = process.env.FREESOUND_CLIENT_ID && !process.env.FREESOUND_API_KEY
      ? ' Use the Client secret/Api key value, not Client ID.'
      : '';
    throw new Error(`Freesound auth failed HTTP ${status}${hint}`);
  }
  if (status !== 200) {
    throw new Error(`Freesound search HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  if (body?.detail) {
    throw new Error(`Freesound: ${body.detail}`);
  }

  return body;
}

/**
 * Pick best CC0 preview URL for looping ambient clip.
 */
function pickPreviewUrl(results) {
  const pick = results.find((r) => r.duration >= 20 && r.duration <= 120) || results[0];
  if (!pick) return null;
  return pick.previews?.['preview-hq-mp3'] || pick.previews?.['preview-lq-mp3'] || null;
}

/**
 * OAuth2 refresh (optional). Store FREESOUND_REFRESH_TOKEN after one-time admin OAuth if needed later.
 */
async function refreshAccessToken() {
  const clientId = process.env.FREESOUND_CLIENT_ID?.trim();
  const clientSecret = process.env.FREESOUND_CLIENT_SECRET?.trim() || getApiToken();
  const refreshToken = process.env.FREESOUND_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('FREESOUND_CLIENT_ID, FREESOUND_CLIENT_SECRET, and FREESOUND_REFRESH_TOKEN required');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString();

  const { status, body: res } = await httpsRequest({
    hostname: 'freesound.org',
    path: '/apiv2/oauth2/access_token/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (status !== 200 || !res.access_token) {
    throw new Error(`Freesound token refresh failed: ${JSON.stringify(res).slice(0, 200)}`);
  }
  logger.info('[Freesound] Access token refreshed');
  return res.access_token;
}

module.exports = {
  getApiToken,
  isConfigured,
  searchCc0Sounds,
  pickPreviewUrl,
  refreshAccessToken,
};
