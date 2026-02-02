/**
 * Yesterday Stories - Draft Trails & Image Upload Server
 * 
 * Run with: npm install && node index.js
 * 
 * Features:
 * - Draft trail management with 7-day expiration
 * - Image upload and serving
 * - Video upload and serving
 * - Reference code system for payment resume
 * - JSON file storage for mock server testing
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const upload = require('./middleware/upload');
const dataStore = require('./config/dataStore');
const draftTrailsRouter = require('./routes/draftTrails');
const imagesRouter = require('./routes/images');
const videosRouter = require('./routes/videos');

const app = express();
const PORT = process.env.PORT || 3001;
//hello
// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// API ROUTES
// ============================================================================

// Draft trails routes (save, retrieve, update, delete)
app.use('/api/draft-trails', draftTrailsRouter);

// Image upload routes (with multer middleware for image uploads)
app.use('/api/images', upload.single('image'), imagesRouter);

// Video upload routes (with multer middleware for video uploads)
app.use('/api/videos', upload.uploadVideo.single('video'), videosRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Handle multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const isVideo = req.path.includes('/api/videos');
      const limit = isVideo ? '500MB' : '10MB';
      return res.status(400).json({ error: `File size exceeds ${limit} limit` });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err.message && err.message.includes('Invalid')) {
    console.error('Upload error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  // Clean up expired drafts on startup
  dataStore.cleanupExpiredDrafts();

  console.log('\n' + '═'.repeat(70));
  console.log('🚀 Yesterday Stories - Server Started');
  console.log('═'.repeat(70) + '\n');

  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

  console.log('📡 Available Endpoints:\n');

  console.log('  DRAFT TRAILS (JSON Storage) - Token-Based Authentication:');
  console.log(`    POST   http://localhost:${PORT}/api/draft-trails`);
  console.log(`           (Returns token for authenticated requests)\n`);
  console.log(`    GET    http://localhost:${PORT}/api/draft-trails/my-drafts`);
  console.log(`           (Requires: Authorization: Bearer <token>)\n`);
  console.log(`    GET    http://localhost:${PORT}/api/draft-trails/:referenceCode`);
  console.log(`           (Get specific draft by reference code)\n`);
  console.log(`    PUT    http://localhost:${PORT}/api/draft-trails/:referenceCode/status`);
  console.log(`           (Requires: Authorization: Bearer <token>)\n`);
  console.log(`    DELETE http://localhost:${PORT}/api/draft-trails/:referenceCode`);
  console.log(`           (Requires: Authorization: Bearer <token>)\n`);
  console.log(`    GET    http://localhost:${PORT}/api/draft-trails/user/:userId`);
  console.log(`           (DEPRECATED - Use /my-drafts with token instead)\n`);
  console.log(`    GET    http://localhost:${PORT}/api/draft-trails (all drafts)\n`);

  console.log('  IMAGE UPLOADS:');
  console.log(`    POST   http://localhost:${PORT}/api/images (upload image)`);
  console.log(`    GET    http://localhost:${PORT}/uploads/:filename (download image)\n`);

  console.log('  VIDEO UPLOADS:');
  console.log(`    POST   http://localhost:${PORT}/api/videos (upload video)`);
  console.log(`    GET    http://localhost:${PORT}/uploads/:filename (download video)\n`);

  console.log('  HEALTH:');
  console.log(`    GET    http://localhost:${PORT}/health\n`);

  console.log('📁 Data & Directories:');
  console.log(`    data directory: ./data/`);
  console.log(`    drafts (JSON): ./data/draftTrails.json`);
  console.log(`    uploads: ./uploads/`);
  console.log(`    config:  ./config/`);
  console.log(`    routes:  ./routes/`);
  console.log(`    middleware: ./middleware/\n`);

  console.log('═'.repeat(70) + '\n');
});

module.exports = app;
