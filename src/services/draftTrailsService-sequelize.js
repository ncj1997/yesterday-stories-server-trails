/**
 * Draft Trails Service - Sequelize Version
 * Handles all database operations for draft trails using Sequelize ORM
 */

const { getModels } = require('../models');
const { Op } = require('sequelize');

const draftTrailsService = {
  /**
   * Get or create user, returns database user object
   */
  async getOrCreateUser(userId, email) {
    try {
      console.log(`[DB] Getting or creating user: ${userId}`);
      const { User } = getModels();

      const [user, created] = await User.findOrCreate({
        where: { userId },
        defaults: { userId, email },
      });

      if (created) {
        console.log(`[DB] ✅ User created with ID: ${user.id}`);
      } else {
        console.log(`[DB] ✅ User exists with ID: ${user.id}`);
      }

      return user;
    } catch (error) {
      console.error('❌ Error in getOrCreateUser:', error);
      throw error;
    }
  },

  /**
   * Save a new draft trail with separate columns
   */
  async saveDraftTrail(referenceCode, userId, email, trailData) {
    try {
      const { Trail, CustomStory } = getModels();

      // Ensure user exists
      const user = await this.getOrCreateUser(userId, email);

      // Calculate expiration (7 days from now)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create draft trail with separate columns
      const draft = await Trail.create({
        referenceCode,
        userId: user.id,
        title: trailData.title || '',
        description: trailData.description || '',
        difficulty: trailData.difficulty || 'Easy',
        distance: parseFloat(trailData.distance) || 0,
        headerImages: trailData.headerImages || [],
        headerVideos: trailData.headerVideos || [],
        status: 'draft',
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
          imageUrl: story.imageUrl || null,
          videoUrl: story.videoUrl || null,
          orderIndex: index,
        }));

        await CustomStory.bulkCreate(stories);
      }

      return {
        id: draft.id,
        referenceCode: draft.referenceCode,
        userId: user.userId,
        email: user.email,
        expiresAt: draft.expiresAt.toISOString(),
        daysRemaining: 7,
      };
    } catch (error) {
      console.error('❌ Error in saveDraftTrail:', error);
      throw error;
    }
  },

  /**
   * Get draft trail by reference code with custom stories
   */
  async getDraftTrail(referenceCode) {
    try {
      const { Trail, User, CustomStory } = getModels();

      const draft = await Trail.findOne({
        where: {
          referenceCode,
          isDeleted: false,
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['userId', 'email'],
          },
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

      return {
        id: draft.id,
        referenceCode: draft.referenceCode,
        userId: draft.user.userId,
        email: draft.user.email,
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
        createdAt: draft.createdAt,
        expiresAt: draft.expiresAt,
        daysRemaining,
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
      const { Trail, User, CustomStory } = getModels();

      const user = await User.findOne({ where: { userId } });
      if (!user) {
        return [];
      }

      const drafts = await Trail.findAll({
        where: {
          userId: user.id,
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

      return drafts.map(draft => ({
        id: draft.id,
        referenceCode: draft.referenceCode,
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
   * Update draft trail with separate columns
   */
  async updateDraftTrail(referenceCode, updates) {
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
              imageUrl: story.imageUrl || null,
              videoUrl: story.videoUrl || null,
              orderIndex: index,
            }));

            await CustomStory.bulkCreate(stories);
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
      console.error('❌ Error in updateDraftTrail:', error);
      throw error;
    }
  },

  /**
   * Delete draft trail (soft delete)
   */
  async deleteDraftTrail(referenceCode) {
    try {
      const { Trail } = getModels();

      const result = await Trail.update(
        { isDeleted: true },
        { where: { referenceCode } }
      );

      return result[0] > 0;
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
      console.error('❌ Error in markDraftAsPaid:', error);
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

module.exports = draftTrailsService;
