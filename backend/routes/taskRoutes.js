const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/taskController');

router.use(protect);
router.get('/', ctrl.listTasks);
router.post('/', ctrl.createTask);
router.get('/:id', ctrl.getTask);
router.patch('/:id', ctrl.updateTask);
router.delete('/:id', ctrl.deleteTask);
router.post('/:id/subtasks', ctrl.addSubtask);
router.patch('/:id/subtasks/:subtaskId', ctrl.updateSubtask);
router.delete('/:id/subtasks/:subtaskId', ctrl.deleteSubtask);

module.exports = router;
