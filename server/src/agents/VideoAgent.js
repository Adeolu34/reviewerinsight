const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const Book     = require('../models/Book');
const VideoJob = require('../models/VideoJob');
const { generateVideoScript }  = require('../services/videoScript');
const { generateSpeechFile }   = require('../services/elevenLabs');
const { generateCaptionsFromScript } = require('../services/captionService');
const { uploadVideo, isConfigured: youtubeConfigured } = require('../services/youtube');
const logger   = require('../utils/logger');

const VIDEO_OUTPUT_DIR = process.env.VIDEO_OUTPUT_DIR
  || path.join(__dirname, '..', '..', '..', 'videos');

const RENDER_SCRIPT = path.join(__dirname, '..', '..', '..', 'video', 'render.js');

class VideoAgent {
  constructor() {
    this.name = 'VideoAgent';
    this._running = false;
  }

  /**
   * Generate a video for a single book by ID.
   * Creates/updates a VideoJob document and returns the job.
   */
  async generateForBook(bookId) {
    const book = await Book.findById(bookId).lean();
    if (!book) throw new Error(`Book not found: ${bookId}`);
    if (!book.review?.headline) throw new Error(`Book "${book.title}" has no review yet`);

    // Upsert job
    let job = await VideoJob.findOneAndUpdate(
      { bookId: book._id },
      { $set: { status: 'queued', error: null, errorStep: null, startedAt: new Date() } },
      { upsert: true, new: true }
    );

    logger.info(`[VideoAgent] Starting video for "${book.title}" (job: ${job._id})`);

    try {
      // ── Step 1: Generate script ──────────────────────────────────
      await job.updateOne({ status: 'scripting' });
      const script = await generateVideoScript(book);
      await job.updateOne({ script });
      logger.info(`[VideoAgent] Script done — ${script.totalSeconds}s, ${script.scenes.length} scenes`);

      // ── Step 2: TTS via ElevenLabs ───────────────────────────────
      await job.updateOne({ status: 'tts' });
      await fs.promises.mkdir(VIDEO_OUTPUT_DIR, { recursive: true });

      const safeTitle  = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
      const audioPath  = path.join(VIDEO_OUTPUT_DIR, `${safeTitle}-${job._id}.mp3`);
      const videoPath  = path.join(VIDEO_OUTPUT_DIR, `${safeTitle}-${job._id}.mp4`);

      await generateSpeechFile(script.fullNarration, audioPath);
      await job.updateOne({ audioPath });
      logger.info(`[VideoAgent] Audio saved → ${audioPath}`);

      // ── Step 2.5: Word-level captions from script (free, no API) ─
      const captions = generateCaptionsFromScript(script.scenes);

      // ── Step 3: Render with Remotion ─────────────────────────────
      await job.updateOne({ status: 'rendering' });

      const coverData = book.coverDesign || book.cover || { bg:'#141210', fg:'#F5EFE4', motif:'bars' };

      await this._renderVideo({
        book: {
          title:  book.title,
          author: book.author,
          year:   book.year,
          genre:  book.genre,
          rating: book.rating,
          cover:  coverData,
        },
        scenes:    script.scenes,
        audioFile: audioPath,
        captions,
        outputPath: videoPath,
      });

      // ── Step 4: Upload to YouTube (if credentials present) ──────
      let videoUrl  = `/videos/${job._id}/stream`;
      let youtubeVideoId = null;

      if (await youtubeConfigured()) {
        await job.updateOne({ status: 'uploading' });
        try {
          const tags = [
            book.genre, 'book review', 'book summary', book.title, book.author,
            'reviewerinsight', '#BookTok', '#BookReview',
          ].filter(Boolean);

          const result = await uploadVideo({
            filePath:       videoPath,
            title:          script.title || `${book.title} — Book Review`,
            description:    script.description || `Full review at reviewerinsight.com`,
            tags,
            privacyStatus:  process.env.YOUTUBE_PRIVACY || 'public',
          });

          youtubeVideoId = result.videoId;
          videoUrl       = result.videoUrl;

          // Local files no longer needed — clean up to save disk space
          await fs.promises.unlink(videoPath).catch(() => {});
          await fs.promises.unlink(audioPath).catch(() => {});
          logger.info(`[VideoAgent] YouTube upload done → ${videoUrl}`);
        } catch (err) {
          // Upload failed — keep local file, fall back to local stream URL
          logger.error(`[VideoAgent] YouTube upload failed (keeping local file): ${err.message}`);
        }
      }

      await job.updateOne({
        status:      'done',
        videoPath:   youtubeVideoId ? null : videoPath,
        audioPath:   youtubeVideoId ? null : audioPath,
        videoUrl,
        youtubeVideoId,
        completedAt: new Date(),
        durationMs:  Date.now() - job.startedAt.getTime(),
      });

      logger.info(`[VideoAgent] Done → ${videoUrl}`);
      return await VideoJob.findById(job._id);

    } catch (err) {
      const step = (await VideoJob.findById(job._id))?.status || 'unknown';
      await job.updateOne({ status:'failed', error: err.message, errorStep: step });
      logger.error(`[VideoAgent] Failed at step "${step}": ${err.message}`);
      throw err;
    }
  }

  /**
   * Reset jobs that have been stuck in an in-progress state for too long.
   * Prevents a hung TTS/render from blocking a book forever.
   */
  async _resetStaleJobs(staleMinutes = 15) {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    const result = await VideoJob.updateMany(
      {
        status: { $in: ['queued', 'scripting', 'tts', 'rendering', 'uploading'] },
        updatedAt: { $lt: cutoff },
      },
      { $set: { status: 'failed', error: `Stale: stuck in-progress for over ${staleMinutes} minutes`, errorStep: 'stale-reset' } }
    );
    if (result.modifiedCount > 0) {
      logger.warn(`[VideoAgent] Reset ${result.modifiedCount} stale job(s) older than ${staleMinutes}min`);
    }
  }

  /**
   * Find the next N books with completed reviews but no video, and generate them.
   */
  async runBatch(batchSize = 5) {
    if (this._running) {
      logger.warn('[VideoAgent] Already running, skipping');
      return [];
    }
    this._running = true;

    try {
      await this._resetStaleJobs();

      const existingJobBookIds = await VideoJob.distinct('bookId', {
        status: { $in: ['queued','scripting','tts','rendering','done'] },
      });

      const books = await Book.find({
        status:               'published',
        'review.headline':    { $exists: true },
        _id:                  { $nin: existingJobBookIds },
      })
        .sort({ rating: -1, createdAt: -1 })
        .limit(batchSize)
        .select('_id title')
        .lean();

      logger.info(`[VideoAgent] Batch: ${books.length} books to process`);

      const results = [];
      for (const book of books) {
        try {
          const job = await this.generateForBook(book._id);
          results.push({ bookId: book._id, title: book.title, status: job.status });
        } catch (err) {
          results.push({ bookId: book._id, title: book.title, status: 'failed', error: err.message });
        }
      }
      return results;

    } finally {
      this._running = false;
    }
  }

  /**
   * Spawn the Remotion render script as a child process.
   * Passes job data via stdin, waits for completion.
   */
  _renderVideo(jobData) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [RENDER_SCRIPT], {
        cwd: path.dirname(RENDER_SCRIPT),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', d => {
        const text = d.toString();
        stdout += text;
        process.stdout.write(text); // mirror progress
      });
      child.stderr.on('data', d => {
        stderr += d.toString();
      });

      child.stdin.write(JSON.stringify(jobData));
      child.stdin.end();

      child.on('close', code => {
        if (code !== 0) {
          return reject(new Error(`Remotion render failed (exit ${code}):\n${stderr.slice(-500)}`));
        }
        resolve(stdout);
      });

      child.on('error', reject);
    });
  }
}

module.exports = VideoAgent;
