const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const logger = require('../utils/logger');
const { getTheme } = require('../config/natureThemes');
const { generateSoundEffectFile, isSfxDisabled } = require('./elevenLabs');
const { downloadNatureVideo } = require('./stockVideo');
const freesound = require('./freesound');
const { getNatureAudioFilter, getNatureAudioBitrate } = require('./natureAudio');
const { openai, model } = require('../config/openai');

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

  const tryElevenLabs = (pref === 'elevenlabs' || pref === 'auto') && !isSfxDisabled();
  if (tryElevenLabs && process.env.ELEVENLABS_API_KEY) {
    try {
      await generateSoundEffectFile(prompt, destPath, {
        durationSeconds: Math.min(22, durationSec),
        promptInfluence: parseFloat(process.env.NATURE_ELEVENLABS_INFLUENCE || '0.65', 10),
        loop: process.env.NATURE_ELEVENLABS_LOOP !== 'false',
      });
      await trimAudioNoFade(destPath, durationSec);
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

/** Truncate raw audio to target duration — no fades (seamless loop builder handles transitions). */
async function trimAudioNoFade(destPath, durationSec) {
  const trimmed = destPath.replace(/\.mp3$/, '_trim.mp3');
  await runFfmpeg([
    '-y', '-i', destPath,
    '-t', String(durationSec),
    '-c:a', 'libmp3lame', '-q:a', '4',
    trimmed,
  ], 'trim-audio');
  fs.renameSync(trimmed, destPath);
}

/**
 * Download ambient audio from Freesound (CC0 filter).
 */
async function downloadFreesoundAudio(query, destPath, durationSec = 30) {
  if (!freesound.isConfigured()) {
    throw new Error('Freesound not configured (FREESOUND_API_KEY or FREESOUND_CLIENT_SECRET)');
  }

  const json = await freesound.searchCc0Sounds(query, 5);
  const results = json.results || [];
  const previewUrl = freesound.pickPreviewUrl(results);
  if (!previewUrl) {
    throw new Error(`No CC0 preview for "${query}"`);
  }
  await downloadHttps(previewUrl, destPath);

  await trimAudioNoFade(destPath, durationSec);
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
    '-af', 'lowpass=f=800',
    '-c:a', 'libmp3lame', '-q:a', '4',
    destPath,
  ], 'noise-ambient');
  return destPath;
}

/**
 * Build seamless ~30s loop: crossfade the tail into the head at the seam point.
 * When stream_loop -1 restarts the file, the audio character at the boundary is
 * continuous — imperceptible for stationary ambient sounds (rain, wind, ocean, etc.).
 */
async function buildSeamlessAudioLoop(srcPath, destPath, loopSec = 30) {
  const fade = 2.0;  // seam crossfade length (seconds)
  const bodyEnd = loopSec - fade;
  const af = getNatureAudioFilter();

  // body = raw[0 → bodyEnd] at full volume (no fades on the body itself)
  // seam = acrossfade(raw[bodyEnd → loopSec] → raw[0 → fade])
  // At the loop restart point: file ends approaching raw[fade]; restarts at raw[0].
  // For ambient noise this transition is acoustically seamless.
  const filter = [
    `[0:a]${af},atrim=0:${bodyEnd},asetpts=PTS-STARTPTS[body]`,
    `[0:a]${af},atrim=${bodyEnd}:${loopSec},asetpts=PTS-STARTPTS[tail]`,
    `[1:a]${af},atrim=0:${fade},asetpts=PTS-STARTPTS[head]`,
    `[tail][head]acrossfade=d=${fade}:c1=tri:c2=tri[seam]`,
    `[body][seam]concat=n=2:v=0:a=1[out]`,
  ].join(';');

  await runFfmpeg([
    '-y',
    '-i', srcPath,
    '-i', srcPath,
    '-filter_complex', filter,
    '-map', '[out]',
    '-t', String(loopSec),
    '-c:a', 'libmp3lame', '-q:a', '4',
    destPath,
  ], 'seamless-audio');
  return destPath;
}

async function getVideoDuration(filePath) {
  try {
    const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'quiet', '-print_format', 'json', '-show_format', filePath,
    ], { maxBuffer: 1024 * 1024 });
    const info = JSON.parse(stdout);
    return parseFloat(info.format?.duration || '0');
  } catch { return 0; }
}

/**
 * Scale, fps-normalise, and bake a seamless xfade at the loop seam so that
 * stream_loop -1 produces no visible cut when the clip wraps.
 */
async function normalizeVideoLoop(srcPath, destPath, maxSec = 45) {
  const srcDur = await getVideoDuration(srcPath);
  const loopDur = srcDur > 0 ? Math.min(maxSec, Math.floor(srcDur)) : maxSec;
  const fade = Math.min(1.5, loopDur * 0.05); // ≤5 % of duration, max 1.5 s
  const bodyDur = loopDur - fade;

  const baseFilter = [
    'scale=1920:1080:force_original_aspect_ratio=decrease',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
    'fps=30',
    'format=yuv420p',
  ].join(',');

  // Single input, split into body / tail / head — xfade tail→head at the seam.
  // End of file fades into the first `fade` seconds of the clip; on loop restart
  // the visual content is continuous.
  const filter = [
    `[0:v]${baseFilter},split=3[va][vb][vc]`,
    `[va]trim=0:${bodyDur},setpts=PTS-STARTPTS[body]`,
    `[vb]trim=${bodyDur}:${loopDur},setpts=PTS-STARTPTS[tail]`,
    `[vc]trim=0:${fade},setpts=PTS-STARTPTS[head]`,
    `[tail][head]xfade=transition=fade:duration=${fade}:offset=0[seam]`,
    `[body][seam]concat=n=2:v=1:a=0[out]`,
  ].join(';');

  await runFfmpeg([
    '-y', '-i', srcPath,
    '-filter_complex', filter,
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-an',
    destPath,
  ], 'seamless-video');
  return destPath;
}

/** ~20s mux with audio for in-browser preview (faststart for streaming). */
async function buildPreviewMux(videoPath, audioPath, destPath) {
  await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-t', '20',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', getNatureAudioBitrate(),
    '-movflags', '+faststart',
    '-shortest',
    destPath,
  ], 'preview-mux');
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

  const previewPath = path.join(dir, 'preview.mp4');
  await buildPreviewMux(videoPath, audioPath, previewPath);

  if (fs.existsSync(rawAudio)) fs.unlinkSync(rawAudio);
  if (fs.existsSync(rawVideo)) fs.unlinkSync(rawVideo);

  const metadata = await generateNatureMetadata(theme);

  return {
    audioPath,
    videoPath,
    previewPath,
    thumbnailPath,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    audioSource: audioResult.source,
    videoProvider,
  };
}

function _defaultTags(theme) {
  return [
    theme.label.toLowerCase(), 'ambient sounds', 'nature sounds', 'white noise',
    'sleep sounds', 'focus sounds', 'study music', 'relaxing sounds', '24/7 live',
    'lofi', 'calm', 'stress relief',
  ];
}

/**
 * Use OpenRouter to generate an SEO-optimised YouTube title, description and tags.
 * Falls back to the static theme strings when OpenRouter is not configured.
 */
async function generateNatureMetadata(theme) {
  if (!openai) {
    return { title: theme.title, description: theme.description, tags: _defaultTags(theme) };
  }

  const prompt = `Generate YouTube live stream metadata for an ambient nature channel.

Theme: ${theme.label}
Static title: ${theme.title}
Context: ${theme.description}

Return a JSON object with exactly these keys:
{
  "title": "YouTube title (50-70 chars, include '24/7 LIVE', main keyword, no ALL-CAPS spam)",
  "description": "YouTube description (200-350 chars, mention the sound, uses like sleep/focus/study, end with 'Reviewer Insight')",
  "tags": ["tag1","tag2",...] // 12-15 tags mixing: specific sound, 'ambient sounds', 'white noise', 'sleep sounds', 'focus music', 'study music', 'relaxing', 'nature sounds', '24/7 live', plus 3-4 niche tags
}

Return only the JSON, no markdown.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You write concise YouTube metadata for ambient nature streams. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const raw = response.choices[0].message.content || '';
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      title: String(parsed.title || theme.title).slice(0, 100),
      description: String(parsed.description || theme.description).slice(0, 5000),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 15) : _defaultTags(theme),
    };
  } catch (err) {
    logger.warn(`[NatureAssets] Metadata generation failed (${err.message}) — using defaults`);
    return { title: theme.title, description: theme.description, tags: _defaultTags(theme) };
  }
}

/**
 * Render a long looped MP4 for local QA (no YouTube). Default 60 minutes.
 */
async function exportLongTest(videoPath, audioPath, destPath, durationSec = 3600) {
  const resolution = process.env.NATURE_STREAM_RESOLUTION || '1920:1080';
  await runFfmpeg([
    '-y',
    '-stream_loop', '-1',
    '-i', videoPath,
    '-stream_loop', '-1',
    '-i', audioPath,
    '-t', String(durationSec),
    '-map', '0:v',
    '-map', '1:a',
    '-vf', `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:(ow-iw)/2:(oh-ih)/2,fps=30`,
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264',
    '-preset', process.env.NATURE_EXPORT_PRESET || 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', getNatureAudioBitrate(),
    '-movflags', '+faststart',
    destPath,
  ], 'long-test-export');
  return destPath;
}

module.exports = {
  getNatureLiveDir,
  themeDir,
  generateAssetsForTheme,
  generateNatureMetadata,
  buildPreviewMux,
  exportLongTest,
};
