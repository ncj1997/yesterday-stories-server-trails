/**
 * Multer Configuration & Middleware
 * Handles file upload configuration with Cloudinary storage
 */

const multer = require('multer');
const path = require('path');

// Use memory storage instead of disk storage
// Files will be streamed directly to Cloudinary
const storage = multer.memoryStorage();

// Configure multer with validation for images
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Configure multer with validation for videos
const uploadVideo = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for videos
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/ogg'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video type. Only MP4, MPEG, MOV, AVI, WebM, and OGG are allowed.'));
    }
  }
});

module.exports = upload;
module.exports.uploadVideo = uploadVideo;
