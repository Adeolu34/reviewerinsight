const express = require('express');
const fs = require('fs');
const path = require('path');
const VideoJob = require('../models/VideoJob');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

/**
 * Parse an HTTP Range header ("bytes=START-END", "bytes=START-", "bytes=-SUFFIX").
 * Returns { start, end } (inclusive) or null when the header is malformed / unsatisfiable.
 */
function parseRange(header, fileSize) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;

  let start;
  let end;
  if (m[1] === '') { // suffix range: last N bytes
    const n = parseInt(m[2], 10);
    if (!(n > 0)) return null;
    start = Math.max(0, fileSize - n);
    end = fileSize - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] ? Math.min(parseInt(m[2], 10), fileSize - 1) : fileSize - 1;
  }
  if (!(start <= end) || start >= fileSize) return null;
  return { start, end };
}

// Public video streaming — supports Range requests for seeking
router.get('/:id/stream', async (req, res, next) => {
  try {
    const job = await VideoJob.findById(req.params.id).lean();
    if (!job || !job.videoPath) return res.status(404).json({ error: 'Video not found' });
    if (!fs.existsSync(job.videoPath)) return res.status(404).json({ error: 'File not on disk' });

    const fileSize = fs.statSync(job.videoPath).size;
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const range = parseRange(rangeHeader, fileSize);
      if (!range) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      const { start, end } = range;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
      });
      return fs.createReadStream(job.videoPath, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    });
    return fs.createReadStream(job.videoPath).pipe(res);
  } catch (err) { next(err); }
});

// Video file download (admin only)
router.get('/:id/download', requireAdmin, async (req, res, next) => {
  try {
    const job = await VideoJob.findById(req.params.id).lean();
    if (!job || !job.videoPath) return res.status(404).json({ error: 'Video not found' });
    if (!fs.existsSync(job.videoPath)) return res.status(404).json({ error: 'File not on disk' });
    const filename = path.basename(job.videoPath).replace(/[^\w.\- ]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    res.sendFile(job.videoPath);
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.parseRange = parseRange;
