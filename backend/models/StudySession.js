const mongoose = require('mongoose');

const StudySessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    mode: {
      type: String,
      enum: ['Focus', 'Short Break', 'Long Break'],
      default: 'Focus'
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 minute']
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

StudySessionSchema.index({ userId: 1 });
StudySessionSchema.index({ subjectId: 1 });
StudySessionSchema.index({ userId: 1, completedAt: -1 });

module.exports = mongoose.model('StudySession', StudySessionSchema);
