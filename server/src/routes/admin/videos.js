const express = require('express');
const Book = require('../../models/Book');
const VideoJob = require('../../models/VideoJob');
const logger = require('../../utils/logger');
const requireAdmin = require('../../middleware/requireAdmin');
const router = express.Router();

// GET /api/admin/videos — list video jobs with pagination
router.get('/videos', requireAdmin, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const status = req.query.status || null;

    const filter = status ? { status } : {};
    const [jobs, total] = await Promise.all([
      VideoJob.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('bookId', 'title author genre rating')
        .lean(),
      VideoJob.countDocuments(filter),
    ]);

    res.json({ jobs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/admin/video-stats — summary counts
router.get('/video-stats', requireAdmin, async (req, res, next) => {
  try {
    const counts = await VideoJob.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const stats = { total: 0, queued: 0, scripting: 0, tts: 0, rendering: 0, done: 0, failed: 0 };
    for (const { _id, count } of counts) {
      stats[_id] = count;
      stats.total += count;
    }
    res.json(stats);
  } catch (err) { next(err); }
});

// POST /api/admin/videos/generate — trigger video for a specific book
router.post('/videos/generate', requireAdmin, async (req, res, next) => {
  try {
    const { bookId } = req.body;
    if (!bookId) return res.status(400).json({ error: 'bookId required' });

    // Start async — don't await (rendering takes minutes)
    const VideoAgent = require('../../agents/VideoAgent');
    const agent = new VideoAgent();
    agent.generateForBook(bookId).catch(err => {
      logger.error(`[admin] Video generation failed for ${bookId}: ${err.message}`);
    });

    res.json({ ok: true, message: 'Video generation started', bookId });
  } catch (err) { next(err); }
});

// POST /api/admin/videos/batch — generate next N videos
router.post('/videos/batch', requireAdmin, async (req, res, next) => {
  try {
    const batchSize = Math.min(20, parseInt(req.body.batchSize) || 3);

    const VideoAgent = require('../../agents/VideoAgent');
    const agent = new VideoAgent();
    agent.runBatch(batchSize).catch(err => {
      logger.error(`[admin] Video batch failed: ${err.message}`);
    });

    res.json({ ok: true, message: `Batch of ${batchSize} videos started` });
  } catch (err) { next(err); }
});

// POST /api/admin/videos/:id/retry — reset a failed/stuck job and re-run it
router.post('/videos/:id/retry', requireAdmin, async (req, res, next) => {
  try {
    const job = await VideoJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const VideoAgent = require('../../agents/VideoAgent');
    const agent = new VideoAgent();
    agent.generateForBook(job.bookId).catch(err => {
      logger.error(`[admin] Video retry failed for job ${job._id}: ${err.message}`);
    });

    res.json({ ok: true, message: 'Retry started' });
  } catch (err) { next(err); }
});

// POST /api/admin/videos/:id/upload-youtube — upload an existing local video to YouTube
router.post('/videos/:id/upload-youtube', requireAdmin, async (req, res, next) => {
  try {
    const fs = require('fs');
    const job = await VideoJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'done') return res.status(400).json({ error: 'Job is not done' });
    if (job.youtubeVideoId) return res.status(400).json({ error: 'Already uploaded to YouTube' });
    if (!job.videoPath || !fs.existsSync(job.videoPath)) {
      return res.status(400).json({ error: 'Local video file not found' });
    }

    const { uploadVideo, isConfigured } = require('../../services/youtube');
    if (!(await isConfigured())) {
      return res.status(400).json({ error: 'YouTube not connected' });
    }

    const Book = require('../../models/Book');
    const book = await Book.findById(job.bookId).lean();
    const tags = [book?.genre, 'book review', 'book summary', book?.title, book?.author,
      'reviewerinsight', '#BookTok', '#BookReview'].filter(Boolean);

    // Fire async — upload can take a while
    uploadVideo({
      filePath:      job.videoPath,
      title:         job.script?.title || `${book?.title} — Book Review`,
      description:   job.script?.description || 'Full review at reviewerinsight.com',
      tags,
      privacyStatus: process.env.YOUTUBE_PRIVACY || 'public',
    }).then(async ({ videoId, videoUrl }) => {
      await VideoJob.findByIdAndUpdate(job._id, {
        youtubeVideoId: videoId,
        videoUrl,
        videoPath: null,
        audioPath: null,
      });
      try { fs.unlinkSync(job.videoPath); } catch {}
      if (job.audioPath) try { fs.unlinkSync(job.audioPath); } catch {}
      logger.info(`[admin] Manual YouTube upload done → ${videoUrl}`);
    }).catch(err => {
      logger.error(`[admin] Manual YouTube upload failed: ${err.message}`);
    });

    res.json({ ok: true, message: 'Upload started — check back in a minute' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/videos/:id — delete a video job (and its files)
router.delete('/videos/:id', requireAdmin, async (req, res, next) => {
  try {
    const job = await VideoJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const fs = require('fs');
    for (const filePath of [job.audioPath, job.videoPath].filter(Boolean)) {
      try { fs.unlinkSync(filePath); } catch {}
    }

    await job.deleteOne();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
