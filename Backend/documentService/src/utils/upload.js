/**
 * upload.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Configures multer (the standard Express file-upload middleware) to:
 *     - store uploaded files on local disk under UPLOAD_DIR
 *     - give each stored file a random UUID-based filename (never trust
 *       or reuse the original filename on disk -- avoids path traversal
 *       and filename collisions; the ORIGINAL name is kept separately
 *       in the database `name` column for display purposes)
 *     - reject files above MAX_FILE_SIZE_MB
 *     - only allow a safe allow-list of document-ish file extensions
 *       (blocks executable/script uploads outright)
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 15;

// Make sure the upload directory exists before multer tries to write to it.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.txt', '.csv', '.zip',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type "${ext}" is not allowed.`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR };
