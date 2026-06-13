const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const FootballStream = require('../models/FootballStream');
const footballYoutube = require('./footballYoutube');
const logger = require('../utils/logger');

const STREAM_ID = 'football';

/** Single process slot for the football stream */
let _proc = null;
let _stopping = false;

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function buildRtmpUrl(ingestionAddress, streamKey) {
  return `${(ingestionAddress || '').replace(/\/$/, '')}/${streamKey}`;
}

function getVideoPath() {
  return process.env.FOOTBALL_VIDEO_PATH || '/var/data/reviewinsight/football/mynewstream.mp4';
}

async function _getOrCreateDoc() {
  let doc = await FootballStream.findOne({ streamId: STREAM_ID });
  if (!doc) doc = await FootballStream.create({ streamId: STREAM_ID });
  return doc;
}

/**
 * Start ffmpeg, looping the video file indefinitely via -stream_loop -1.
 * The MP4 is expected to contain both video and audio tracks.
 */
async function startEncoder(doc) {
  const videoPath = getVideoPath();
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Football video file not found: ${videoPath}`);
  }
  if (!doc.ingestionAddress || !doc.streamKey) {
    throw new Error('Missing YouTube RTMP credentials — run Prepare first');
  }

  const rtmpUrl    = buildRtmpUrl(doc.ingestionAddress, doc.streamKey);
  const logDir     = path.join(path.dirname(videoPath), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile    = path.join(logDir, 'ffmpeg-football.log');
  const logFd      = fs.openSync(logFile, 'a');

  const bitrate    = process.env.FOOTBALL_VIDEO_BITRATE  || process.env.NATURE_VIDEO_BITRATE  || '2500k';
  const resolution = process.env.FOOTBALL_STREAM_RESOLUTION || process.env.NATURE_STREAM_RESOLUTION || '1920:1080';
  const preset     = process.env.FOOTBALL_FFMPEG_PRESET  || process.env.NATURE_FFMPEG_PRESET  || 'veryfast';

  const args = [
    '-re',
    '-stream_loop', '-1',
    '-i', videoPath,
    '-c:v', 'libx264',
    '-preset', preset,
    '-b:v', bitrate,
    '-maxrate', bitrate,
    '-bufsize', '8000k',
    '-vf', `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:(ow-iw)/2:(oh-ih)/2,fps=30`,
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
    rtmpUrl,
  ];

  if (_proc && _proc.exitCode === null) {
    try { _proc.kill('SIGTERM'); } catch (_) {}
    await new Promise((r) => setTimeout(r, 1500));
    if (_proc && _proc.exitCode === null) {
      try { _proc.kill('SIGKILL'); } catch (_) {}
    }
  }

  const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', logFd, logFd] });
  _proc = proc;

  proc.on('exit', (code, signal) => {
    logger.warn(`[FootballStream] ffmpeg exited code=${code} signal=${signal}`);
    if (_proc === proc) _proc = null;

    if (_stopping) return;

    FootballStream.findOneAndUpdate(
      { streamId: STREAM_ID },
      { $set: { ffmpegPid: null, lastError: `ffmpeg exited (${code || signal}) — restarting…` } },
    ).catch(() => {});

    setTimeout(async () => {
      if (_stopping) return;
      try {
        const fresh = await FootballStream.findOne({ streamId: STREAM_ID });
        if (!fresh || !['live', 'preview', 'starting'].includes(fresh.status)) return;
        logger.info('[FootballStream] Auto-restarting encoder');
        await startEncoder(fresh);
        if (fresh.youtubeBroadcastId && fresh.status === 'live') {
          await footballYoutube.goLive(fresh.youtubeBroadcastId).catch(() => {});
        }
      } catch (err) {
        logger.error(`[FootballStream] Auto-restart failed: ${err.message}`);
        FootballStream.findOneAndUpdate(
          { streamId: STREAM_ID },
          { $set: { status: 'error', lastError: `Auto-restart failed: ${err.message}` } },
        ).catch(() => {});
      }
    }, 3000);
  });

  await FootballStream.findByIdAndUpdate(doc._id, {
    $set: { status: 'starting', ffmpegPid: proc.pid, startedAt: new Date(), lastError: null },
  });

  logger.info(`[FootballStream] Encoder started pid=${proc.pid} → ${rtmpUrl.replace(doc.streamKey, '***')}`);
  return proc.pid;
}

async function prepareStream() {
  let doc = await _getOrCreateDoc();

  if (['live', 'preview', 'starting'].includes(doc.status)) {
    throw new Error('Football stream already running — stop it first');
  }
  if (!(await footballYoutube.isConfigured())) {
    throw new Error('Football YouTube not connected — authorize in the Football tab');
  }
  if (!fs.existsSync(getVideoPath())) {
    throw new Error(`Video file not found: ${getVideoPath()}`);
  }

  await FootballStream.findByIdAndUpdate(doc._id, { $set: { status: 'starting', lastError: null } });

  try {
    const session = await footballYoutube.createLiveSession({
      title:       doc.title || 'Football Live 24/7',
      description: doc.description || '',
      tags:        Array.isArray(doc.tags) ? doc.tags : [],
      categoryId:  doc.categoryId || '17',
    });

    await FootballStream.findByIdAndUpdate(doc._id, { $set: session });
    doc = await FootballStream.findOne({ streamId: STREAM_ID });

    await startEncoder(doc);

    const broadcastId = doc.youtubeBroadcastId;
    if (broadcastId) {
      setTimeout(async () => {
        try {
          await footballYoutube.enterPreviewMode(broadcastId);
          await FootballStream.findOneAndUpdate(
            { streamId: STREAM_ID },
            { $set: { status: 'preview', lastError: null } },
          );
          logger.info('[FootballStream] In YouTube preview (testing)');
        } catch (err) {
          logger.warn(`[FootballStream] Preview transition: ${err.message}`);
          await FootballStream.findOneAndUpdate(
            { streamId: STREAM_ID },
            { $set: { lastError: `Preview: ${err.message}` } },
          );
        }
      }, 20000);
    }

    return await FootballStream.findOne({ streamId: STREAM_ID });
  } catch (err) {
    await FootballStream.findByIdAndUpdate(doc._id, {
      $set: { status: 'error', lastError: err.message },
    });
    throw err;
  }
}

async function publishStream() {
  const doc = await FootballStream.findOne({ streamId: STREAM_ID });
  if (!doc) throw new Error('Stream not found');
  if (!doc.youtubeBroadcastId) throw new Error('No YouTube broadcast — run Prepare first');
  if (!['preview', 'starting'].includes(doc.status)) {
    throw new Error(`Cannot go live from status "${doc.status}"`);
  }

  await footballYoutube.goLive(doc.youtubeBroadcastId);
  await FootballStream.findByIdAndUpdate(doc._id, { $set: { status: 'live', lastError: null } });
  return await FootballStream.findOne({ streamId: STREAM_ID });
}

/** One-click: prepare then auto go-live after preview window */
async function startStream() {
  const doc = await prepareStream();
  if (process.env.FOOTBALL_SKIP_PREVIEW === 'true') {
    await new Promise((r) => setTimeout(r, 22000));
    return publishStream();
  }
  return doc;
}

async function stopStream() {
  _stopping = true;
  if (_proc && _proc.exitCode === null) {
    try {
      _proc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 2000));
      if (_proc && _proc.exitCode === null) _proc.kill('SIGKILL');
    } catch (_) {}
  }
  _proc = null;
  _stopping = false;

  const doc = await FootballStream.findOne({ streamId: STREAM_ID });
  if (doc?.youtubeBroadcastId) {
    await footballYoutube.endBroadcast(doc.youtubeBroadcastId);
  }
  if (doc) {
    await FootballStream.findByIdAndUpdate(doc._id, {
      $set: { status: 'stopped', ffmpegPid: null },
    });
  }
}

async function watchdogTick() {
  const doc = await FootballStream.findOne({ streamId: STREAM_ID, status: { $in: ['live', 'preview'] } });
  if (!doc) return;

  const running = _proc && _proc.exitCode === null;
  if (!running) {
    logger.warn('[FootballStream] Watchdog: encoder down, restarting');
    try {
      // Check YouTube broadcast state
      let lifecycle = null;
      try {
        const bcast = await footballYoutube.getBroadcastStatus(doc.youtubeBroadcastId);
        lifecycle = bcast?.status?.lifeCycleStatus || null;
      } catch (_) {}

      let fresh = doc;
      if (lifecycle === 'complete' || lifecycle === 'revoked' || !lifecycle) {
        // Need a fresh broadcast
        const session = await footballYoutube.createLiveSession({
          title:       doc.title,
          description: doc.description || '',
          tags:        Array.isArray(doc.tags) ? doc.tags : [],
          categoryId:  doc.categoryId || '17',
        });
        await FootballStream.findByIdAndUpdate(doc._id, { $set: session });
        fresh = await FootballStream.findOne({ streamId: STREAM_ID });
        await footballYoutube.goLive(fresh.youtubeBroadcastId).catch(() => {});
      }

      await startEncoder(fresh);
    } catch (err) {
      logger.error(`[FootballStream] Watchdog restart failed: ${err.message}`);
      await FootballStream.findOneAndUpdate(
        { streamId: STREAM_ID },
        { $set: { status: 'error', lastError: `Watchdog: ${err.message}` } },
      );
    }
  }
}

async function resumeLiveOnStartup() {
  const doc = await FootballStream.findOne({ streamId: STREAM_ID, status: { $in: ['live', 'preview'] } });
  if (!doc) return;
  logger.info('[FootballStream] Resuming stream on startup');
  try {
    await startEncoder(doc);
  } catch (err) {
    logger.error(`[FootballStream] Startup resume failed: ${err.message}`);
  }
}

function startWatchdogCron() {
  const intervalMs = parseInt(process.env.FOOTBALL_WATCHDOG_INTERVAL_MS, 10)
    || parseInt(process.env.NATURE_WATCHDOG_INTERVAL_MS, 10)
    || 60000;
  setInterval(() => {
    watchdogTick().catch((err) => logger.error(`[FootballStream] Watchdog: ${err.message}`));
  }, intervalMs);
  logger.info(`[FootballStream] Watchdog every ${intervalMs}ms`);
}

module.exports = {
  prepareStream,
  publishStream,
  startStream,
  stopStream,
  resumeLiveOnStartup,
  startWatchdogCron,
  isRunning: () => !!(_proc && _proc.exitCode === null),
};
