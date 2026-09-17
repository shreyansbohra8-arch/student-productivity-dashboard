const Subject = require('../models/Subject');
const mongoose = require('mongoose');

async function listSubjects(req, res, next) {
  try {
    const subjects = await Subject.find({ userId: req.userId }).sort({ name: 1 });
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
}

async function createSubject(req, res, next) {
  try {
    const { name, code, color } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Subject name is required' });

    const subject = await Subject.create({ userId: req.userId, name, code, color });
    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
}

async function updateSubject(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid subject id' });
    }

    // Explicit allow-list instead of spreading req.body directly into $set --
    // prevents a client from smuggling userId (or any other field) into the
    // update and reassigning a subject to a different user.
    const allowedFields = ['name', 'code', 'color'];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
}

async function deleteSubject(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid subject id' });
    }
    const subject = await Subject.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    res.json({ success: true, message: 'Subject deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSubjects, createSubject, updateSubject, deleteSubject };
