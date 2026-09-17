const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/attendanceController');

router.use(protect);
router.get('/', ctrl.listAttendance);
router.post('/mark', ctrl.markAttendance);
router.delete('/:id', ctrl.deleteAttendance);

module.exports = router;
