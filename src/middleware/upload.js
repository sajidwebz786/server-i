const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/apiError');

function storage(folder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', '..', 'uploads', folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
    }
  });
}

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
    return cb(new ApiError(400, 'Only image or PDF uploads are allowed'));
  }
  return cb(null, true);
}

function uploader(folder) {
  return multer({
    storage: storage(folder),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

module.exports = { uploader };
