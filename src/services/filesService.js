/**
 * Files Service (Images & Videos)
 * Handles file uploads to AWS S3
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize S3 with AWS credentials
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

console.log('[FILES] 🌐 Using AWS S3 for file storage');

// Map MIME types to file extensions
const mimeToExtension = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/webm': '.webm',
};

const getFileExtension = (mimeType) => {
  return mimeToExtension[mimeType] || '';
};

const filesService = {
  /**
   * Upload file to S3
   * Returns URL for use in trail or custom story
   */
  async uploadFile(fileBuffer, fileType, mimeType) {
    try {
      const fileExtension = getFileExtension(mimeType);
      const fileKey = `uploads/${fileType}s/${Date.now()}-${uuidv4()}${fileExtension}`;
      const s3Params = {
        Bucket: process.env.S3_BUCKET || 'yesterday-stories-uploads',
        Key: fileKey,
        Body: fileBuffer,
        ContentType: mimeType,
      };

      const result = await s3.upload(s3Params).promise();
      console.log(`[FILES] ✅ Uploaded to S3: ${result.Location}`);

      return {
        success: true,
        url: result.Location,
        s3Key: result.Key,
        size: fileBuffer.length,
        fileType,
        mimeType,
      };
    } catch (error) {
      console.error('❌ Error in uploadFile:', error);
      throw error;
    }
  },
};

module.exports = filesService;

