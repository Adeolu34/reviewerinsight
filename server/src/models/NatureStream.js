const mongoose = require('mongoose');

const natureStreamSchema = new mongoose.Schema({
  themeId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['idle', 'generating', 'ready', 'starting', 'preview', 'live', 'error', 'stopped'],
    default: 'idle',
    index: true,
  },
  title: { type: String },
  description: { type: String },
  audioPath: { type: String },
  videoPath: { type: String },
  thumbnailPath: { type: String },
  youtubeBroadcastId: { type: String },
  youtubeStreamId: { type: String },
  ingestionAddress: { type: String },
  streamKey: { type: String },
  youtubeWatchUrl: { type: String },
  youtubeStudioUrl: { type: String },
  ffmpegPid: { type: Number },
  lastError: { type: String },
  startedAt: { type: Date },
  assetsGeneratedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('NatureStream', natureStreamSchema);
