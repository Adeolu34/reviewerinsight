const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'reviewer-insight' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${extra}`;
        })
      ),
    }),
  ],
});

// Optional rotated file logs (set LOG_DIR). Bounded: 5 files x 5 MB each, oldest dropped automatically.
if (process.env.LOG_DIR) {
  const path = require('path');
  const fs = require('fs');
  try {
    fs.mkdirSync(process.env.LOG_DIR, { recursive: true });
    logger.add(new winston.transports.File({
      filename: path.join(process.env.LOG_DIR, 'app.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }));
    logger.add(new winston.transports.File({
      filename: path.join(process.env.LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    }));
  } catch (err) {
    console.error('[logger] could not enable file logging:', err.message);
  }
}

module.exports = logger;
