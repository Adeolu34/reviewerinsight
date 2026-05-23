const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const NatureStream = require('../models/NatureStream');
const { themeDir } = require('./natureAssets');
const { getNatureAudioBitrate } = require('./natureAudio');
const logger = require('../utils/logger');

/** @type {Map<string, { child: import('child_process').ChildProcess, outPath: string, minutes: number }>} */
const active = new Map();

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function envInt(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : fallback;
}

function defaultExportMinutes() {
  return envInt('NATURE_EXPORT_DEFAULT_MINUTES', 15);
}

function expectedExportPath(themeId, minutes) {
  return path.join(themeDir(themeId), `test_${minutes}min.mp4`);
}

function fileStats(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false, bytes: 0, mtimeMs: 0 };
  const st = fs.statSync(filePath);
  return { exists: true, bytes: st.size, mtimeMs: st.mtimeMs };
}

function isExportFileComplete(bytes, minutes) {
  const minBytes = envInt('NATURE_EXPORT_MIN_BYTES', 2_000_000);
  const perMinute = envInt('NATURE_EXPORT_BYTES_PER_MINUTE', 800_000);
  return bytes >= Math.max(minBytes, minutes * perMinute);
}

function isExportFileStable(st) {
  if (!st.exists) return false;
  const stableSec = envInt('NATURE_EXPORT_STABLE_SECONDS', 90);
  return Date.now() - st.mtimeMs >= stableSec * 1000;
}

/**
 * If DB says exporting but ffmpeg finished (or server restarted), fix status.
 */
async function reconcileExportState(doc) {
  const minutes = doc.testExportMinutes || defaultExportMinutes();
  const outPath = doc.testExportPath || expectedExportPath(doc.themeId, minutes);
  const st = fileStats(outPath);
  const jobActive = active.has(doc.themeId);

  if (doc.status === 'exporting') {
    if (st.exists && isExportFileStable(st) && isExportFileComplete(st.bytes, minutes)) {
      await NatureStream.findOneAndUpdate(
        { themeId: doc.themeId },
        {
          $set: {
            status: 'ready',
            testExportPath: outPath,
            testExportMinutes: minutes,
            lastError: null,
            exportStartedAt: null,
          },
        },
      );
      logger.info(`[NatureExport] Recovered completed export ${doc.themeId} (${(st.bytes / 1024 / 1024).toFixed(1)} MB)`);
      return { recovered: true, status: 'ready', exportBytes: st.bytes, exportActive: false };
    }

    const startedMs = doc.exportStartedAt ? new Date(doc.exportStartedAt).getTime() : 0;
    const staleMs = envInt('NATURE_EXPORT_STALE_HOURS', 6) * 3600 * 1000;
    const orphanMs = envInt('NATURE_EXPORT_ORPHAN_MINUTES', 3) * 60 * 1000;

    if (!jobActive && startedMs && Date.now() - startedMs > orphanMs && !st.exists) {
      await NatureStream.findOneAndUpdate(
        { themeId: doc.themeId },
        {
          $set: {
            status: 'ready',
            lastError: 'Export stopped (server restart or timeout). Click Export again.',
            exportStartedAt: null,
          },
        },
      );
      return { recovered: true, status: 'ready', exportBytes: 0, exportActive: false };
    }

    if (!jobActive && startedMs && Date.now() - startedMs > staleMs) {
      await NatureStream.findOneAndUpdate(
        { themeId: doc.themeId },
        {
          $set: {
            status: 'error',
            lastError: `Export timed out after ${envInt('NATURE_EXPORT_STALE_HOURS', 6)}h — try a shorter test (10 min) or faster preset`,
            exportStartedAt: null,
          },
        },
      );
      return { recovered: true, status: 'error', exportBytes: st.bytes, exportActive: false };
    }

    return {
      recovered: false,
      status: 'exporting',
      exportBytes: st.bytes,
      exportActive: jobActive,
      exportStartedAt: doc.exportStartedAt,
    };
  }

  if (st.exists && isExportFileComplete(st.bytes, minutes) && (!doc.testExportPath || !fs.existsSync(doc.testExportPath))) {
    await NatureStream.findOneAndUpdate(
      { themeId: doc.themeId },
      { $set: { testExportPath: outPath, testExportMinutes: minutes, status: doc.status === 'error' ? 'ready' : doc.status } },
    );
    return { recovered: true, status: doc.status, exportBytes: st.bytes, exportActive: false };
  }

  return {
    recovered: false,
    status: doc.status,
    exportBytes: st.bytes,
    exportActive: jobActive,
    exportStartedAt: doc.exportStartedAt,
  };
}

function runFfmpegExport(videoPath, audioPath, destPath, durationSec, themeId) {
  const resolution = process.env.NATURE_STREAM_RESOLUTION || '1920:1080';
  const args = [
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
    '-preset', process.env.NATURE_EXPORT_PRESET || 'ultrafast',
    '-crf', String(envInt('NATURE_EXPORT_CRF', 23)),
    '-c:a', 'aac',
    '-b:a', getNatureAudioBitrate(),
    '-movflags', '+faststart',
    destPath,
  ];

  const child = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-8000);
  });

  const promise = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(destPath);
      else reject(new Error(`ffmpeg export exit ${code}: ${stderr.slice(-500)}`));
    });
  });

  return { child, promise };
}

async function startExport(themeId, doc, minutes) {
  if (active.has(themeId)) {
    throw new Error('Export already running in this server process');
  }

  const outPath = expectedExportPath(themeId, minutes);
  const durationSec = minutes * 60;

  const { child, promise } = runFfmpegExport(doc.videoPath, doc.audioPath, outPath, durationSec, themeId);

  active.set(themeId, { child, promise, outPath, minutes });

  promise
    .finally(() => {
      active.delete(themeId);
    })
    .then(async () => {
      const st = fileStats(outPath);
      if (!st.exists || st.bytes < 1000) {
        throw new Error('Export produced an empty file');
      }
      await NatureStream.findOneAndUpdate(
        { themeId },
        {
          $set: {
            status: 'ready',
            testExportPath: outPath,
            testExportMinutes: minutes,
            lastError: null,
            exportStartedAt: null,
          },
        },
      );
      logger.info(`[NatureExport] Ready ${themeId} ${minutes}min (${(st.bytes / 1024 / 1024).toFixed(1)} MB)`);
      const storageCleanup = require('./storageCleanup');
      storageCleanup.runStorageCleanup({ reason: 'after-export' }).catch(() => {});
    })
    .catch(async (err) => {
      active.delete(themeId);
      await NatureStream.findOneAndUpdate(
        { themeId },
        { $set: { status: 'error', lastError: `Export: ${err.message}`, exportStartedAt: null } },
      );
      logger.error(`[NatureExport] Failed ${themeId}: ${err.message}`);
    });

  return { outPath };
}

async function cancelExport(themeId) {
  const job = active.get(themeId);
  if (job?.child && !job.child.killed) {
    job.child.kill('SIGTERM');
  }
  active.delete(themeId);
  await NatureStream.findOneAndUpdate(
    { themeId },
    {
      $set: {
        status: 'ready',
        lastError: 'Export cancelled',
        exportStartedAt: null,
      },
    },
  );
}

async function resetStuckExport(themeId) {
  await cancelExport(themeId);
  const doc = await NatureStream.findOne({ themeId });
  const minutes = doc?.testExportMinutes || defaultExportMinutes();
  const outPath = expectedExportPath(themeId, minutes);
  const st = fileStats(outPath);
  if (st.exists && isExportFileComplete(st.bytes, minutes) && isExportFileStable(st)) {
    await NatureStream.findOneAndUpdate(
      { themeId },
      { $set: { status: 'ready', testExportPath: outPath, testExportMinutes: minutes, lastError: null } },
    );
    return { status: 'ready', testExportReady: true };
  }
  return { status: 'ready', testExportReady: !!(doc?.testExportPath && fs.existsSync(doc.testExportPath)) };
}

function isActive(themeId) {
  return active.has(themeId);
}

module.exports = {
  expectedExportPath,
  reconcileExportState,
  startExport,
  cancelExport,
  resetStuckExport,
  isActive,
  fileStats,
};
