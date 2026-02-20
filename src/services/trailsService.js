/**
 * Trails Service - Sequelize Version
 * Handles all database operations for trails using Sequelize ORM
 */

const { getModels } = require('../models');
const { Op } = require('sequelize');

/**
 * Helper: Determine if payment is required based on number of custom stories
 * Rule: <= 5 stories = free, > 5 stories = payment required
 */
const isPaymentRequired = (customStories) => {
  const storyCount = customStories ? customStories.length : 0;
  return storyCount > 5;
};

const trailsService = {
  /**
   * Save a new trail (starts with draft status)
   * Uses Firebase userId directly (no user creation logic)
   */
  async saveTrail(referenceCode, userId, email, trailData) {
    try {
      const { Trail, CustomStory } = getModels();

      // Calculate expiration (7 days from now)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Determine if payment is required (more than 5 stories)
      const paymentRequired = isPaymentRequired(trailData.customStories);
      const initialStatus = paymentRequired ? 'payment_pending' : 'draft';

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
        expiresAt,
      });

      // Create custom stories if provided
      if (trailData.customStories && trailData.customStories.length > 0) {
        const stories = trailData.customStories.map((story, index) => ({
          referenceCode,
          title: story.title || '',
          description: story.description || '',
          latitude: story.latitude || null,
          longitude: story.longitude || null,
          imageUrl: story.imageUrl || (story.imageUrls && story.imageUrls[0]) || null,
          videoUrl: story.videoUrl || (story.videoUrls && story.videoUrls[0]) || null,
          orderIndex: index,
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
        expiresAt: draft.expiresAt.toISOString(),
        daysRemaining: 7,
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
            attributes: ['id', 'title', 'description', 'latitude', 'longitude', 'imageUrl', 'videoUrl', 'orderIndex'],
            order: [['orderIndex', 'ASC']],
          },
        ],
      });

      if (!draft) {
        return null;
      }

      const daysRemaining = Math.max(
        0,
        Math.ceil((new Date(draft.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
      );

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
        createdAt: draft.createdAt,
        expiresAt: draft.expiresAt,
        daysRemaining,
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
            attributes: ['id', 'title', 'description', 'latitude', 'longitude', 'imageUrl', 'videoUrl', 'orderIndex'],
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
        createdAt: trail.createdAt,
        expiresAt: trail.expiresAt,
        daysRemaining: Math.max(
          0,
          Math.ceil((new Date(trail.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
        ),
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

      const draft = await Trail.findOne({
        where: { referenceCode, isDeleted: false },
      });

      if (!draft) {
        return false;
      }

      // Update trail data fields
      if (updates.trailData) {
        const { trailData } = updates;
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
              latitude: story.latitude || null,
              longitude: story.longitude || null,
              imageUrl: story.imageUrl || (story.imageUrls && story.imageUrls[0]) || null,
              videoUrl: story.videoUrl || (story.videoUrls && story.videoUrls[0]) || null,
              orderIndex: index,
            }));

            await CustomStory.bulkCreate(stories);
          }

          // Update status based on new story count if not yet paid
          if (!draft.isPaid) {
            const paymentRequired = isPaymentRequired(trailData.customStories);
            draft.status = paymentRequired ? 'payment_pending' : 'draft';
            console.log(`[DB] Updated status to '${draft.status}' based on ${trailData.customStories.length} stories`);
          }
        }
      }

      // Update status if provided
      if (updates.status !== undefined) {
        draft.status = updates.status;
      }

      // Update isPaid if provided
      if (updates.isPaid !== undefined) {
        draft.isPaid = updates.isPaid;
      }

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
   * Get published trails (isPaid = TRUE) with proper sorting
   */
  async getPublishedTrails(options = {}) {
    try {
      const { Trail, User, CustomStory } = getModels();
      const { sortBy = 'distance', difficulty, limit = 50, offset = 0 } = options;

      const whereClause = {
        isPaid: true,
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
            model: User,
            as: 'user',
            attributes: ['userId'],
          },
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
        userId: trail.user.userId,
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
      const { Trail } = getModels();

      const result = await Trail.update(
        { status: 'expired' },
        {
          where: {
            expiresAt: { [Op.lt]: new Date() },
            status: { [Op.ne]: 'expired' },
          },
        }
      );

      return result[0];
    } catch (error) {
      console.error('❌ Error in cleanupExpiredDrafts:', error);
      throw error;
    }
  },
};

module.exports = trailsService;
