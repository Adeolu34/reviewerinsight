const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const { getNatureLiveDir } = require('./natureAssets');

const execFileAsync = promisify(execFile);

let lastRunResult = null;
let cleanupInProgress = false;

function envInt(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name, defaultTrue = true) {
  const v = process.env[name];
  if (v == null || v === '') return defaultTrue;
  return !['0', 'false', 'no', 'off'].includes(String(v).trim().toLowerCase());
}

function safeUnlink(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return 0;
    const size = fs.statSync(filePath).size;
    fs.unlinkSync(filePath);
    return size;
  } catch (err) {
    logger.warn(`[StorageCleanup] unlink failed ${filePath}: ${err.message}`);
    return 0;
  }
}

function listFilesRecursive(dir) {
  const out = [];
  if (!dir || !fs.existsSync(dir)) return out;
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push({ full, size: st.size, mtimeMs: st.mtimeMs });
    }
  };
  walk(dir);
  return out;
}

async function getVolumeFreeMb(targetDir) {
  try {
    const root = path.resolve(targetDir);
    const { stdout } = await execFileAsync('df', ['-Pm', root], { timeout: 5000 });
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].trim().split(/\s+/);
    const availableMb = parseInt(parts[3], 10);
    const usedPct = parseInt(String(parts[4]).replace('%', ''), 10);
    return { availableMb, usedPct, mount: parts[5] };
  } catch {
    return null;
  }
}

/**
 * Remove stale nature-live artifacts (test exports, raw temps, old logs).
 */
async function cleanupNatureLive({ aggressive = false } = {}) {
  const base = getNatureLiveDir();
  const maxTestAgeMs = envInt('NATURE_TEST_EXPORT_MAX_AGE_HOURS', 72) * 3600 * 1000;
  const maxRawAgeMs = envInt('NATURE_RAW_ORPHAN_MAX_AGE_HOURS', 6) * 3600 * 1000;
  const maxLogAgeMs = envInt('NATURE_LOG_MAX_AGE_DAYS', 7) * 86400 * 1000;
  const now = Date.now();
  let freed = 0;
  let removed = 0;

  const NatureStream = require('../models/NatureStream');
  const streams = await NatureStream.find({}).lean();
  const protectedPaths = new Set(
    streams
      .flatMap((s) => [s.videoPath, s.audioPath, s.previewPath, s.testExportPath, s.thumbnailPath].filter(Boolean))
      .map((p) => path.resolve(p)),
  );

  if (!fs.existsSync(base)) {
    return { freed, removed, base };
  }

  for (const themeId of fs.readdirSync(base)) {
    const themePath = path.join(base, themeId);
    if (!fs.statSync(themePath).isDirectory()) continue;

    for (const file of fs.readdirSync(themePath)) {
      const full = path.join(themePath, file);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (!st.isFile()) continue;

      const age = now - st.mtimeMs;
      const isProtected = protectedPaths.has(path.resolve(full)) && !aggressive;

      if (/^test_\d+min\.mp4$/i.test(file) && age > maxTestAgeMs) {
        if (!isProtected || aggressive) {
          freed += safeUnlink(full);
          removed += 1;
          await NatureStream.updateMany(
            { themeId, testExportPath: full },
            { $set: { testExportPath: null, testExportMinutes: null } },
          );
        }
        continue;
      }

      if (/^(audio_raw|video_raw|.*_trim)\.(mp3|mp4)$/i.test(file) && age > maxRawAgeMs) {
        freed += safeUnlink(full);
        removed += 1;
      }
    }

    const logsDir = path.join(themePath, 'logs');
    if (fs.existsSync(logsDir)) {
      for (const logFile of fs.readdirSync(logsDir)) {
        const logPath = path.join(logsDir, logFile);
        try {
          const lst = fs.statSync(logPath);
          if (lst.isFile() && now - lst.mtimeMs > maxLogAgeMs) {
            freed += safeUnlink(logPath);
            removed += 1;
          }
        } catch (_) {}
      }
    }
  }

  return { freed, removed, base };
}

/**
 * Remove disk files for old failed video jobs.
 */
async function cleanupFailedVideos() {
  const VideoJob = require('../models/VideoJob');
  const maxAgeDays = envInt('VIDEO_FAILED_MAX_AGE_DAYS', 14);
  const cutoff = new Date(Date.now() - maxAgeDays * 86400 * 1000);
  let freed = 0;
  let removed = 0;

  const jobs = await VideoJob.find({
    status: 'failed',
    updatedAt: { $lt: cutoff },
  }).limit(200);

  for (const job of jobs) {
    if (job.videoPath) {
      freed += safeUnlink(job.videoPath);
      removed += 1;
    }
    if (job.audioPath) {
      freed += safeUnlink(job.audioPath);
      removed += 1;
    }
    job.videoPath = null;
    job.audioPath = null;
    await job.save();
  }

  return { freed, removed, count: jobs.length };
}

/**
 * Drop completed video files older than N days (keeps DB record, clears paths).
 */
async function cleanupOldCompletedVideos() {
  if (!envBool('STORAGE_CLEANUP_COMPLETED_VIDEOS', false)) {
    return { freed: 0, removed: 0, count: 0 };
  }
  const VideoJob = require('../models/VideoJob');
  const maxAgeDays = envInt('VIDEO_COMPLETED_MAX_AGE_DAYS', 30);
  const cutoff = new Date(Date.now() - maxAgeDays * 86400 * 1000);
  let freed = 0;
  let removed = 0;

  const jobs = await VideoJob.find({
    status: 'done',
    updatedAt: { $lt: cutoff },
    videoPath: { $ne: null },
  }).limit(100);

  for (const job of jobs) {
    freed += safeUnlink(job.videoPath);
    freed += safeUnlink(job.audioPath);
    removed += 2;
    job.videoPath = null;
    job.audioPath = null;
    await job.save();
  }

  return { freed, removed, count: jobs.length };
}

async function runStorageCleanup({ reason = 'scheduled', aggressive = false } = {}) {
  if (cleanupInProgress) {
    return { skipped: true, reason: 'already_running', ...lastRunResult };
  }

  cleanupInProgress = true;
  const startedAt = new Date();
  const minFreeMb = envInt('STORAGE_CLEANUP_MIN_FREE_MB', 0);
  const volumeBefore = await getVolumeFreeMb(getNatureLiveDir());

  let useAggressive = aggressive;
  if (minFreeMb > 0 && volumeBefore && volumeBefore.availableMb < minFreeMb) {
    useAggressive = true;
    logger.warn(`[StorageCleanup] Low disk (${volumeBefore.availableMb} MB free) — aggressive cleanup`);
  }

  try {
    const nature = await cleanupNatureLive({ aggressive: useAggressive });
    const failedVideos = await cleanupFailedVideos();
    const completedVideos = await cleanupOldCompletedVideos();

    const freedBytes = nature.freed + failedVideos.freed + completedVideos.freed;
    const filesRemoved = nature.removed + failedVideos.removed + completedVideos.removed;
    const volumeAfter = await getVolumeFreeMb(getNatureLiveDir());

    lastRunResult = {
      ok: true,
      reason,
      aggressive: useAggressive,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      freedBytes,
      freedMb: Math.round((freedBytes / 1024 / 1024) * 10) / 10,
      filesRemoved,
      nature,
      failedVideos,
      completedVideos,
      volumeBefore,
      volumeAfter,
    };

    logger.info(
      `[StorageCleanup] ${reason}: removed ${filesRemoved} file(s), freed ${lastRunResult.freedMb} MB`
      + (volumeAfter ? `, disk free ${volumeAfter.availableMb} MB` : ''),
    );

    return lastRunResult;
  } catch (err) {
    lastRunResult = {
      ok: false,
      reason,
      error: err.message,
      finishedAt: new Date().toISOString(),
    };
    logger.error(`[StorageCleanup] ${reason} failed: ${err.message}`);
    return lastRunResult;
  } finally {
    cleanupInProgress = false;
  }
}

function startStorageCleanupCron() {
  if (!envBool('STORAGE_CLEANUP_ENABLED', true)) {
    logger.info('[StorageCleanup] Disabled (STORAGE_CLEANUP_ENABLED=false)');
    return;
  }

  const intervalMs = envInt('STORAGE_CLEANUP_INTERVAL_MS', 6 * 60 * 60 * 1000);

  setTimeout(() => {
    runStorageCleanup({ reason: 'startup' }).catch(() => {});
  }, 60 * 1000);

  setInterval(() => {
    runStorageCleanup({ reason: 'scheduled' }).catch(() => {});
  }, intervalMs);

  logger.info(`[StorageCleanup] Scheduled every ${Math.round(intervalMs / 3600000)}h (startup run after 60s)`);
}

function getLastCleanupResult() {
  return lastRunResult;
}

module.exports = {
  runStorageCleanup,
  startStorageCleanupCron,
  getLastCleanupResult,
  getVolumeFreeMb,
  listFilesRecursive,
};
