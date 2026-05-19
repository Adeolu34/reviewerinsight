const mongoose = require('mongoose');

const videoJobSchema = new mongoose.Schema({
  bookId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  status:  {
    type: String,
    enum: ['queued', 'scripting', 'tts', 'rendering', 'uploading', 'done', 'failed'],
    default: 'queued',
    index: true,
  },

  // Generated script
  script: {
    title:          { type: String },
    description:    { type: String },
    totalSeconds:   { type: Number },
    fullNarration:  { type: String },
    scenes: [{
      id:               String,
      narration:        String,
      estimatedSeconds: Number,
    }],
  },

  // Output files (absolute server paths)
  audioPath:  { type: String },
  videoPath:  { type: String },

  // YouTube upload result
  youtubeVideoId: { type: String },
  videoUrl:       { type: String },  // https://youtu.be/<id> once uploaded

  // Error info
  error:      { type: String },
  errorStep:  { type: String },

  // Timing
  startedAt:   { type: Date },
  completedAt: { type: Date },
  durationMs:  { type: Number },

  // AI cost tracking
  tokensUsed: { type: Number, default: 0 },
}, { timestamps: true });

videoJobSchema.index({ bookId: 1 }, { unique: true });

module.exports = mongoose.model('VideoJob', videoJobSchema);
