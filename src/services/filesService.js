/**
 * Files Service (Images & Videos)
 * Handles file uploads to S3 and metadata storage
 */

const AWS = require('aws-sdk');
const { query } = require('../db/mysql');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
});

const filesService = {
  /**
   * Upload file to S3 and store metadata
   */
  async uploadFile(fileBuffer, fileType, mimeType, referenceCode, userId) {
    try {
      const fileKey = `uploads/${fileType}s/${Date.now()}-${uuidv4()}`;
      const s3Params = {
        Bucket: process.env.S3_BUCKET || 'yesterday-stories-uploads',
        Key: fileKey,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'public-read', // Make it publicly readable
      };

      // Upload to S3
      const result = await s3.upload(s3Params).promise();

      // Store metadata in database
      const metadata = {
        originalSize: fileBuffer.length,
        uploadTime: new Date().toISOString(),
      };

      // Get user database ID
      const userResults = await query(
        'SELECT id FROM users WHERE userId = ?',
        [userId]
      );

      if (userResults.length === 0) {
        throw new Error('User not found');
      }

      const dbUserId = userResults[0].id;

      await query(
        `INSERT INTO files 
         (referenceCode, userId, fileType, s3Key, s3Url, mimeType, fileSize, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          referenceCode,
          dbUserId,
          fileType,
          fileKey,
          result.Location,
          mimeType,
          fileBuffer.length,
          JSON.stringify(metadata),
        ]
      );

      return {
        success: true,
        url: result.Location,
        s3Key: fileKey,
        size: fileBuffer.length,
        fileType,
      };
    } catch (error) {
      console.error('❌ Error in uploadFile:', error);
      throw error;
    }
  },

  /**
   * Get files for a draft
   */
  async getFilesByReference(referenceCode) {
    try {
      const results = await query(
        `SELECT * FROM files
         WHERE referenceCode = ?
         ORDER BY createdAt DESC`,
        [referenceCode]
      );

      return results.map(file => ({
        id: file.id,
        fileType: file.fileType,
        s3Url: file.s3Url,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        createdAt: file.createdAt,
        metadata: JSON.parse(file.metadata || '{}'),
      }));
    } catch (error) {
      console.error('❌ Error in getFilesByReference:', error);
      throw error;
    }
  },

  /**
   * Delete file from S3 and database
   */
  async deleteFile(s3Key) {
    try {
      // Delete from S3
      await s3
        .deleteObject({
          Bucket: process.env.S3_BUCKET || 'yesterday-stories-uploads',
          Key: s3Key,
        })
        .promise();

      // Delete from database
      await query('DELETE FROM files WHERE s3Key = ?', [s3Key]);

      return true;
    } catch (error) {
      console.error('❌ Error in deleteFile:', error);
      throw error;
    }
  },

  /**
   * Generate presigned URL for private files
   */
  async generatePresignedUrl(s3Key, expiresIn = 3600) {
    try {
      const url = s3.getSignedUrl('getObject', {
        Bucket: process.env.S3_BUCKET || 'yesterday-stories-uploads',
        Key: s3Key,
        Expires: expiresIn,
      });

      return url;
    } catch (error) {
      console.error('❌ Error in generatePresignedUrl:', error);
      throw error;
    }
  },
};

module.exports = filesService;
