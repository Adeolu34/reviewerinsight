const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const NatureStream = require('../models/NatureStream');
const { MAX_CONCURRENT_LIVE } = require('../config/natureThemes');
const natureYoutube = require('./natureYoutube');
const logger = require('../utils/logger');

/** themeId -> ChildProcess */
const processes = new Map();

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function buildRtmpUrl(ingestionAddress, streamKey) {
  const base = (ingestionAddress || '').replace(/\/$/, '');
  return `${base}/${streamKey}`;
}

function countLiveProcesses() {
  let n = 0;
  for (const proc of processes.values()) {
    if (proc && proc.exitCode === null) n++;
  }
  return n;
}

async function countLiveInDb() {
  return NatureStream.countDocuments({ status: 'live' });
}

/**
 * Start ffmpeg RTMP encoder for a theme (expects assets + YouTube session on doc).
 */
async function startEncoder(doc) {
  if (!doc.videoPath || !doc.audioPath || !fs.existsSync(doc.videoPath) || !fs.existsSync(doc.audioPath)) {
    throw new Error('Missing video or audio assets — run generate-assets first');
  }
  if (!doc.ingestionAddress || !doc.streamKey) {
    throw new Error('Missing YouTube RTMP credentials');
  }

  const rtmpUrl = buildRtmpUrl(doc.ingestionAddress, doc.streamKey);
  const logDir = path.join(path.dirname(doc.videoPath), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `ffmpeg-${doc.themeId}.log`);
  const logFd = fs.openSync(logFile, 'a');

  const videoBitrate = process.env.NATURE_VIDEO_BITRATE || '2500k';
  const resolution = process.env.NATURE_STREAM_RESOLUTION || '1920:1080';

  const args = [
    '-re',
    '-stream_loop', '-1',
    '-i', doc.videoPath,
    '-stream_loop', '-1',
    '-i', doc.audioPath,
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'libx264',
    '-preset', process.env.NATURE_FFMPEG_PRESET || 'veryfast',
    '-b:v', videoBitrate,
    '-maxrate', videoBitrate,
    '-bufsize', '5000k',
    '-vf', `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:(ow-iw)/2:(oh-ih)/2,fps=30`,
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    rtmpUrl,
  ];

  if (processes.get(doc.themeId)) {
    await stopEncoder(doc.themeId, { skipYoutubeEnd: true });
  }

  const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', logFd, logFd] });
  processes.set(doc.themeId, proc);

  proc.on('exit', (code, signal) => {
    logger.warn(`[NatureStream] ffmpeg ${doc.themeId} exited code=${code} signal=${signal}`);
    processes.delete(doc.themeId);
    NatureStream.findOneAndUpdate(
      { themeId: doc.themeId, status: 'live' },
      { $set: { status: 'error', lastError: `ffmpeg exited (${code || signal})`, ffmpegPid: null } },
    ).catch(() => {});
  });

  await NatureStream.findByIdAndUpdate(doc._id, {
    $set: {
      status: 'live',
      ffmpegPid: proc.pid,
      startedAt: new Date(),
      lastError: null,
    },
  });

  logger.info(`[NatureStream] Encoder started ${doc.themeId} pid=${proc.pid} → ${rtmpUrl.replace(doc.streamKey, '***')}`);
  return proc.pid;
}

async function stopEncoder(themeId, { skipYoutubeEnd = false } = {}) {
  const proc = processes.get(themeId);
  if (proc && proc.exitCode === null) {
    try {
      proc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 2000));
      if (proc.exitCode === null) proc.kill('SIGKILL');
    } catch (_) {}
  }
  processes.delete(themeId);

  const doc = await NatureStream.findOne({ themeId });
  if (doc && !skipYoutubeEnd && doc.youtubeBroadcastId) {
    await natureYoutube.endBroadcast(doc.youtubeBroadcastId);
  }

  if (doc) {
    await NatureStream.findByIdAndUpdate(doc._id, {
      $set: { status: 'stopped', ffmpegPid: null },
    });
  }
}

async function stopAll() {
  const live = await NatureStream.find({ status: { $in: ['live', 'starting'] } });
  for (const doc of live) {
    await stopEncoder(doc.themeId);
  }
}

/**
 * Full start: YouTube live session + ffmpeg (doc must be ready).
 */
async function startStream(themeId) {
  const liveCount = await countLiveInDb();
  if (liveCount >= MAX_CONCURRENT_LIVE) {
    throw new Error(`Maximum ${MAX_CONCURRENT_LIVE} concurrent live streams reached`);
  }

  let doc = await NatureStream.findOne({ themeId });
  if (!doc) {
    const { getTheme } = require('../config/natureThemes');
    const theme = getTheme(themeId);
    doc = await NatureStream.create({
      themeId,
      title: theme?.title,
      description: theme?.description,
      status: 'idle',
    });
  }

  if (doc.status === 'live') {
    throw new Error('Stream already live');
  }

  if (!doc.audioPath || !doc.videoPath) {
    throw new Error('Generate assets before starting');
  }

  if (!(await natureYoutube.isConfigured())) {
    throw new Error('Nature YouTube not connected');
  }

  await NatureStream.findByIdAndUpdate(doc._id, { $set: { status: 'starting', lastError: null } });

  try {
    const title = doc.title || `Nature Live — ${themeId}`;
    const description = doc.description || '';

    const session = await natureYoutube.createLiveSession({ title, description });
    await NatureStream.findByIdAndUpdate(doc._id, { $set: { ...session, title, description } });

    doc = await NatureStream.findOne({ themeId });
    await startEncoder(doc);

    if (doc.youtubeBroadcastId) {
      setTimeout(async () => {
        try {
          await natureYoutube.goLive(doc.youtubeBroadcastId);
        } catch (err) {
          logger.warn(`[NatureStream] goLive delayed: ${err.message}`);
        }
      }, 15000);
    }

    return await NatureStream.findOne({ themeId });
  } catch (err) {
    await NatureStream.findByIdAndUpdate(doc._id, {
      $set: { status: 'error', lastError: err.message },
    });
    throw err;
  }
}

async function watchdogTick() {
  const liveDocs = await NatureStream.find({ status: 'live' });
  for (const doc of liveDocs) {
    const proc = processes.get(doc.themeId);
    const running = proc && proc.exitCode === null;
    if (!running) {
      logger.warn(`[NatureStream] Watchdog restarting ${doc.themeId}`);
      try {
        if (doc.youtubeBroadcastId) {
          try {
            await natureYoutube.goLive(doc.youtubeBroadcastId);
          } catch (_) {
            const session = await natureYoutube.createLiveSession({
              title: doc.title,
              description: doc.description,
            });
            await NatureStream.findByIdAndUpdate(doc._id, { $set: session });
            doc = await NatureStream.findOne({ themeId: doc.themeId });
          }
        }
        await startEncoder(doc);
      } catch (err) {
        await NatureStream.findByIdAndUpdate(doc._id, {
          $set: { status: 'error', lastError: `Watchdog: ${err.message}` },
        });
      }
    }
  }
}

async function resumeLiveOnStartup() {
  if (process.env.NATURE_LIVE_AUTO_RESUME !== 'true') return;
  const docs = await NatureStream.find({ status: 'live' });
  logger.info(`[NatureStream] Auto-resume ${docs.length} stream(s)`);
  for (const doc of docs) {
    try {
      await startEncoder(doc);
      if (doc.youtubeBroadcastId) {
        await natureYoutube.goLive(doc.youtubeBroadcastId).catch(() => {});
      }
    } catch (err) {
      logger.error(`[NatureStream] Resume failed ${doc.themeId}: ${err.message}`);
    }
  }
}

function startWatchdogCron() {
  const intervalMs = parseInt(process.env.NATURE_WATCHDOG_INTERVAL_MS, 10) || 60000;
  setInterval(() => {
    watchdogTick().catch((err) => logger.error(`[NatureStream] Watchdog: ${err.message}`));
  }, intervalMs);
  logger.info(`[NatureStream] Watchdog every ${intervalMs}ms`);
}

module.exports = {
  startStream,
  stopEncoder,
  stopAll,
  startEncoder,
  watchdogTick,
  resumeLiveOnStartup,
  startWatchdogCron,
  countLiveProcesses,
  countLiveInDb,
  processes,
};
