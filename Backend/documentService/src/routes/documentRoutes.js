const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const { upload } = require('../utils/upload');
const ctrl = require('../controllers/documentController');

const router = express.Router();
router.use(verifyToken);

router.get('/', asyncHandler(ctrl.list));
// "type=file" upload goes through multer first (parses multipart/form-data)
router.post('/file', upload.single('file'), asyncHandler(ctrl.createFile));
// "type=link" is a plain JSON POST
router.post('/link', asyncHandler(ctrl.createLink));
router.get('/:id/download', asyncHandler(ctrl.download));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
