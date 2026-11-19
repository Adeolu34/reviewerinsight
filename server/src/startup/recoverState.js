const fs = require('fs');
const logger = require('../utils/logger');

/**
 * On boot, reset anything left "in progress" by a previous process
 * (video jobs, nature/football streams, nature exports).
 */
async function recoverInterruptedWork() {
  const VideoJob = require('../models/VideoJob');
  const NatureStream = require('../models/NatureStream');
  const FootballStream = require('../models/FootballStream');
  const natureExportManager = require('../services/natureExportManager');

  const stuck = await VideoJob.updateMany(
    { status: { $in: ['queued', 'scripting', 'tts', 'rendering'] } },
    { $set: { status: 'failed', error: 'Server restarted mid-job', errorStep: 'startup' } },
  );
  if (stuck.modifiedCount > 0) {
    logger.warn(`[startup] Reset ${stuck.modifiedCount} stuck video job(s) to failed`);
  }

  const stuckStarting = await NatureStream.updateMany(
    { status: { $in: ['starting', 'generating'] } },
    { $set: { status: 'error', lastError: 'Server restarted mid-operation', ffmpegPid: null } },
  );
  if (stuckStarting.modifiedCount > 0) {
    logger.warn(`[startup] Reset ${stuckStarting.modifiedCount} stuck nature stream(s) (starting/generating)`);
  }

  const exporting = await NatureStream.find({ status: 'exporting' }).lean();
  for (const doc of exporting) {
    const minutes = doc.testExportMinutes || parseInt(process.env.NATURE_EXPORT_DEFAULT_MINUTES, 10) || 15;
    const outPath = natureExportManager.expectedExportPath(doc.themeId, minutes);
    const st = natureExportManager.fileStats(outPath);
    if (st.exists && st.bytes > 2_000_000) {
      await NatureStream.updateOne(
        { _id: doc._id },
        { $set: { status: 'ready', testExportPath: outPath, lastError: null, exportStartedAt: null } },
      );
      logger.info(`[startup] Recovered nature export file for ${doc.themeId}`);
    } else {
      await NatureStream.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: 'ready',
            lastError: 'Export interrupted on server restart — click Export again',
            exportStartedAt: null,
          },
        },
      );
      if (st.exists && st.bytes < 2_000_000) {
        try { fs.unlinkSync(outPath); } catch (_) { /* ignore */ }
      }
    }
  }
  if (exporting.length > 0) {
    logger.warn(`[startup] Cleared ${exporting.length} interrupted nature export(s)`);
  }

  const stuckFootball = await FootballStream.updateMany(
    { status: 'starting' },
    { $set: { status: 'error', lastError: 'Server restarted mid-start', ffmpegPid: null } },
  );
  if (stuckFootball.modifiedCount > 0) {
    logger.warn(`[startup] Reset ${stuckFootball.modifiedCount} stuck football stream(s)`);
  }
}

module.exports = { recoverInterruptedWork };
