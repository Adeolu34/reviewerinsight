const mongoose = require('mongoose');

const agentRunSchema = new mongoose.Schema({
  editor:          { type: String, required: true },
  startedAt:       { type: Date, default: Date.now },
  completedAt:     { type: Date },
  status:          { type: String, enum: ['running', 'completed', 'failed', 'partial'], default: 'running' },
  booksDiscovered: { type: Number, default: 0 },
  booksReviewed:   { type: Number, default: 0 },
  booksFailed:     { type: Number, default: 0 },
  booksSkipped:    { type: Number, default: 0 },
  chaptersGenerated: { type: Number, default: 0 },
  tokensUsed:      { type: Number, default: 0 },
  estimatedCost:   { type: Number, default: 0 },
  errors:          [{ bookTitle: String, error: String, timestamp: Date }],
  searchQueries:   [{ type: String }],
  durationMs:      { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('AgentRun', agentRunSchema);
