const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  slug:        { type: String, required: true, unique: true, index: true },
  bio:         { type: String },
  shortBio:    { type: String },
  birthYear:   { type: Number },
  deathYear:   { type: Number },
  nationality: { type: String },
  photoUrl:    { type: String },
  genres:      [{ type: String }],
  bookCount:   { type: Number, default: 0, index: true },
  featured:    { type: Boolean, default: false },
  bioStatus: {
    type: String,
    enum: ['pending', 'generated', 'failed'],
    default: 'pending',
    index: true,
  },
  sources: {
    openLibraryKey: { type: String },
  },
}, { timestamps: true });

authorSchema.index({ name: 'text' });
authorSchema.index({ featured: 1, bookCount: -1 });

module.exports = mongoose.model('Author', authorSchema);
