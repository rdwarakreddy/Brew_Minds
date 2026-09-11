const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/meetingController');

const router = express.Router();
router.use(verifyToken);

router.get('/', asyncHandler(ctrl.listByRange));
router.get('/history', asyncHandler(ctrl.history));
router.get('/:id', asyncHandler(ctrl.getOne));
router.post('/', asyncHandler(ctrl.create));
router.put('/:id', asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
