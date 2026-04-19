const mongoose = require('mongoose');

const scraperRunSchema = new mongoose.Schema({
  source:         { type: String, required: true },
  trigger:        { type: String, enum: ['scheduled', 'manual'], default: 'manual' },
  startedAt:      { type: Date, default: Date.now },
  completedAt:    { type: Date },
  status:         { type: String, enum: ['running', 'completed', 'failed', 'partial'], default: 'running' },
  booksFound:     { type: Number, default: 0 },
  booksNew:       { type: Number, default: 0 },
  booksDuplicate: { type: Number, default: 0 },
  booksFailed:    { type: Number, default: 0 },
  errors:         [{ title: String, error: String, timestamp: Date }],
  durationMs:     { type: Number },
}, { timestamps: true });

scraperRunSchema.index({ source: 1, startedAt: -1 });

module.exports = mongoose.model('ScraperRun', scraperRunSchema);
