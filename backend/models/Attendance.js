const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
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
    totalClasses: {
      type: Number,
      default: 0,
      min: 0
    },
    presentClasses: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

// One attendance document per user+subject; upserts target this compound index
AttendanceSchema.index({ userId: 1, subjectId: 1 }, { unique: true });

AttendanceSchema.virtual('percentage').get(function () {
  if (!this.totalClasses) return 0;
  return Math.round((this.presentClasses / this.totalClasses) * 10000) / 100;
});
AttendanceSchema.set('toJSON', { virtuals: true });
AttendanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
