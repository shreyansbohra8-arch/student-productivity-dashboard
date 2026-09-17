const mongoose = require('mongoose');
const StudySession = require('../models/StudySession');
const { verifySubjectOwnership } = require('../utils/verifySubjectOwnership');

async function listSessions(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [sessions, totalItems] = await Promise.all([
      StudySession.find({ userId: req.userId })
        .populate('subjectId', 'name color')
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit),
      StudySession.countDocuments({ userId: req.userId })
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit) || 1, totalItems, limit }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/study-sessions  -- log a completed pomodoro session
async function createSession(req, res, next) {
  try {
    const { subjectId, mode, durationMinutes } = req.body;
    if (!subjectId || !mongoose.isValidObjectId(subjectId)) {
      return res.status(400).json({ success: false, message: 'A valid subjectId is required' });
    }
    if (!durationMinutes || durationMinutes < 1) {
      return res.status(400).json({ success: false, message: 'durationMinutes must be at least 1' });
    }

    // subjectId is required for a study session, so an ownership failure here
    // always means "not found / not yours" rather than "no subject selected".
    const subjectCheck = await verifySubjectOwnership(subjectId, req.userId);
    if (!subjectCheck.ok || !subjectCheck.subjectId) {
      return res.status(404).json({ success: false, message: 'Subject not found or does not belong to this user' });
    }

    const session = await StudySession.create({
      userId: req.userId,
      subjectId: subjectCheck.subjectId,
      mode: mode || 'Focus',
      durationMinutes,
      completedAt: new Date()
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid session id' });
    }
    const session = await StudySession.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ success: false, message: 'Study session not found' });
    res.json({ success: true, message: 'Study session deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSessions, createSession, deleteSession };
