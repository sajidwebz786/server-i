const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/apiError');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const cloudinaryEnabled = Boolean(process.env.CLOUDINARY_URL);
if (cloudinaryEnabled) cloudinary.config({ secure: true });

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
  const selectedStorage = cloudinaryEnabled
    ? new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder: `luminateads/${folder}`,
        resource_type: 'auto',
        public_id: folder === 'profiles' && req.user?.id
          ? `user-${req.user.id}`
          : `${req.user?.id || 'public'}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        format: path.extname(file.originalname).replace('.', '').toLowerCase() || undefined,
        overwrite: folder === 'profiles',
        invalidate: folder === 'profiles',
        type: 'upload'
      })
    })
    : storage(folder);
  return multer({
    storage: selectedStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

function uploadedFileUrl(file, folder) {
  if (!file) return null;
  return file.path && /^https?:\/\//i.test(file.path)
    ? file.path
    : `/uploads/${folder}/${file.filename}`;
}

module.exports = { uploader, uploadedFileUrl };
