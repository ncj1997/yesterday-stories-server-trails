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

// Allowed MIME types for presigned URL validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

const filesService = {
  /**
   * Generate a presigned PUT URL for direct S3 upload
   * @param {string} userId - User ID for path namespacing
   * @param {string} fileName - Original file name
   * @param {string} contentType - MIME type of the file
   * @param {'image'|'video'} fileType - Type of file (image or video)
   * @returns {Promise<string>} Presigned URL valid for 30 minutes
   */
  async getPresignedUploadUrl(userId, fileName, contentType, fileType) {
    const folder = fileType === 'video' ? 'videos' : 'images';
    const key = `${folder}/uploads/${userId}/${fileName}`;

    const params = {
      Bucket: process.env.S3_BUCKET || 'yesterday-stories-uploads',
      Key: key,
      ContentType: contentType,
      Expires: 1800, // 30 minutes
    };

    const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
    console.log(`[FILES] ✅ Generated presigned URL for ${key}`);
    return presignedUrl;
  },

  /**
   * Generate a generic presigned POST URL for a user session
   * Allows multiple uploads with any filename for 2 hours
   * @param {string} userId - User ID for path namespacing
   * @param {'image'|'video'} fileType - Type of file (image or video)
   * @returns {Promise<Object>} Presigned POST data (url, fields)
   */
  async getSessionUploadCredentials(userId, fileType) {
    const folder = fileType === 'video' ? 'videos' : 'images';
    const allowedTypes = fileType === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    const maxSize = fileType === 'video' ? 500 * 1024 * 1024 : 10 * 1024 * 1024;

    const params = {
      Bucket: process.env.S3_BUCKET || 'yesterday-stories-uploads',
      Fields: {
        key: `${folder}/uploads/${userId}/\${filename}`, // Dynamic filename placeholder
      },
      Expires: 7200, // 2 hours
      Conditions: [
        ['starts-with', '$key', `${folder}/uploads/${userId}/`],
        ['content-length-range', 0, maxSize],
        ['starts-with', '$Content-Type', fileType === 'video' ? 'video/' : 'image/'],
      ],
    };

    const presignedPost = await s3.createPresignedPost(params);
    console.log(`[FILES] ✅ Generated session upload credentials for ${userId} (${fileType})`);
    
    return {
      url: presignedPost.url,
      fields: presignedPost.fields,
      expiresIn: 7200,
      allowedTypes,
      maxSize,
    };
  },

  /**
   * Generate batch presigned URLs for multiple files
   * @param {string} userId - User ID for path namespacing
   * @param {Array} files - Array of {fileName, contentType, fileType}
   * @returns {Promise<Array>} Array of presigned URLs
   */
  async getBatchPresignedUrls(userId, files) {
    const results = [];
    
    for (const file of files) {
      try {
        const { fileName, contentType, fileType } = file;
        const presignedUrl = await this.getPresignedUploadUrl(userId, fileName, contentType, fileType);
        
        results.push({
          fileName,
          contentType,
          presignedUrl,
          success: true,
        });
      } catch (error) {
        console.error(`❌ Error generating presigned URL for ${file.fileName}:`, error);
        results.push({
          fileName: file.fileName,
          success: false,
          error: error.message,
        });
      }
    }
    
    return results;
  },

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
module.exports.ALLOWED_IMAGE_TYPES = ALLOWED_IMAGE_TYPES;
module.exports.ALLOWED_VIDEO_TYPES = ALLOWED_VIDEO_TYPES;

