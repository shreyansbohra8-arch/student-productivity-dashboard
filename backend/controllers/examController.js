const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const { verifySubjectOwnership } = require('../utils/verifySubjectOwnership');

function daysRemaining(examDate) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());
  const diffMs = target - today;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function labelFor(days) {
  if (days < 0) return 'Exam completed';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

async function listExams(req, res, next) {
  try {
    const exams = await Exam.find({ userId: req.userId }).sort({ examDate: 1 }).populate('subjectId', 'name color');
    const enriched = exams.map((e) => {
      const days = daysRemaining(e.examDate);
      return {
        ...e.toObject(),
        daysRemaining: days,
        countdownLabel: labelFor(days),
        state: days < 0 ? 'passed' : days === 0 ? 'today' : 'upcoming'
      };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

async function createExam(req, res, next) {
  try {
    const { examName, examDate, description, subjectId } = req.body;
    if (!examName || !examDate) {
      return res.status(400).json({ success: false, message: 'examName and examDate are required' });
    }

    const subjectCheck = await verifySubjectOwnership(subjectId, req.userId);
    if (!subjectCheck.ok) {
      return res.status(subjectCheck.status).json({ success: false, message: subjectCheck.message });
    }

    const exam = await Exam.create({
      userId: req.userId,
      examName,
      examDate,
      description,
      subjectId: subjectCheck.subjectId
    });
    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
}

async function updateExam(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid exam id' });
    }
    const allowed = ['examName', 'examDate', 'description', 'subjectId'];
    const update = {};
    for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f];

    if (Object.prototype.hasOwnProperty.call(update, 'subjectId')) {
      const subjectCheck = await verifySubjectOwnership(update.subjectId, req.userId);
      if (!subjectCheck.ok) {
        return res.status(subjectCheck.status).json({ success: false, message: subjectCheck.message });
      }
      update.subjectId = subjectCheck.subjectId;
    }

    const exam = await Exam.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
}

async function deleteExam(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid exam id' });
    }
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    res.json({ success: true, message: 'Exam deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listExams, createExam, updateExam, deleteExam };
