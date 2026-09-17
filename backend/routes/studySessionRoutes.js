const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/studySessionController');

router.use(protect);
router.get('/', ctrl.listSessions);
router.post('/', ctrl.createSession);
router.delete('/:id', ctrl.deleteSession);

module.exports = router;
