const mongoose = require('mongoose');

const editorSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  role:        { type: String },
  beat:        { type: String },
  initials:    { type: String },
  bg:          { type: String },
  genres:      [{ type: String }],
  active:      { type: Boolean, default: true },
  reviewCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Editor', editorSchema);
