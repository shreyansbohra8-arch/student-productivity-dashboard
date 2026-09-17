const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/noteController');

router.use(protect);
router.get('/', ctrl.listNotes);
router.post('/', ctrl.createNote);
router.patch('/:id', ctrl.updateNote);
router.delete('/:id', ctrl.deleteNote);

module.exports = router;
