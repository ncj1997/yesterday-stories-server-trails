/**
 * Draft Trails Database Service
 * Handles all database operations for draft trails
 */

const { query } = require('../db/mysql');

const draftTrailsService = {
  /**
   * Get or create user, returns user id
   */
  async getOrCreateUser(userId, email) {
    try {
      console.log(`[DB] Getting or creating user: ${userId}`);
      // Check if user exists
      const users = await query(
        'SELECT id FROM users WHERE userId = ?',
        [userId]
      );

      if (users.length > 0) {
        console.log(`[DB] ✅ User exists with ID: ${users[0].id}`);
        return users[0].id;
      }

      // Create new user
      console.log(`[DB] Creating new user: ${userId}`);
      const result = await query(
        'INSERT INTO users (userId, email) VALUES (?, ?)',
        [userId, email]
      );

      console.log(`[DB] ✅ User created with ID: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      console.error('❌ Error in getOrCreateUser:', error);
      throw error;
    }
  },

  /**
   * Save a new draft trail
   */
  async saveDraftTrail(referenceCode, userId, email, trailData) {
    try {
      // Ensure user exists
      const dbUserId = await this.getOrCreateUser(userId, email);

      // Calculate expiration (7 days from now)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

      const result = await query(
        `INSERT INTO draft_trails 
         (referenceCode, userId, trailData, status, expiresAt) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          referenceCode,
          dbUserId,
          JSON.stringify(trailData),
          'draft',
          expiresAtStr,
        ]
      );

      return {
        id: result.insertId,
        referenceCode,
        userId,
        email,
        expiresAt: expiresAt.toISOString(),
        daysRemaining: 7,
      };
    } catch (error) {
      console.error('❌ Error in saveDraftTrail:', error);
      throw error;
    }
  },

  /**
   * Get draft trail by reference code
   */
  async getDraftTrail(referenceCode) {
    try {
      const results = await query(
        `SELECT dt.*, u.userId, u.email 
         FROM draft_trails dt
         JOIN users u ON dt.userId = u.id
         WHERE dt.referenceCode = ? AND dt.isDeleted = FALSE`,
        [referenceCode]
      );

      if (results.length === 0) {
        return null;
      }

      const draft = results[0];
      return {
        id: draft.id,
        referenceCode: draft.referenceCode,
        userId: draft.userId,
        email: draft.email,
        trailData: JSON.parse(draft.trailData),
        status: draft.status,
        isPaid: draft.isPaid,
        createdAt: draft.createdAt,
        expiresAt: draft.expiresAt,
        daysRemaining: Math.max(
          0,
          Math.ceil((new Date(draft.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
        ),
      };
    } catch (error) {
      console.error('❌ Error in getDraftTrail:', error);
      throw error;
    }
  },

  /**
   * Get all draft trails for a user
   */
  async getUserDraftTrails(userId) {
    try {
      const results = await query(
        `SELECT dt.*, u.userId as userIdStr, u.email 
         FROM draft_trails dt
         JOIN users u ON dt.userId = u.id
         WHERE u.userId = ? AND dt.isDeleted = FALSE
         ORDER BY dt.createdAt DESC`,
        [userId]
      );

      return results.map(draft => ({
        id: draft.id,
        referenceCode: draft.referenceCode,
        trailData: JSON.parse(draft.trailData),
        status: draft.status,
        isPaid: draft.isPaid,
        createdAt: draft.createdAt,
        expiresAt: draft.expiresAt,
        daysRemaining: Math.max(
          0,
          Math.ceil((new Date(draft.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
        ),
      }));
    } catch (error) {
      console.error('❌ Error in getUserDraftTrails:', error);
      throw error;
    }
  },

  /**
   * Update draft trail
   */
  async updateDraftTrail(referenceCode, updates) {
    try {
      const allowedFields = ['trailData', 'status', 'isPaid'];
      const updateFields = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = ?`);
          values.push(key === 'trailData' ? JSON.stringify(value) : value);
        }
      }

      if (updateFields.length === 0) {
        return false;
      }

      values.push(referenceCode);

      const result = await query(
        `UPDATE draft_trails 
         SET ${updateFields.join(', ')} 
         WHERE referenceCode = ? AND isDeleted = FALSE`,
        values
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error in updateDraftTrail:', error);
      throw error;
    }
  },

  /**
   * Delete draft trail (soft delete)
   */
  async deleteDraftTrail(referenceCode) {
    try {
      const result = await query(
        'UPDATE draft_trails SET isDeleted = TRUE WHERE referenceCode = ?',
        [referenceCode]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error in deleteDraftTrail:', error);
      throw error;
    }
  },

  /**
   * Mark draft as paid and published
   */
  async markDraftAsPaid(referenceCode) {
    try {
      console.log(`[DB] Marking draft as paid: ${referenceCode}`);
      const publishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const result = await query(
        `UPDATE draft_trails 
         SET isPaid = TRUE, status = 'payment_completed', publishedAt = ? 
         WHERE referenceCode = ?`,
        [publishedAt, referenceCode]
      );

      if (result.affectedRows > 0) {
        console.log(`[DB] ✅ Draft marked as paid`);
      } else {
        console.warn(`[DB] ⚠️  No rows affected - draft not found`);
      }

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error in markDraftAsPaid:', error);
      throw error;
    }
  },

  /**
   * Get published trails (isPaid = TRUE)
   */
  async getPublishedTrails(options = {}) {
    try {
      const { sortBy = 'distance', difficulty, limit = 50, offset = 0 } = options;

      let sql = `SELECT dt.*, u.userId, u.email 
                 FROM draft_trails dt
                 JOIN users u ON dt.userId = u.id
                 WHERE dt.isPaid = TRUE AND dt.isDeleted = FALSE`;

      const params = [];

      // Filter by difficulty if provided
      if (difficulty) {
        sql += ` AND JSON_EXTRACT(dt.trailData, '$.difficulty') = ?`;
        params.push(difficulty);
      }

      // Sort
      if (sortBy === 'newest') {
        sql += ` ORDER BY dt.publishedAt DESC`;
      } else if (sortBy === 'difficulty') {
        sql += ` ORDER BY JSON_EXTRACT(dt.trailData, '$.difficulty') ASC`;
      } else {
        // Default to distance
        sql += ` ORDER BY CAST(JSON_EXTRACT(dt.trailData, '$.distance') AS DECIMAL) ASC`;
      }

      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const results = await query(sql, params);

      return results.map(trail => ({
        id: trail.id,
        title: JSON.parse(trail.trailData).title,
        description: JSON.parse(trail.trailData).description,
        difficulty: JSON.parse(trail.trailData).difficulty,
        distance: parseFloat(JSON.parse(trail.trailData).distance),
        headerImages: JSON.parse(trail.trailData).headerImages || [],
        stories: (JSON.parse(trail.trailData).customStories || []).map(story => ({
          id: story.id,
          title: story.title,
          latitude: story.latitude,
          longitude: story.longitude,
          description: story.description,
          imageUrls: story.imageUrls || [],
          videoUrl: story.videoUrl,
        })),
        userId: trail.userId,
        publishedAt: trail.publishedAt,
        distanceToTrail: -1, // Would be calculated if user location provided
      }));
    } catch (error) {
      console.error('❌ Error in getPublishedTrails:', error);
      throw error;
    }
  },

  /**
   * Clean up expired drafts (run via scheduled Lambda)
   */
  async cleanupExpiredDrafts() {
    try {
      const result = await query(
        'UPDATE draft_trails SET status = ? WHERE expiresAt < NOW() AND status != ?',
        ['expired', 'expired']
      );

      return result.affectedRows;
    } catch (error) {
      console.error('❌ Error in cleanupExpiredDrafts:', error);
      throw error;
    }
  },
};

module.exports = draftTrailsService;
