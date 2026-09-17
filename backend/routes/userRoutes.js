const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { deleteMyAccount } = require('../controllers/userController');

router.use(protect);
router.delete('/me', deleteMyAccount);

module.exports = router;
