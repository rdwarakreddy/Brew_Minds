const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/dashboardController');

const router = express.Router();
router.use(verifyToken);

router.get('/overview', asyncHandler(ctrl.overview));

module.exports = router;
