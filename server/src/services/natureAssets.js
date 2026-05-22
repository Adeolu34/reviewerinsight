const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const logger = require('../utils/logger');
const { getTheme } = require('../config/natureThemes');
const { generateSoundEffectFile } = require('./elevenLabs');
const { downloadNatureVideo } = require('./stockVideo');

const execFileAsync = promisify(execFile);

function getNatureLiveDir() {
  return process.env.NATURE_LIVE_DIR || path.join(__dirname, '../../../nature-live');
}

function themeDir(themeId) {
  const dir = path.join(getNatureLiveDir(), themeId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function runFfmpeg(args, label) {
  return execFileAsync(ffmpegPath(), args, { maxBuffer: 20 * 1024 * 1024 })
    .catch((err) => {
      const msg = err.stderr || err.message || String(err);
      throw new Error(`ffmpeg ${label}: ${msg.slice(0, 500)}`);
    });
}

function getAudioProviderPreference() {
  const pref = (process.env.NATURE_AUDIO_PROVIDER || 'auto').trim().toLowerCase();
  if (['elevenlabs', 'freesound', 'noise'].includes(pref)) return pref;
  return 'auto';
}

/**
 * Ambient audio: ElevenLabs SFX → Freesound CC0 → ffmpeg procedural noise.
 */
async function downloadAmbientAudio(theme, destPath, durationSec = 30) {
  const prompt = theme.audioPrompt || theme.audioQuery;
  const pref = getAudioProviderPreference();

  const tryElevenLabs = pref === 'elevenlabs' || pref === 'auto';
  if (tryElevenLabs && process.env.ELEVENLABS_API_KEY) {
    try {
      await generateSoundEffectFile(prompt, destPath, {
        durationSeconds: Math.min(30, durationSec),
        promptInfluence: parseFloat(process.env.NATURE_ELEVENLABS_INFLUENCE || '0.65', 10),
        loop: process.env.NATURE_ELEVENLABS_LOOP !== 'false',
      });
      await trimAudioFade(destPath, durationSec);
      return { path: destPath, source: 'elevenlabs' };
    } catch (err) {
      logger.warn(`[NatureAssets] ElevenLabs SFX failed (${err.message})`);
      if (pref === 'elevenlabs') throw err;
    }
  } else if (pref === 'elevenlabs') {
    throw new Error('ELEVENLABS_API_KEY not set (NATURE_AUDIO_PROVIDER=elevenlabs)');
  }

  if (pref === 'freesound' || pref === 'auto') {
    try {
      await downloadFreesoundAudio(theme.audioQuery, destPath, durationSec);
      return { path: destPath, source: 'freesound' };
    } catch (err) {
      logger.warn(`[NatureAssets] Freesound failed (${err.message})`);
      if (pref === 'freesound') throw err;
    }
  }

  await generateNoiseAmbient(destPath, durationSec, theme.id);
  return { path: destPath, source: 'noise' };
}

async function trimAudioFade(destPath, durationSec) {
  const trimmed = destPath.replace(/\.mp3$/, '_trim.mp3');
  await runFfmpeg([
    '-y', '-i', destPath,
    '-t', String(durationSec),
    '-af', `afade=t=in:st=0:d=2,afade=t=out:st=${durationSec - 2}:d=2`,
    '-c:a', 'libmp3lame', '-q:a', '4',
    trimmed,
  ], 'trim-elevenlabs');
  fs.renameSync(trimmed, destPath);
}

/**
 * Download ambient audio from Freesound (CC0 filter).
 */
async function downloadFreesoundAudio(query, destPath, durationSec = 30) {
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) {
    logger.warn('[NatureAssets] FREESOUND_API_KEY missing — using ffmpeg ambient noise');
    return generateNoiseAmbient(destPath, durationSec, query);
  }

  const q = encodeURIComponent(query);
  const filter = encodeURIComponent('license:"Creative Commons 0"');
  const url = `https://freesound.org/apiv2/search/text/?query=${q}&filter=${filter}&fields=id,name,previews,duration&page_size=5`;

  const json = await new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'ReviewerInsight/1.0', Authorization: `Token ${apiKey}` },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });

  const results = json.results || [];
  const pick = results.find((r) => r.duration >= 20 && r.duration <= 120) || results[0];
  if (!pick?.previews?.['preview-hq-mp3'] && !pick?.previews?.['preview-lq-mp3']) {
    return generateNoiseAmbient(destPath, durationSec, query);
  }

  const previewUrl = pick.previews['preview-hq-mp3'] || pick.previews['preview-lq-mp3'];
  await downloadHttps(previewUrl, destPath);

  const trimmed = destPath.replace(/\.mp3$/, '_trim.mp3');
  await runFfmpeg([
    '-y', '-i', destPath,
    '-t', String(durationSec),
    '-af', 'afade=t=in:st=0:d=2,afade=t=out:st=' + (durationSec - 2) + ':d=2',
    '-c:a', 'libmp3lame', '-q:a', '4',
    trimmed,
  ], 'trim-audio');
  fs.renameSync(trimmed, destPath);
  return destPath;
}

function downloadHttps(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadHttps(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    }).on('error', reject);
  });
}

/** Procedural ambient when no Freesound key or no results */
async function generateNoiseAmbient(destPath, durationSec, flavor) {
  const flavorMap = {
    rain: '0.3',
    thunder: '0.25',
    wind: '0.2',
    ocean: '0.15',
    birds: '0.1',
    breeze: '0.18',
    footsteps: '0.12',
  };
  const id = Object.keys(flavorMap).find((k) => (flavor || '').includes(k)) || 'rain';
  const vol = flavorMap[id] || '0.2';

  await runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', `anoisesrc=d=${durationSec}:c=pink:a=${vol}`,
    '-af', `afade=t=in:st=0:d=2,afade=t=out:st=${durationSec - 2}:d=2,lowpass=f=800`,
    '-c:a', 'libmp3lame', '-q:a', '4',
    destPath,
  ], 'noise-ambient');
  return destPath;
}

/**
 * Build seamless ~30s loop: duplicate with short crossfade at seam.
 */
async function buildSeamlessAudioLoop(srcPath, destPath, loopSec = 30) {
  const fade = 1.5;
  const d = loopSec;
  const filter = [
    `[0:a]afade=t=in:st=0:d=${fade},afade=t=out:st=${d - fade}:d=${fade}[a0]`,
    `[1:a]afade=t=in:st=0:d=${fade},afade=t=out:st=${d - fade}:d=${fade}[a1]`,
    `[a0][a1]acrossfade=d=${fade}:c1=tri:c2=tri[out]`,
  ].join(';');

  await runFfmpeg([
    '-y',
    '-i', srcPath,
    '-i', srcPath,
    '-filter_complex', filter,
    '-map', '[out]',
    '-t', String(d),
    '-c:a', 'libmp3lame', '-q:a', '4',
    destPath,
  ], 'seamless-audio');
  return destPath;
}

async function normalizeVideoLoop(srcPath, destPath, maxSec = 45) {
  await runFfmpeg([
    '-y', '-i', srcPath,
    '-t', String(maxSec),
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-an',
    destPath,
  ], 'normalize-video');
  return destPath;
}

async function extractThumbnail(videoPath, thumbPath) {
  await runFfmpeg([
    '-y', '-i', videoPath,
    '-ss', '2',
    '-vframes', '1',
    '-q:v', '2',
    thumbPath,
  ], 'thumbnail');
  return thumbPath;
}

/**
 * Generate audio_loop.mp3, video_loop.mp4, thumbnail.jpg for a theme.
 */
async function generateAssetsForTheme(themeId) {
  const theme = getTheme(themeId);
  if (!theme) throw new Error(`Unknown theme: ${themeId}`);

  const dir = themeDir(themeId);
  const rawAudio = path.join(dir, 'audio_raw.mp3');
  const audioPath = path.join(dir, 'audio_loop.mp3');
  const rawVideo = path.join(dir, 'video_raw.mp4');
  const videoPath = path.join(dir, 'video_loop.mp4');
  const thumbnailPath = path.join(dir, 'thumbnail.jpg');

  logger.info(`[NatureAssets] Generating assets for ${themeId}`);

  const audioResult = await downloadAmbientAudio(theme, rawAudio, 30);
  await buildSeamlessAudioLoop(rawAudio, audioPath, 30);

  let videoProvider = null;
  try {
    const videoResult = await downloadNatureVideo(theme.videoQuery, rawVideo);
    videoProvider = videoResult.provider;
    await normalizeVideoLoop(rawVideo, videoPath, 45);
  } catch (err) {
    logger.warn(`[NatureAssets] Stock video failed (${err.message}) — color loop fallback`);
    await runFfmpeg([
      '-y',
      '-f', 'lavfi', '-i', 'color=c=0x1a3a2a:s=1920x1080:d=30',
      '-vf', 'fps=30',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-t', '30',
      videoPath,
    ], 'fallback-video');
  }

  await extractThumbnail(videoPath, thumbnailPath);

  if (fs.existsSync(rawAudio)) fs.unlinkSync(rawAudio);
  if (fs.existsSync(rawVideo)) fs.unlinkSync(rawVideo);

  return {
    audioPath,
    videoPath,
    thumbnailPath,
    title: theme.title,
    description: theme.description,
    audioSource: audioResult.source,
    videoProvider,
  };
}

module.exports = {
  getNatureLiveDir,
  themeDir,
  generateAssetsForTheme,
};
