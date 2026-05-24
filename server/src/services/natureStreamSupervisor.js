const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const NatureStream = require('../models/NatureStream');
const { MAX_CONCURRENT_LIVE } = require('../config/natureThemes');
const natureYoutube = require('./natureYoutube');
const { getNatureAudioBitrate } = require('./natureAudio');
const logger = require('../utils/logger');

/** themeId -> ChildProcess */
const processes = new Map();

/** themeIds being intentionally stopped — suppress auto-restart */
const stoppingThemeIds = new Set();

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
async function startEncoder(doc, { streamStatus = 'live' } = {}) {
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
    '-bufsize', '8000k',
    '-vf', `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:(ow-iw)/2:(oh-ih)/2,fps=30`,
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', getNatureAudioBitrate(),
    '-ar', '44100',
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
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

    if (stoppingThemeIds.has(doc.themeId)) return;

    // Unexpected exit — clear pid, then restart after 3s
    NatureStream.findOneAndUpdate(
      { themeId: doc.themeId },
      { $set: { ffmpegPid: null, lastError: `ffmpeg exited (${code || signal}) — restarting…` } },
    ).catch(() => {});

    setTimeout(async () => {
      if (stoppingThemeIds.has(doc.themeId)) return;
      try {
        const freshDoc = await NatureStream.findOne({ themeId: doc.themeId });
        if (!freshDoc || !['live', 'preview', 'starting'].includes(freshDoc.status)) return;
        logger.info(`[NatureStream] Auto-restarting encoder for ${doc.themeId}`);
        await startEncoder(freshDoc, { streamStatus: freshDoc.status });
        if (freshDoc.youtubeBroadcastId && freshDoc.status === 'live') {
          await natureYoutube.goLive(freshDoc.youtubeBroadcastId).catch(() => {});
        }
      } catch (err) {
        logger.error(`[NatureStream] Auto-restart failed ${doc.themeId}: ${err.message}`);
        NatureStream.findOneAndUpdate(
          { themeId: doc.themeId },
          { $set: { status: 'error', lastError: `Auto-restart failed: ${err.message}` } },
        ).catch(() => {});
      }
    }, 3000);
  });

  await NatureStream.findByIdAndUpdate(doc._id, {
    $set: {
      status: streamStatus,
      ffmpegPid: proc.pid,
      startedAt: new Date(),
      lastError: null,
    },
  });

  logger.info(`[NatureStream] Encoder started ${doc.themeId} pid=${proc.pid} → ${rtmpUrl.replace(doc.streamKey, '***')}`);
  return proc.pid;
}

/**
 * Make a prepared stream public on YouTube.
 */
async function publishStream(themeId) {
  const doc = await NatureStream.findOne({ themeId });
  if (!doc) throw new Error('Unknown theme');
  if (!doc.youtubeBroadcastId) throw new Error('No YouTube broadcast — run Prepare first');
  if (doc.status !== 'preview' && doc.status !== 'starting') {
    throw new Error(`Cannot go live from status "${doc.status}"`);
  }

  await natureYoutube.goLive(doc.youtubeBroadcastId);
  await NatureStream.findByIdAndUpdate(doc._id, {
    $set: { status: 'live', lastError: null },
  });
  return await NatureStream.findOne({ themeId });
}

/** @deprecated alias — use prepareStream + publishStream */
async function startStream(themeId) {
  const doc = await prepareStream(themeId);
  if (process.env.NATURE_SKIP_PREVIEW === 'true') {
    await new Promise((r) => setTimeout(r, 22000));
    return publishStream(themeId);
  }
  return doc;
}

async function stopEncoder(themeId, { skipYoutubeEnd = false } = {}) {
  stoppingThemeIds.add(themeId);
  const proc = processes.get(themeId);
  if (proc && proc.exitCode === null) {
    try {
      proc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 2000));
      if (proc.exitCode === null) proc.kill('SIGKILL');
    } catch (_) {}
  }
  processes.delete(themeId);
  stoppingThemeIds.delete(themeId);

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
  const live = await NatureStream.find({ status: { $in: ['live', 'starting', 'preview'] } });
  for (const doc of live) {
    await stopEncoder(doc.themeId);
  }
}

/**
 * Push RTMP to YouTube and enter testing/preview (not public live yet).
 */
async function prepareStream(themeId) {
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

  if (doc.status === 'live' || doc.status === 'preview') {
    throw new Error('Stream already running — stop it first');
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
    const tags = Array.isArray(doc.tags) ? doc.tags : [];

    const session = await natureYoutube.createLiveSession({ title, description, tags });
    await NatureStream.findByIdAndUpdate(doc._id, { $set: { ...session, title, description } });

    doc = await NatureStream.findOne({ themeId });
    await startEncoder(doc, { streamStatus: 'starting' });

    const broadcastId = doc.youtubeBroadcastId;
    if (broadcastId) {
      setTimeout(async () => {
        try {
          await natureYoutube.enterPreviewMode(broadcastId);
          await NatureStream.findOneAndUpdate(
            { themeId },
            { $set: { status: 'preview', lastError: null } },
          );
          logger.info(`[NatureStream] ${themeId} in YouTube preview (testing)`);
        } catch (err) {
          logger.warn(`[NatureStream] preview transition: ${err.message}`);
          await NatureStream.findOneAndUpdate(
            { themeId },
            { $set: { lastError: `Preview: ${err.message}` } },
          );
        }
      }, 20000);
    }

    await NatureStream.findByIdAndUpdate(doc._id, { $set: { status: 'starting' } });
    return await NatureStream.findOne({ themeId });
  } catch (err) {
    await NatureStream.findByIdAndUpdate(doc._id, {
      $set: { status: 'error', lastError: err.message },
    });
    throw err;
  }
}

async function _reconnectOrReplaceSession(doc) {
  if (!doc.youtubeBroadcastId) return doc;

  let lifecycle = null;
  try {
    const bcast = await natureYoutube.getBroadcastStatus(doc.youtubeBroadcastId);
    lifecycle = bcast?.status?.lifeCycleStatus || null;
  } catch (_) {}

  if (lifecycle === 'live') {
    // Broadcast is still live — encoder dropped but YouTube is healthy, just reconnect
    return doc;
  }

  if (lifecycle === 'testing') {
    // In preview — push live and reconnect
    await natureYoutube.goLive(doc.youtubeBroadcastId).catch(() => {});
    await NatureStream.findByIdAndUpdate(doc._id, { $set: { status: 'live' } });
    return await NatureStream.findOne({ themeId: doc.themeId });
  }

  // Broadcast is complete/revoked/unknown — create a fresh session
  logger.info(`[NatureStream] Broadcast ${doc.youtubeBroadcastId} lifecycle=${lifecycle} — creating new session`);
  const session = await natureYoutube.createLiveSession({
    title: doc.title,
    description: doc.description,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
  });
  await NatureStream.findByIdAndUpdate(doc._id, { $set: session });
  const fresh = await NatureStream.findOne({ themeId: doc.themeId });
  await natureYoutube.goLive(fresh.youtubeBroadcastId).catch(() => {});
  return fresh;
}

async function watchdogTick() {
  const liveDocs = await NatureStream.find({ status: { $in: ['live', 'preview'] } });
  for (let doc of liveDocs) {
    const proc = processes.get(doc.themeId);
    const running = proc && proc.exitCode === null;
    if (!running) {
      logger.warn(`[NatureStream] Watchdog restarting ${doc.themeId}`);
      try {
        doc = await _reconnectOrReplaceSession(doc);
        await startEncoder(doc, { streamStatus: doc.status });
      } catch (err) {
        await NatureStream.findByIdAndUpdate(doc._id, {
          $set: { status: 'error', lastError: `Watchdog: ${err.message}` },
        });
      }
    }
  }
}

async function resumeLiveOnStartup() {
  const docs = await NatureStream.find({ status: { $in: ['live', 'preview'] } });
  if (!docs.length) return;
  logger.info(`[NatureStream] Resuming ${docs.length} stream(s) on startup`);
  for (let doc of docs) {
    try {
      doc = await _reconnectOrReplaceSession(doc);
      await startEncoder(doc, { streamStatus: doc.status });
    } catch (err) {
      logger.error(`[NatureStream] Resume failed ${doc.themeId}: ${err.message}`);
    }
  }
}

function startWatchdogCron() {
  const intervalMs = parseInt(process.env.NATURE_WATCHDOG_INTERVAL_MS, 10) || 15000;
  setInterval(() => {
    watchdogTick().catch((err) => logger.error(`[NatureStream] Watchdog: ${err.message}`));
  }, intervalMs);
  logger.info(`[NatureStream] Watchdog every ${intervalMs}ms`);
}

module.exports = {
  prepareStream,
  publishStream,
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
