/**
 * Trails Service - Sequelize Version
 * Handles all database operations for trails using Sequelize ORM
 */

const { getModels } = require('../models');
const { Op } = require('sequelize');

/**
 * Helper: Determine if payment is required
 * Rule: All trails require payment (no free trails)
 */
const isPaymentRequired = (customStories) => {
  return true;
};

/**
 * Helper: Generate a reference code
 * Format: YS-YYYYMMDD-XXXX (e.g., YS-20260223-AB12)
 */
const generateReferenceCode = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  // Generate random 4-character code (2 letters + 2 numbers)
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const randomCode = 
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)] +
    numbers[Math.floor(Math.random() * numbers.length)] +
    numbers[Math.floor(Math.random() * numbers.length)];
  
  return `YS-${dateStr}-${randomCode}`;
};

/**
 * Helper: Check if a reference code already exists
 */
const referenceCodeExists = async (referenceCode) => {
  const { Trail } = getModels();
  const existingTrail = await Trail.findOne({
    where: { referenceCode }
  });
  return !!existingTrail;
};

/**
 * Helper: Generate a unique reference code
 * Retries up to 10 times if duplicates are found
 */
const generateUniqueReferenceCode = async (maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateReferenceCode();
    const exists = await referenceCodeExists(code);
    if (!exists) {
      return code;
    }
    console.log(`[DB] Reference code ${code} already exists, generating new one (attempt ${i + 1}/${maxAttempts})`);
  }
  throw new Error('Failed to generate unique reference code after multiple attempts');
};

const trailsService = {
  /**
   * Save a new trail (starts with draft status)
   * Uses Firebase userId directly (no user creation logic)
   */
  async saveTrail(referenceCode, userId, email, trailData, isPublished = false) {
    try {
      const { Trail, CustomStory } = getModels();

      // All trails require payment now
      const paymentRequired = isPaymentRequired(trailData.customStories);
      let initialStatus = 'payment_pending';
      let publishedAt = null;

      // Cannot publish without payment
      if (isPublished && !paymentRequired) {
        // This branch will never execute as paymentRequired is always true
        console.log(`[DB] Cannot publish - payment required`);
      } else if (isPublished && paymentRequired) {
        console.log(`[DB] Cannot publish - payment required for trail`);
      }

      console.log(`[DB] Creating trail for Firebase user: ${userId}`);
      console.log(`[DB] Stories count: ${trailData.customStories ? trailData.customStories.length : 0}, Payment required: ${paymentRequired}`);

      // Create trail - userId is Firebase UID
      const draft = await Trail.create({
        referenceCode,
        userId,
        title: trailData.title || '',
        description: trailData.description || '',
        difficulty: trailData.difficulty || 'Easy',
        distance: parseFloat(trailData.distance) || 0,
        headerImages: trailData.headerImages || [],
        headerVideos: trailData.headerVideos || [],
        status: initialStatus,
        publishedAt,
      });

      // Create custom stories if provided
      if (trailData.customStories && trailData.customStories.length > 0) {
        const stories = trailData.customStories.map((story, index) => ({
          referenceCode,
          title: story.title || '',
          description: story.description || '',
          categoryId: story.categoryId || null,
          latitude: story.latitude || null,
          longitude: story.longitude || null,
          imageUrl: story.imageUrl || (story.imageUrls && story.imageUrls[0]) || null,
          videoUrl: story.videoUrl || (story.videoUrls && story.videoUrls[0]) || null,
          orderIndex: index,
          isPublished: story.isPublished || false,
        }));

        await CustomStory.bulkCreate(stories);
      }

      console.log(`[DB] ✅ Trail created: ${referenceCode}`);

      return {
        id: draft.id,
        referenceCode: draft.referenceCode,
        userId: userId,
        email: email,
        paymentRequired: paymentRequired,
        initialStatus: initialStatus,
      };
    } catch (error) {
      console.error('❌ Error in saveTrail:', error);
      throw error;
    }
  },

  /**
   * Get trail by reference code with custom stories
   */
  async getTrail(referenceCode) {
    try {
      const { Trail, CustomStory } = getModels();

      const draft = await Trail.findOne({
        where: {
          referenceCode,
          isDeleted: false,
        },
        include: [
          {
            model: CustomStory,
            as: 'customStories',
            attributes: ['id', 'title', 'description', 'categoryId', 'latitude', 'longitude', 'imageUrl', 'videoUrl', 'orderIndex', 'isPublished'],
            order: [['orderIndex', 'ASC']],
          },
        ],
      });

      if (!draft) {
        return null;
      }

      const paymentRequired = isPaymentRequired(draft.customStories);

      return {
        id: draft.id,
        referenceCode: draft.referenceCode,
        userId: draft.userId,
        trailData: {
          title: draft.title,
          description: draft.description,
          difficulty: draft.difficulty,
          distance: draft.distance.toString(),
          headerImages: draft.headerImages,
          headerVideos: draft.headerVideos,
          customStories: draft.customStories,
        },
        status: draft.status,
        isPaid: draft.isPaid,
        paymentRequired: paymentRequired,
        publishedAt: draft.publishedAt,
        createdAt: draft.createdAt,
      };
    } catch (error) {
      console.error('❌ Error in getTrail:', error);
      throw error;
    }
  },

  /**
   * Get all trails for a user (all statuses)
   */
  async getUserTrails(userId) {
    try {
      const { Trail, CustomStory } = getModels();

      const trails = await Trail.findAll({
        where: {
          userId: userId,
          isDeleted: false,
        },
        include: [
          {
            model: CustomStory,
            as: 'customStories',
            attributes: ['id', 'title', 'description', 'categoryId', 'latitude', 'longitude', 'imageUrl', 'videoUrl', 'orderIndex', 'isPublished'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      return trails.map(trail => ({
        id: trail.id,
        referenceCode: trail.referenceCode,
        trailData: {
          title: trail.title,
          description: trail.description,
          difficulty: trail.difficulty,
          distance: trail.distance.toString(),
          headerImages: trail.headerImages,
          headerVideos: trail.headerVideos,
          customStories: trail.customStories,
        },
        status: trail.status,
        isPaid: trail.isPaid,
        paymentRequired: isPaymentRequired(trail.customStories),
        publishedAt: trail.publishedAt,
        createdAt: trail.createdAt,
      }));
    } catch (error) {
      console.error('❌ Error in getUserTrails:', error);
      throw error;
    }
  },

  /**
   * Update trail data
   */
  async updateTrail(referenceCode, updates) {
    try {
      const { Trail, CustomStory } = getModels();

      console.log(`[DB] updateTrail called with updates:`, { 
        hasTrailData: !!updates.trailData, 
        isPublished: updates.isPublished,
        isPaid: updates.isPaid, // This should be undefined
        status: updates.status
      });

      const draft = await Trail.findOne({
        where: { referenceCode, isDeleted: false },
        include: [{
          model: CustomStory,
          as: 'customStories',
        }],
      });

      if (!draft) {
        return false;
      }

      console.log(`[DB] Current trail state - status: ${draft.status}, isPaid: ${draft.isPaid}, stories: ${draft.customStories?.length || 0}`);

      // Update trail data fields
      if (updates.trailData) {
        const { trailData } = updates;
        
        // Safeguard: Never allow isPaid to be set from trailData
        if (trailData.isPaid !== undefined) {
          console.log(`[DB] ⚠️  WARNING: Ignoring isPaid in trailData - this should only be set via payment webhook`);
          delete trailData.isPaid;
        }
        
        if (trailData.title !== undefined) draft.title = trailData.title;
        if (trailData.description !== undefined) draft.description = trailData.description;
        if (trailData.difficulty !== undefined) draft.difficulty = trailData.difficulty;
        if (trailData.distance !== undefined) draft.distance = parseFloat(trailData.distance);
        if (trailData.headerImages !== undefined) draft.headerImages = trailData.headerImages;
        if (trailData.headerVideos !== undefined) draft.headerVideos = trailData.headerVideos;

        // Update custom stories if provided
        if (trailData.customStories !== undefined) {
          // Delete existing stories
          await CustomStory.destroy({ where: { referenceCode } });

          // Create new stories
          if (trailData.customStories.length > 0) {
            const stories = trailData.customStories.map((story, index) => ({
              referenceCode,
              title: story.title || '',
              description: story.description || '',
              categoryId: story.categoryId || null,
              latitude: story.latitude || null,
              longitude: story.longitude || null,
              imageUrl: story.imageUrl || (story.imageUrls && story.imageUrls[0]) || null,
              videoUrl: story.videoUrl || (story.videoUrls && story.videoUrls[0]) || null,
              orderIndex: index,
              isPublished: story.isPublished || false,
            }));

            await CustomStory.bulkCreate(stories);
          }

          // Update status based on payment status
          if (!draft.isPaid) {
            // All trails require payment
            draft.status = 'payment_pending';
            draft.publishedAt = null;
            console.log(`[DB] Updated status to 'payment_pending' - all trails require payment`);
          }
        }
      }

      // Handle publish request
      if (updates.isPublished !== undefined) {
        if (updates.isPublished && !draft.isPaid) {
          console.log(`[DB] Cannot publish - payment required`);
          throw new Error('PAYMENT_REQUIRED');
        } else if (updates.isPublished && draft.isPaid) {
          // Publish paid trail
          draft.publishedAt = new Date();
          console.log(`[DB] Published paid trail`);
        } else if (!updates.isPublished && draft.isPaid && draft.publishedAt) {
          // Unpublish paid trail (reset publishedAt)
          draft.publishedAt = null;
          console.log(`[DB] Unpublished paid trail`);
        }
      }

      // Update status if provided
      if (updates.status !== undefined) {
        draft.status = updates.status;
      }

      // Update isPaid if provided
      if (updates.isPaid !== undefined) {
        console.log(`[DB] ⚠️  WARNING: Updating isPaid from ${draft.isPaid} to ${updates.isPaid} - this should only happen from payment webhook!`);
        draft.isPaid = updates.isPaid;
      }

      console.log(`[DB] About to save trail - status: ${draft.status}, isPaid: ${draft.isPaid}, publishedAt: ${draft.publishedAt}`);
      
      await draft.save();
      return true;
    } catch (error) {
      console.error('❌ Error in updateTrail:', error);
      throw error;
    }
  },

  /**
   * Delete trail (soft delete)
   */
  async deleteTrail(referenceCode) {
    try {
      const { Trail } = getModels();

      const result = await Trail.update(
        { isDeleted: true },
        { where: { referenceCode } }
      );

      return result[0] > 0;
    } catch (error) {
      console.error('❌ Error in deleteTrail:', error);
      throw error;
    }
  },

  /**
   * Mark trail as paid and published
   */
  async markTrailAsPaid(referenceCode) {
    try {
      console.log(`[DB] Marking trail as paid: ${referenceCode}`);
      const { Trail } = getModels();

      const result = await Trail.update(
        {
          isPaid: true,
          status: 'payment_completed',
          publishedAt: new Date(),
        },
        { where: { referenceCode } }
      );

      if (result[0] > 0) {
        console.log(`[DB] ✅ Draft marked as paid`);
      } else {
        console.warn(`[DB] ⚠️  No rows affected - draft not found`);
      }

      return result[0] > 0;
    } catch (error) {
      console.error('❌ Error in markTrailAsPaid:', error);
      throw error;
    }
  },

  /**
   * Get published trails
   * Returns trails where isPaid=true AND publishedAt is not null
   */
  async getPublishedTrails(options = {}) {
    try {
      const { Trail, CustomStory } = getModels();
      const { sortBy = 'distance', difficulty, limit = 50, offset = 0 } = options;

      const whereClause = {
        isPaid: true,
        publishedAt: { [Op.ne]: null },
        isDeleted: false,
      };

      // Filter by difficulty if provided
      if (difficulty) {
        whereClause.difficulty = difficulty;
      }

      // Determine sort order
      let order = [['distance', 'ASC']]; // Default
      if (sortBy === 'newest') {
        order = [['publishedAt', 'DESC']];
      } else if (sortBy === 'difficulty') {
        order = [['difficulty', 'ASC']];
      }

      const trails = await Trail.findAll({
        where: whereClause,
        include: [
          {
            model: CustomStory,
            as: 'customStories',
            attributes: ['id', 'title', 'description', 'latitude', 'longitude', 'imageUrl', 'videoUrl', 'orderIndex'],
          },
        ],
        order,
        limit,
        offset,
      });

      return trails.map(trail => ({
        id: trail.id,
        title: trail.title,
        description: trail.description,
        difficulty: trail.difficulty,
        distance: parseFloat(trail.distance),
        headerImages: trail.headerImages,
        headerVideos: trail.headerVideos,
        stories: trail.customStories.map(story => ({
          id: story.id,
          title: story.title,
          description: story.description,
          latitude: parseFloat(story.latitude) || null,
          longitude: parseFloat(story.longitude) || null,
          imageUrl: story.imageUrl,
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
   * Clean up expired drafts (stub - no longer used with payment-based system)
   * Kept for backward compatibility with cleanup handler
   */
  async cleanupExpiredDrafts() {
    try {
      console.log('[DB] Cleanup called - no action needed (payment-based system)');
      return 0;
    } catch (error) {
      console.error('❌ Error in cleanupExpiredDrafts:', error);
      throw error;
    }
  },

};

module.exports = trailsService;
