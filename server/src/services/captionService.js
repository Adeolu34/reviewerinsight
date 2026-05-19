const fs = require('fs');
const OpenAI = require('openai');
const logger = require('../utils/logger');

// Whisper requires a direct OpenAI key — OpenRouter doesn't support audio transcription
function _getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function generateCaptions(audioPath) {
  const openai = _getClient();
  if (!openai) {
    logger.warn('[Captions] OPENAI_API_KEY not set — skipping word-level captions');
    return null;
  }
  if (!fs.existsSync(audioPath)) {
    logger.warn(`[Captions] Audio file not found: ${audioPath}`);
    return null;
  }

  try {
    logger.info('[Captions] Transcribing audio for word-level captions…');
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    const captions = (response.words || [])
      .map(w => ({
        word:    w.word.trim(),
        startMs: Math.round(w.start * 1000),
        endMs:   Math.round(w.end   * 1000),
      }))
      .filter(w => w.word);

    logger.info(`[Captions] ${captions.length} word timestamps generated`);
    return captions;
  } catch (err) {
    logger.error(`[Captions] Transcription failed: ${err.message}`);
    return null; // Non-fatal — video renders without captions
  }
}

module.exports = { generateCaptions };
