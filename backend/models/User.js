const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false
    },
    attendanceThreshold: {
      type: Number,
      default: 75,
      min: 0,
      max: 100
    },
    dailyStudyGoalMinutes: {
      type: Number,
      default: 180,
      min: 30,
      max: 1440
    }
  },
  { timestamps: true }
);

// Note: `unique: true` on the email field above already creates a single-field
// unique index -- no separate UserSchema.index() call is needed (declaring
// both causes a duplicate-index warning from Mongoose at connect time).

module.exports = mongoose.model('User', UserSchema);
