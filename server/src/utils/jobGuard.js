const logger = require('./logger');

const running = new Set();

/**
 * Wrap an async job so a slow run can never overlap with the next tick of the same job.
 * Single-process lock (the app runs as one instance). Errors are logged, never thrown,
 * so a failing job cannot become an unhandled rejection inside a cron callback.
 */
function guarded(name, fn) {
  return async (...args) => {
    if (running.has(name)) {
      logger.warn(`[jobGuard] "${name}" still running — skipping overlapping tick`);
      return undefined;
    }
    running.add(name);
    try {
      return await fn(...args);
    } catch (err) {
      logger.error(`[jobGuard] "${name}" failed: ${err.message}`);
      return undefined;
    } finally {
      running.delete(name);
    }
  };
}

/** Test helper / introspection. */
function isRunning(name) { return running.has(name); }

module.exports = { guarded, isRunning };
