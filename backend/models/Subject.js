const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      maxlength: 100
    },
    code: {
      type: String,
      trim: true,
      maxlength: 20
    },
    color: {
      type: String,
      default: '#6366f1'
    }
  },
  { timestamps: true }
);

// Compound index: fast lookup of a user's subjects
SubjectSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('Subject', SubjectSchema);
