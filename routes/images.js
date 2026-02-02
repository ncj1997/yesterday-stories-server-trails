/**
 * Image Upload Routes
 * Handles image uploads to Cloudinary and serves uploaded files
 */

const express = require('express');
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');
const router = express.Router();

// Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * POST /api/images
 * Upload an image file to Cloudinary and return the URL
 * Expects: multipart/form-data with 'image' field
 */
router.post('/', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Stream the file buffer directly to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: 'yesterday-stories/images', // Organize uploads in Cloudinary
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          return res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
        }

        console.log(`✅ Image uploaded to Cloudinary: ${result.public_id}`);
        console.log(`   URL: ${result.secure_url}`);
        console.log(`   Size: ${result.bytes} bytes`);

        res.status(201).json({
          success: true,
          message: 'Image uploaded successfully',
          imageUrl: result.secure_url,
          publicId: result.public_id,
          size: result.bytes,
          width: result.width,
          height: result.height,
        });
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    Readable.from(req.file.buffer).pipe(stream);
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

/**
 * DELETE /api/images/:publicId
 * Delete an image from Cloudinary
 */
router.delete('/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    // Reconstruct the full public_id with folder
    const fullPublicId = `yesterday-stories/images/${publicId}`;
    
    const result = await cloudinary.uploader.destroy(fullPublicId);
    
    if (result.result === 'ok') {
      console.log(`✅ Image deleted: ${fullPublicId}`);
      res.json({ success: true, message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
