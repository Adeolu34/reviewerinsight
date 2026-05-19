const logger = require('../utils/logger');

/**
 * Generate word-level caption timings from narration text + scene durations.
 * Free — no API calls. Timings are proportional to word count within each scene.
 */
function generateCaptionsFromScript(scenes) {
  const captions = [];
  let cursorMs = 0;

  for (const scene of scenes) {
    if (!scene.narration) { cursorMs += (scene.estimatedSeconds || 0) * 1000; continue; }

    const words = scene.narration.trim().split(/\s+/).filter(Boolean);
    const sceneDurationMs = Math.max((scene.estimatedSeconds || 3) * 1000, words.length * 350);
    const msPerWord = sceneDurationMs / words.length;

    words.forEach((word, i) => {
      captions.push({
        word,
        startMs: Math.round(cursorMs + i * msPerWord),
        endMs:   Math.round(cursorMs + (i + 0.88) * msPerWord),
      });
    });

    cursorMs += sceneDurationMs;
  }

  logger.info(`[Captions] Generated ${captions.length} word timings from script (no API)`);
  return captions;
}

module.exports = { generateCaptionsFromScript };
