const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema(
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
    examName: {
      type: String,
      required: [true, 'Exam name is required'],
      trim: true,
      maxlength: 200
    },
    examDate: {
      type: Date,
      required: [true, 'Exam date is required']
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    }
  },
  { timestamps: true }
);

ExamSchema.index({ userId: 1 });
ExamSchema.index({ examDate: 1 });

module.exports = mongoose.model('Exam', ExamSchema);
