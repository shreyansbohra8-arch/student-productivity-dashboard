const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null
    },
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: 200
    },
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true
    },
    tags: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

NoteSchema.index({ userId: 1 });
// Text index for full-text search across title and content
NoteSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Note', NoteSchema);
