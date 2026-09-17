const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/subjectController');

router.use(protect);
router.get('/', ctrl.listSubjects);
router.post('/', ctrl.createSubject);
router.patch('/:id', ctrl.updateSubject);
router.delete('/:id', ctrl.deleteSubject);

module.exports = router;
