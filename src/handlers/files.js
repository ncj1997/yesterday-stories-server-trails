/**
 * Lambda Handler: File Uploads (Images & Videos)
 * POST /images - Upload image to S3
 * POST /videos - Upload video to S3
 * GET /files/{referenceCode} - Get files for a draft
 */

const filesService = require('../services/filesService');
const { httpResponse, getPathParam } = require('../utils/http');

/**
 * Helper to convert base64 to buffer (for API Gateway with binary support)
 */
const getFileBuffer = (event) => {
  if (event.isBase64Encoded && event.body) {
    return Buffer.from(event.body, 'base64');
  }
  if (event.body instanceof Buffer) {
    return event.body;
  }
  return null;
};

/**
 * POST /images
 * Upload image to S3
 * Expects multipart form data or base64 encoded image in body
 */
const uploadImage = async (event) => {
  try {
    const referenceCode = event.pathParameters?.referenceCode || event.queryStringParameters?.referenceCode;
    const userId = event.pathParameters?.userId || event.queryStringParameters?.userId;

    if (!referenceCode || !userId) {
      return httpResponse.error('Missing referenceCode or userId parameter');
    }

    // For API Gateway with binary support
    const fileBuffer = getFileBuffer(event);
    if (!fileBuffer) {
      return httpResponse.error('No image data provided');
    }

    // Validate image file type
    const contentType = event.headers?.['content-type'] || 'image/jpeg';
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!validImageTypes.includes(contentType)) {
      return httpResponse.error('Invalid image type. Allowed: JPEG, PNG, GIF, WebP');
    }

    // Check file size (max 10MB)
    if (fileBuffer.length > 10 * 1024 * 1024) {
      return httpResponse.error('File size exceeds 10MB limit');
    }

    const result = await filesService.uploadFile(
      fileBuffer,
      'image',
      contentType,
      referenceCode,
      userId
    );

    return httpResponse.success(
      {
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: result.url,
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
 * Upload video to S3
 * Expects multipart form data or base64 encoded video in body
 */
const uploadVideo = async (event) => {
  try {
    const referenceCode = event.pathParameters?.referenceCode || event.queryStringParameters?.referenceCode;
    const userId = event.pathParameters?.userId || event.queryStringParameters?.userId;

    if (!referenceCode || !userId) {
      return httpResponse.error('Missing referenceCode or userId parameter');
    }

    // For API Gateway with binary support
    const fileBuffer = getFileBuffer(event);
    if (!fileBuffer) {
      return httpResponse.error('No video data provided');
    }

    // Validate video file type
    const contentType = event.headers?.['content-type'] || 'video/mp4';
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

    if (!validVideoTypes.includes(contentType)) {
      return httpResponse.error('Invalid video type. Allowed: MP4, WebM, MOV, AVI');
    }

    // Check file size (max 500MB)
    if (fileBuffer.length > 500 * 1024 * 1024) {
      return httpResponse.error('File size exceeds 500MB limit');
    }

    const result = await filesService.uploadFile(
      fileBuffer,
      'video',
      contentType,
      referenceCode,
      userId
    );

    return httpResponse.success(
      {
        success: true,
        message: 'Video uploaded successfully',
        videoUrl: result.url,
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

/**
 * GET /files/{referenceCode}
 * Get all files (images + videos) for a draft
 */
const getFilesByReference = async (event) => {
  try {
    const referenceCode = getPathParam(event, 'referenceCode');

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode parameter');
    }

    const files = await filesService.getFilesByReference(referenceCode);

    return httpResponse.success({
      success: true,
      count: files.length,
      data: files,
    });
  } catch (error) {
    console.error('❌ Error getting files:', error);
    return httpResponse.serverError('Failed to get files');
  }
};

module.exports = {
  uploadImage,
  uploadVideo,
  getFilesByReference,
};
