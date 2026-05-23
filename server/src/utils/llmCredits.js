const logger = require('./logger');

const PAUSE_HOURS = parseFloat(process.env.LLM_CREDITS_PAUSE_HOURS || '6', 10);

let pausedUntil = 0;
let pauseLogged = false;

function isCreditsError(err) {
  const status = err?.status
    || parseInt(String(err?.message || '').match(/\b(402)\b/)?.[1], 10);
  if (status === 402) return true;
  const msg = (err?.message || String(err)).toLowerCase();
  return msg.includes('insufficient credits') || msg.includes('payment required');
}

function isPaused() {
  if (!pausedUntil || Date.now() >= pausedUntil) {
    if (pausedUntil && Date.now() >= pausedUntil) {
      pausedUntil = 0;
      pauseLogged = false;
    }
    return false;
  }
  return true;
}

function pauseReason() {
  if (!isPaused()) return null;
  const until = new Date(pausedUntil).toISOString();
  return `LLM credits exhausted — paused until ${until} (add OpenRouter credits or wait)`;
}

function markCreditsExhausted() {
  pausedUntil = Date.now() + PAUSE_HOURS * 3600 * 1000;
  if (!pauseLogged) {
    pauseLogged = true;
    logger.error(
      `[LLM] API credits exhausted — pausing BackfillAgent and editor runs for ${PAUSE_HOURS}h. ` +
      'Add credits: https://openrouter.ai/settings/credits'
    );
  }
}

/** Call when an LLM request fails; returns true if this was a credits error. */
function noteFailure(err) {
  if (!isCreditsError(err)) return false;
  markCreditsExhausted();
  return true;
}

function getStatus() {
  return {
    paused: isPaused(),
    pausedUntil: pausedUntil ? new Date(pausedUntil).toISOString() : null,
    pauseHours: PAUSE_HOURS,
  };
}

module.exports = {
  isCreditsError,
  isPaused,
  pauseReason,
  markCreditsExhausted,
  noteFailure,
  getStatus,
};
