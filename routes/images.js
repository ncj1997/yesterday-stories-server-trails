/**
 * Image Upload Routes
 * Handles image uploads and serving uploaded files
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const PORT = process.env.PORT || 3001;
const uploadsDir = path.join(__dirname, '..', 'uploads');

/**
 * POST /api/images
 * Upload an image file and return the URL
 * Expects: multipart/form-data with 'image' field
 */
router.post('/', (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Generate the image URL (relative path that the client can access)
    const imageUrl = `/uploads/${req.file.filename}`;
    
    console.log(`✅ Image uploaded: ${req.file.filename}`);
    console.log(`   URL: http://localhost:${PORT}${imageUrl}`);
    console.log(`   Size: ${req.file.size} bytes`);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl, // Relative URL for client to use
      filename: req.file.filename,
      size: req.file.size,
      fullUrl: `http://localhost:${PORT}${imageUrl}`, // Full URL for reference
    });
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

/**
 * GET /uploads/:filename
 * Serve uploaded images
 */
router.get('/:filename', (req, res) => {
  try {
    const filepath = path.join(uploadsDir, req.params.filename);
    
    // Security: prevent directory traversal
    if (!filepath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.sendFile(filepath);
  } catch (error) {
    console.error('❌ Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

module.exports = router;
