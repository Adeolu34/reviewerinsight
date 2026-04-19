const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  author:      { type: String, required: true },
  year:        { type: Number },
  genre:       { type: String, enum: ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature'], index: true },
  pages:       { type: Number },
  readTime:    { type: String },
  isbn:        { type: String, index: true, sparse: true },
  description: { type: String },

  // Cover
  coverImageUrl: { type: String },
  coverDesign: {
    style: { type: String, enum: ['block', 'type'] },
    bg:    { type: String },
    fg:    { type: String },
    motif: { type: String, enum: ['bars', 'grid', 'dot', 'rule'] },
  },

  // Editorial
  editor:   { type: String, index: true },
  issue:    { type: String },
  featured: { type: Boolean, default: false },
  rating:   { type: Number, min: 0, max: 5 },

  // Generated review content
  blurb:     { type: String },
  takeaways: [{ type: String }],
  review: {
    headline:       { type: String },
    stand:          { type: String },
    paragraphs:     [{ type: String }],
    pullQuote:      { type: String },
    summaryBullets: [{ type: String }],
  },

  // Chapter-by-chapter summaries
  chapterSummaries: [{
    chapter: { type: Number, required: true },
    title:   { type: String, required: true },
    summary: { type: String, required: true },
    themes:  [{ type: String }],
  }],

  // Source tracking
  sources: {
    googleBooksId:     { type: String, sparse: true },
    openLibraryKey:    { type: String, sparse: true },
    discoveredAt:      { type: Date },
    reviewGeneratedAt: { type: Date },
    chapterSummariesGeneratedAt: { type: Date },
  },

  // Status
  status: {
    type: String,
    enum: ['discovered', 'metadata_complete', 'review_pending', 'review_complete', 'published', 'failed'],
    default: 'discovered',
    index: true,
  },
  errorLog: { type: String },
}, { timestamps: true });

// Compound index for dedup
bookSchema.index({ title: 1, author: 1 }, { unique: true });
bookSchema.index({ genre: 1, rating: -1 });
bookSchema.index({ editor: 1, createdAt: -1 });
bookSchema.index({ featured: 1, createdAt: -1 });

// Text index for search
bookSchema.index({ title: 'text', author: 'text', blurb: 'text' });

module.exports = mongoose.model('Book', bookSchema);
