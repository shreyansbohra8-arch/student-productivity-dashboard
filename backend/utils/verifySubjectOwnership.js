const mongoose = require('mongoose');
const Subject = require('../models/Subject');

/**
 * Verifies that a given subjectId, if provided, is a real Subject document
 * that belongs to the requesting user. Used anywhere a resource (Task, Note,
 * Exam, StudySession) accepts a subjectId, so one user can never attach
 * another user's subject to their own data.
 *
 * @param {string|null|undefined} subjectId
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<{ok: true, subjectId: string|null} | {ok: false, status: number, message: string}>}
 */
async function verifySubjectOwnership(subjectId, userId) {
  // subjectId is optional on Task/Note/Exam -- null/undefined/'' means "no subject"
  if (subjectId === undefined || subjectId === null || subjectId === '') {
    return { ok: true, subjectId: null };
  }

  if (!mongoose.isValidObjectId(subjectId)) {
    return { ok: false, status: 400, message: 'Invalid subjectId' };
  }

  const subject = await Subject.findOne({ _id: subjectId, userId }).select('_id');
  if (!subject) {
    return { ok: false, status: 404, message: 'Subject not found or does not belong to this user' };
  }

  return { ok: true, subjectId };
}

module.exports = { verifySubjectOwnership };
