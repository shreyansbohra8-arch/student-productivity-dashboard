const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Subject = require('../models/Subject');

async function listAttendance(req, res, next) {
  try {
    const records = await Attendance.find({ userId: req.userId }).populate('subjectId', 'name code color');
    const threshold = req.user.attendanceThreshold || 75;
    const withStatus = records.map((r) => {
      const pct = r.totalClasses ? Math.round((r.presentClasses / r.totalClasses) * 10000) / 100 : 0;
      return {
        ...r.toObject(),
        percentage: pct,
        state: pct >= threshold ? 'safe' : pct >= threshold - 10 ? 'warning' : 'shortage'
      };
    });
    res.json({ success: true, data: withStatus, threshold });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/mark  { subjectId, status: 'Present' | 'Absent' }
// Uses a real MongoDB upsert: one attendance doc per (userId, subjectId)
async function markAttendance(req, res, next) {
  try {
    const { subjectId, status } = req.body;
    if (!subjectId || !mongoose.isValidObjectId(subjectId)) {
      return res.status(400).json({ success: false, message: 'A valid subjectId is required' });
    }
    if (!['Present', 'Absent'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'Present' or 'Absent'" });
    }

    const subject = await Subject.findOne({ _id: subjectId, userId: req.userId });
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    const increments = { totalClasses: 1 };
    if (status === 'Present') increments.presentClasses = 1;

    const record = await Attendance.findOneAndUpdate(
      { userId: req.userId, subjectId },
      { $inc: increments, $setOnInsert: { userId: req.userId, subjectId } },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function deleteAttendance(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance id' });
    }
    const record = await Attendance.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    res.json({ success: true, message: 'Attendance record deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAttendance, markAttendance, deleteAttendance };
