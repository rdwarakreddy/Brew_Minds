const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/projectController');

const router = express.Router();
router.use(verifyToken);

router.get('/board', asyncHandler(ctrl.listByBoard));
router.get('/lookup', asyncHandler(ctrl.lookup));
router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.getOne));
router.post('/', asyncHandler(ctrl.create));
router.put('/:id', asyncHandler(ctrl.update));
router.patch('/:id/move', asyncHandler(ctrl.move));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
