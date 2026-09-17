const mongoose = require('mongoose');
const Task = require('../models/Task');
const { verifySubjectOwnership } = require('../utils/verifySubjectOwnership');

// GET /api/tasks?page=1&limit=10&status=&priority=&sort=deadline
async function listTasks(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.subjectId && mongoose.isValidObjectId(req.query.subjectId)) {
      filter.subjectId = req.query.subjectId;
    }
    if (req.query.overdue === 'true') {
      filter.deadline = { $lt: new Date() };
      filter.status = { $ne: 'Completed' };
    }

    let sortField = 'deadline';
    let sortDir = 1;
    if (req.query.sort) {
      const raw = req.query.sort;
      sortDir = raw.startsWith('-') ? -1 : 1;
      sortField = raw.replace(/^-/, '');
    }
    const allowedSortFields = ['deadline', 'priority', 'createdAt', 'title'];
    if (!allowedSortFields.includes(sortField)) sortField = 'deadline';

    // Projection: only return fields needed for listing view
    const [tasks, totalItems] = await Promise.all([
      Task.find(filter)
        .select('title priority status deadline subjectId subtasks createdAt')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit),
      Task.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        totalItems,
        limit
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getTask(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

async function createTask(req, res, next) {
  try {
    const { title, description, deadline, priority, status, subjectId, subtasks } = req.body;
    if (!title || !deadline) {
      return res.status(400).json({ success: false, message: 'Title and deadline are required' });
    }

    const subjectCheck = await verifySubjectOwnership(subjectId, req.userId);
    if (!subjectCheck.ok) {
      return res.status(subjectCheck.status).json({ success: false, message: subjectCheck.message });
    }

    const task = await Task.create({
      userId: req.userId,
      title,
      description,
      deadline,
      priority,
      status,
      subjectId: subjectCheck.subjectId,
      subtasks: Array.isArray(subtasks) ? subtasks : []
    });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }
    const allowedFields = ['title', 'description', 'deadline', 'priority', 'status', 'subjectId'];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    if (Object.prototype.hasOwnProperty.call(update, 'subjectId')) {
      const subjectCheck = await verifySubjectOwnership(update.subjectId, req.userId);
      if (!subjectCheck.ok) {
        return res.status(subjectCheck.status).json({ success: false, message: subjectCheck.message });
      }
      update.subjectId = subjectCheck.subjectId;
    }

    // $set demonstrates targeted field update
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks/:id/subtasks  -- $push
async function addSubtask(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Subtask title is required' });

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $push: { subtasks: { title, completed: false } } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:id/subtasks/:subtaskId -- $set on matched array element (positional operator)
async function updateSubtask(req, res, next) {
  try {
    const { id, subtaskId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(subtaskId)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const update = {};
    if (req.body.title !== undefined) update['subtasks.$.title'] = req.body.title;
    if (req.body.completed !== undefined) update['subtasks.$.completed'] = req.body.completed;

    // $elemMatch-style targeting via positional operator, matched using array filter condition
    const task = await Task.findOneAndUpdate(
      { _id: id, userId: req.userId, subtasks: { $elemMatch: { _id: subtaskId } } },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task or subtask not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tasks/:id/subtasks/:subtaskId -- $pull
async function deleteSubtask(req, res, next) {
  try {
    const { id, subtaskId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(subtaskId)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const task = await Task.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $pull: { subtasks: { _id: subtaskId } } },
      { new: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addSubtask,
  updateSubtask,
  deleteSubtask
};
