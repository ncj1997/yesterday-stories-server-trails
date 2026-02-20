/**
 * Lambda Handler: File Uploads (Images & Videos)
 * POST /images - Upload image
 * POST /videos - Upload video
 */

const filesService = require('../services/filesService');
const { httpResponse, getPathParam } = require('../utils/http');
const { verifyAuthToken } = require('../middleware/auth-sequelize');
const busboy = require('busboy');

/**
 * Parse multipart form-data to extract file buffer and MIME type
 * Returns { fileBuffer, mimeType }
 */
const parseMultipartFormData = (event) => {
  return new Promise((resolve, reject) => {
    // Convert body to buffer if base64 encoded
    let body = event.body;
    if (event.isBase64Encoded && typeof body === 'string') {
      body = Buffer.from(body, 'base64');
    }
    
    // Prepare headers for busboy - it expects lowercase keys
    const headers = {};
    for (const [key, value] of Object.entries(event.headers || {})) {
      headers[key.toLowerCase()] = value;
    }
    
    console.log('[FILES] 📦 Parsing multipart form-data');
    console.log('[FILES] Headers:', JSON.stringify(headers, null, 2));
    
    const bb = busboy({ headers });
    let fileBuffer = null;
    let mimeType = 'application/octet-stream';

    bb.on('file', (fieldname, file, info) => {
      console.log(`[FILES] 📄 File field: ${fieldname}, mimeType: ${info.mimeType}`);
      const chunks = [];
      
      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
        mimeType = info.mimeType || 'application/octet-stream';
        console.log(`[FILES] ✅ File parsed: ${chunks.length} chunks, size: ${fileBuffer.length}, mimeType: ${mimeType}`);
      });

      file.on('error', (error) => {
        reject(new Error(`File parsing error: ${error.message}`));
      });
    });

    bb.on('error', (error) => {
      console.error('[FILES] ❌ Busboy error:', error.message);
      reject(new Error(`Multipart parsing error: ${error.message}`));
    });

    bb.on('close', () => {
      if (fileBuffer) {
        resolve({ fileBuffer, mimeType });
      } else {
        reject(new Error('No file found in multipart data'));
      }
    });

    bb.write(body);
    bb.end();
  });
};

/**
 * POST /images
 * Upload image without requiring a reference code
 * Returns the image URL for use in trail or custom story creation
 * REQUIRES AUTH
 */
const uploadImage = async (event) => {
  try {
    // Verify authentication
    const auth = await verifyAuthToken(event);
    if (!auth.authenticated) {
      console.warn(`[FILES] ❌ Authentication failed: ${auth.message}`);
      return httpResponse.error(auth.message, 401);
    }

    // Parse multipart form-data to extract file
    let fileBuffer, mimeType;
    try {
      const parsed = await parseMultipartFormData(event);
      fileBuffer = parsed.fileBuffer;
      mimeType = parsed.mimeType;
    } catch (parseError) {
      console.error(`[FILES] ❌ Multipart parse error:`, parseError.message);
      return httpResponse.error(`File parsing failed: ${parseError.message}`);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return httpResponse.error('No image data provided');
    }

    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!validImageTypes.includes(mimeType)) {
      return httpResponse.error(`Invalid image type: ${mimeType}. Allowed: JPEG, PNG, GIF, WebP`);
    }

    // Check file size (max 10MB)
    if (fileBuffer.length > 10 * 1024 * 1024) {
      return httpResponse.error('File size exceeds 10MB limit');
    }

    const result = await filesService.uploadFile(fileBuffer, 'image', mimeType);

    return httpResponse.success(
      {
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: result.url,
        mimeType: result.mimeType,
        s3Key: result.s3Key,
        size: result.size,
      },
      201
    );
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    return httpResponse.serverError('Failed to upload image');
  }
};

/**
 * POST /videos
 * Upload video without requiring a reference code
 * Returns the video URL for use in trail or custom story creation
 * REQUIRES AUTH
 */
const uploadVideo = async (event) => {
  try {
    // Verify authentication
    const auth = await verifyAuthToken(event);
    if (!auth.authenticated) {
      console.warn(`[FILES] ❌ Authentication failed: ${auth.message}`);
      return httpResponse.error(auth.message, 401);
    }

    // Parse multipart form-data to extract file
    let fileBuffer, mimeType;
    try {
      const parsed = await parseMultipartFormData(event);
      fileBuffer = parsed.fileBuffer;
      mimeType = parsed.mimeType;
    } catch (parseError) {
      console.error(`[FILES] ❌ Multipart parse error:`, parseError.message);
      return httpResponse.error(`File parsing failed: ${parseError.message}`);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return httpResponse.error('No video data provided');
    }

    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

    if (!validVideoTypes.includes(mimeType)) {
      return httpResponse.error(`Invalid video type: ${mimeType}. Allowed: MP4, WebM, MOV, AVI`);
    }

    // Check file size (max 500MB)
    if (fileBuffer.length > 500 * 1024 * 1024) {
      return httpResponse.error('File size exceeds 500MB limit');
    }

    const result = await filesService.uploadFile(fileBuffer, 'video', mimeType);

    return httpResponse.success(
      {
        success: true,
        message: 'Video uploaded successfully',
        videoUrl: result.url,
        mimeType: result.mimeType,
        s3Key: result.s3Key,
        size: result.size,
      },
      201
    );
  } catch (error) {
    console.error('❌ Error uploading video:', error);
    return httpResponse.serverError('Failed to upload video');
  }
};

module.exports = {
  uploadImage,
  uploadVideo,
};
