const mongoose = require('mongoose');

const footballStreamSchema = new mongoose.Schema({
  streamId: {
    type: String,
    default: 'football',
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['idle', 'starting', 'preview', 'live', 'error', 'stopped'],
    default: 'idle',
    index: true,
  },
  title:       { type: String, default: 'Football Live 24/7' },
  description: { type: String, default: '' },
  tags:        [{ type: String }],
  categoryId:  { type: String, default: '17' }, // 17 = Sports
  privacyStatus: { type: String, default: 'public' },
  youtubeBroadcastId: { type: String },
  youtubeStreamId:    { type: String },
  ingestionAddress:   { type: String },
  streamKey:          { type: String },
  youtubeWatchUrl:    { type: String },
  youtubeStudioUrl:   { type: String },
  ffmpegPid:          { type: Number },
  lastError:          { type: String },
  startedAt:          { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('FootballStream', footballStreamSchema);
