const mongoose = require('mongoose');

// Embedded subtask subdocument
const SubtaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Subtask title is required'],
      trim: true,
      maxlength: 200
    },
    completed: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true, _id: true }
);

const TaskSchema = new mongoose.Schema(
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
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required']
    },
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High', 'Urgent'],
        message: '{VALUE} is not a valid priority'
      },
      default: 'Medium'
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'In Progress', 'Completed'],
        message: '{VALUE} is not a valid status'
      },
      default: 'Pending'
    },
    // Embedded documents array
    subtasks: [SubtaskSchema]
  },
  { timestamps: true }
);

// Single-field index
TaskSchema.index({ userId: 1 });
// Compound index required by spec: efficient pending-task retrieval sorted by deadline
TaskSchema.index({ userId: 1, status: 1, deadline: 1 });

// Virtual: subtask completion progress
TaskSchema.virtual('subtaskProgress').get(function () {
  if (!this.subtasks || this.subtasks.length === 0) return 0;
  const done = this.subtasks.filter((s) => s.completed).length;
  return Math.round((done / this.subtasks.length) * 100);
});
TaskSchema.set('toJSON', { virtuals: true });
TaskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', TaskSchema);
