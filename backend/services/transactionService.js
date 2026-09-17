const mongoose = require('mongoose');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Task = require('../models/Task');
const StudySession = require('../models/StudySession');
const Attendance = require('../models/Attendance');
const Note = require('../models/Note');
const Exam = require('../models/Exam');

/**
 * Atomically deletes a user and every document that references them.
 *
 * IMPORTANT: MongoDB multi-document transactions require the server to be
 * running as a replica set (or a MongoDB Atlas cluster, which is always a
 * replica set under the hood). A single standalone `mongod` instance will
 * throw "Transaction numbers are only allowed on a replica set member".
 * See README.md > "MongoDB Setup" for how to enable a local single-node
 * replica set for development.
 */
async function deleteUserWithTransaction(userId) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await Task.deleteMany({ userId }, { session });
    await Note.deleteMany({ userId }, { session });
    await Attendance.deleteMany({ userId }, { session });
    await StudySession.deleteMany({ userId }, { session });
    await Exam.deleteMany({ userId }, { session });
    await Subject.deleteMany({ userId }, { session });
    const deletedUser = await User.findByIdAndDelete(userId, { session });

    await session.commitTransaction();
    return deletedUser;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { deleteUserWithTransaction };
