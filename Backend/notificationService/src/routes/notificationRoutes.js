const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/notificationController');

const router = express.Router();
router.use(verifyToken);

router.get('/', asyncHandler(ctrl.list));
router.get('/unread-count', asyncHandler(ctrl.unreadCount));
router.patch('/:id/read', asyncHandler(ctrl.markRead));
router.patch('/read-all', asyncHandler(ctrl.markAllRead));

module.exports = router;
