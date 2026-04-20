const mongoose = require('mongoose');

const scrapedBookSchema = new mongoose.Schema({
  title:               { type: String, required: true },
  author:              { type: String, required: true },
  source:              {
    type: String,
    required: true,
    enum: ['npr', 'bookpage', 'guardian', 'openlibrary', 'nyt', 'googlebooks', 'applebooks'],
    index: true,
  },
  sourceUrl:           { type: String },
  sourceRating:        { type: String },
  sourceReviewSnippet: { type: String },
  genre:               { type: String },
  year:                { type: Number },
  isbn:                { type: String, index: true, sparse: true },
  coverImageUrl:       { type: String },
  description:         { type: String },

  status: {
    type: String,
    enum: ['scraped', 'imported', 'skipped'],
    default: 'scraped',
    index: true,
  },

  importedBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  importedAt:     { type: Date },
  scrapedAt:      { type: Date, default: Date.now },
  scraperRunId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ScraperRun' },
}, { timestamps: true });

// Same book from the same source = duplicate
scrapedBookSchema.index({ title: 1, author: 1, source: 1 }, { unique: true });
scrapedBookSchema.index({ status: 1, scrapedAt: -1 });
scrapedBookSchema.index({ title: 'text', author: 'text' });

module.exports = mongoose.model('ScrapedBook', scrapedBookSchema);
