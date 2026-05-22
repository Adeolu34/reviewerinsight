const logger = require('../utils/logger');
const pexels = require('./pexels');
const pixabay = require('./pixabay');

const PROVIDER_HANDLERS = {
  pexels: (query, dest, opts) => pexels.downloadNatureVideo(query, dest, opts),
  pixabay: (query, dest, opts) => pixabay.downloadNatureVideo(query, dest, opts),
};

function getVideoProviders() {
  const raw = process.env.NATURE_VIDEO_PROVIDERS || 'pexels,pixabay';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((id) => PROVIDER_HANDLERS[id]);
}

function getConfiguredProviders() {
  const list = getVideoProviders();
  return list.filter((id) => {
    if (id === 'pexels') return !!pexels.getApiKey();
    if (id === 'pixabay') return !!pixabay.getApiKey();
    return false;
  });
}

/**
 * Try free stock video APIs in order until one succeeds.
 * Default order: pexels → pixabay (override with NATURE_VIDEO_PROVIDERS).
 */
async function downloadNatureVideo(query, destPath, options = {}) {
  const providers = getVideoProviders();
  const errors = [];

  for (const id of providers) {
    const handler = PROVIDER_HANDLERS[id];
    if (!handler) continue;

    if (id === 'pexels' && !pexels.getApiKey()) {
      errors.push('pexels: PEXELS_API_KEY not set');
      continue;
    }
    if (id === 'pixabay' && !pixabay.getApiKey()) {
      errors.push('pixabay: PIXABAY_API_KEY not set');
      continue;
    }

    try {
      await handler(query, destPath, options);
      logger.info(`[StockVideo] "${query}" from ${id}`);
      return { destPath, provider: id };
    } catch (err) {
      logger.warn(`[StockVideo] ${id} failed for "${query}": ${err.message}`);
      errors.push(`${id}: ${err.message}`);
    }
  }

  throw new Error(errors.length ? errors.join('; ') : 'No video providers configured');
}

module.exports = {
  downloadNatureVideo,
  getVideoProviders,
  getConfiguredProviders,
};
