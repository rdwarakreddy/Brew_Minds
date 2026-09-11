const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/taskController');

const router = express.Router();
router.use(verifyToken);

router.get('/board', asyncHandler(ctrl.listByBoard));
router.get('/today', asyncHandler(ctrl.listToday));
router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));
router.put('/:id', asyncHandler(ctrl.update));
router.patch('/:id/move', asyncHandler(ctrl.move));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
