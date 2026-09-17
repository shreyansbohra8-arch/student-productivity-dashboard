const { deleteUserWithTransaction } = require('../services/transactionService');

// DELETE /api/users/me
// Demonstrates a multi-document MongoDB transaction: deleting a user
// atomically cascades to all of their tasks, notes, attendance,
// study sessions, exams, and subjects.
async function deleteMyAccount(req, res, next) {
  try {
    const deleted = await deleteUserWithTransaction(req.userId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'Account and all associated data deleted' });
  } catch (err) {
    if (err.message && err.message.includes('Transaction numbers are only allowed on a replica set')) {
      return res.status(500).json({
        success: false,
        message:
          'Transactions require MongoDB to run as a replica set (or Atlas). See README.md for setup instructions.'
      });
    }
    next(err);
  }
}

module.exports = { deleteMyAccount };
