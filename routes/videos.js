/**
 * Video Upload Routes
 * Handles video uploads and serving uploaded files
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const PORT = process.env.PORT || 3001;
const uploadsDir = path.join(__dirname, '..', 'uploads');

/**
 * POST /api/videos
 * Upload a video file and return the URL
 * Expects: multipart/form-data with 'video' field
 */
router.post('/', (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    // Generate the video URL (relative path that the client can access)
    const videoUrl = `/uploads/${req.file.filename}`;
    
    console.log(`✅ Video uploaded: ${req.file.filename}`);
    console.log(`   URL: http://localhost:${PORT}${videoUrl}`);
    console.log(`   Size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB`);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      videoUrl, // Relative URL for client to use
      filename: req.file.filename,
      size: req.file.size,
      fullUrl: `http://localhost:${PORT}${videoUrl}`, // Full URL for reference
    });
  } catch (error) {
    console.error('❌ Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

/**
 * GET /uploads/:filename
 * Serve uploaded videos
 */
router.get('/:filename', (req, res) => {
  try {
    const filepath = path.join(uploadsDir, req.params.filename);
    
    // Security: prevent directory traversal
    if (!filepath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.sendFile(filepath);
  } catch (error) {
    console.error('❌ Error serving video:', error);
    res.status(500).json({ error: 'Failed to serve video' });
  }
});

module.exports = router;
