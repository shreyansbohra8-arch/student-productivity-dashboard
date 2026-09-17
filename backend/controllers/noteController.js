const mongoose = require('mongoose');
const Note = require('../models/Note');
const { verifySubjectOwnership } = require('../utils/verifySubjectOwnership');

// Projection: only the fields the Notes frontend actually renders (list/card view).
// Applied to both the plain listing and the $text-search listing below.
const NOTE_LIST_PROJECTION = { title: 1, content: 1, subjectId: 1, tags: 1, createdAt: 1, updatedAt: 1 };

// GET /api/notes?page=&limit=&q=&subjectId=
async function listNotes(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.userId };
    if (req.query.subjectId && mongoose.isValidObjectId(req.query.subjectId)) {
      filter.subjectId = req.query.subjectId;
    }

    let query;
    let countFilter = filter;

    if (req.query.q && req.query.q.trim()) {
      // Real MongoDB full-text search using the text index on title/content.
      // The projection includes the textScore meta field alongside the normal
      // listing fields, so search results still carry title/content/tags
      // instead of being reduced to just _id + score.
      filter.$text = { $search: req.query.q.trim() };
      countFilter = filter;
      query = Note.find(filter, { ...NOTE_LIST_PROJECTION, score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit);
    } else {
      query = Note.find(filter)
        .select(NOTE_LIST_PROJECTION)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    const [notes, totalItems] = await Promise.all([query, Note.countDocuments(countFilter)]);

    res.json({
      success: true,
      data: notes,
      pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit) || 1, totalItems, limit }
    });
  } catch (err) {
    next(err);
  }
}

async function createNote(req, res, next) {
  try {
    const { title, content, subjectId, tags } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const subjectCheck = await verifySubjectOwnership(subjectId, req.userId);
    if (!subjectCheck.ok) {
      return res.status(subjectCheck.status).json({ success: false, message: subjectCheck.message });
    }

    const note = await Note.create({
      userId: req.userId,
      title,
      content,
      subjectId: subjectCheck.subjectId,
      tags: Array.isArray(tags) ? tags : []
    });
    res.status(201).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
}

async function updateNote(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid note id' });
    }
    const allowed = ['title', 'content', 'subjectId', 'tags'];
    const update = {};
    for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f];

    if (Object.prototype.hasOwnProperty.call(update, 'subjectId')) {
      const subjectCheck = await verifySubjectOwnership(update.subjectId, req.userId);
      if (!subjectCheck.ok) {
        return res.status(subjectCheck.status).json({ success: false, message: subjectCheck.message });
      }
      update.subjectId = subjectCheck.subjectId;
    }

    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
}

async function deleteNote(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid note id' });
    }
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotes, createNote, updateNote, deleteNote };
