const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/paymentController');

const router = express.Router();
router.use(verifyToken);

router.get('/summary', asyncHandler(ctrl.summary));
router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));
router.put('/:id', asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
