const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    attendanceThreshold: user.attendanceThreshold,
    dailyStudyGoalMinutes: user.dailyStudyGoalMinutes,
    createdAt: user.createdAt
  };
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are all required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashedPassword });
    const token = signToken(user._id);

    res.status(201).json({ success: true, data: { user: sanitizeUser(user), token } });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.json({ success: true, data: { user: sanitizeUser(user), token } });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function getMe(req, res, next) {
  try {
    res.json({ success: true, data: { user: sanitizeUser(req.user) } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/auth/settings
async function updateSettings(req, res, next) {
  try {
    const { attendanceThreshold, dailyStudyGoalMinutes } = req.body;

    if (attendanceThreshold !== undefined) {
      req.user.attendanceThreshold = attendanceThreshold;
    }

    if (dailyStudyGoalMinutes !== undefined) {
      const goal = Number(dailyStudyGoalMinutes);

      if (!Number.isInteger(goal) || goal < 30 || goal > 1440) {
        return res.status(400).json({
          success: false,
          message: 'Daily study goal must be between 30 and 1440 minutes'
        });
      }

      req.user.dailyStudyGoalMinutes = goal;
    }

    if (attendanceThreshold !== undefined || dailyStudyGoalMinutes !== undefined) {
      await req.user.save();
    }
    res.json({ success: true, data: { user: sanitizeUser(req.user) } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, updateSettings, sanitizeUser };
