const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/examController');

router.use(protect);
router.get('/', ctrl.listExams);
router.post('/', ctrl.createExam);
router.patch('/:id', ctrl.updateExam);
router.delete('/:id', ctrl.deleteExam);

module.exports = router;
