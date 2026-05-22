const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// Default voice: Rachel (warm, clear, great for narration)
// https://api.elevenlabs.io/v1/voices to list available voices
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
};

/**
 * Generate speech from text using ElevenLabs TTS API.
 * Returns a Buffer of the MP3 audio data.
 */
async function generateSpeech(text, options = {}) {
  if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set in environment');

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const modelId = options.modelId || 'eleven_turbo_v2_5'; // cheapest + fast

  const body = JSON.stringify({
    text,
    model_id: modelId,
    voice_settings: { ...DEFAULT_VOICE_SETTINGS, ...(options.voiceSettings || {}) },
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`);
    const reqOptions = {
      hostname: url.hostname,
      path: `${url.pathname}?output_format=mp3_44100_128`,
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(reqOptions, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', d => { errBody += d; });
        res.on('end', () => {
          const err = new Error(`ElevenLabs ${res.statusCode}: ${errBody}`);
          err.status = res.statusCode;
          reject(err);
        });
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.setTimeout(90000, () => {
      req.destroy(new Error('ElevenLabs TTS request timed out after 90s'));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Generate speech and save to a file.
 * Returns the output file path.
 */
async function generateSpeechFile(text, outputPath, options = {}) {
  logger.info(`ElevenLabs TTS: generating ${text.length} chars → ${outputPath}`);
  const audioBuffer = await withRetry(
    () => generateSpeech(text, options),
    { maxAttempts: 3, baseDelayMs: 2000, label: 'ElevenLabs TTS' }
  );
  await fs.promises.writeFile(outputPath, audioBuffer);
  logger.info(`ElevenLabs TTS: saved ${audioBuffer.length} bytes`);
  return outputPath;
}

/**
 * Estimate audio duration from text (for scene timing).
 * Average narration pace: ~130 words/min.
 */
function estimateDurationSeconds(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil((words / 130) * 60);
}

/**
 * Get available voices from ElevenLabs.
 */
async function getVoices() {
  if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: '/v1/voices',
      method: 'GET',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    }, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Generate ambient / SFX audio via ElevenLabs Sound Effects API (not TTS voice).
 * @see https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
 */
async function generateSoundEffect(text, options = {}) {
  if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set in environment');

  const body = JSON.stringify({
    text,
    duration_seconds: options.durationSeconds ?? 30,
    prompt_influence: options.promptInfluence ?? 0.65,
    ...(options.loop ? { loop: true } : {}),
  });

  const format = options.outputFormat || 'mp3_44100_128';
  const pathQuery = `/v1/sound-generation?output_format=${encodeURIComponent(format)}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: pathQuery,
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (d) => { errBody += d; });
        res.on('end', () => {
          const err = new Error(`ElevenLabs SFX ${res.statusCode}: ${errBody.slice(0, 300)}`);
          err.status = res.statusCode;
          reject(err);
        });
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.setTimeout(120000, () => {
      req.destroy(new Error('ElevenLabs SFX request timed out after 120s'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateSoundEffectFile(text, outputPath, options = {}) {
  logger.info(`ElevenLabs SFX: "${text.slice(0, 60)}…" → ${outputPath}`);
  const audioBuffer = await withRetry(
    () => generateSoundEffect(text, options),
    { maxAttempts: 3, baseDelayMs: 3000, label: 'ElevenLabs SFX' },
  );
  await fs.promises.writeFile(outputPath, audioBuffer);
  logger.info(`ElevenLabs SFX: saved ${audioBuffer.length} bytes`);
  return outputPath;
}

module.exports = {
  generateSpeech,
  generateSpeechFile,
  generateSoundEffect,
  generateSoundEffectFile,
  estimateDurationSeconds,
  getVoices,
};
