/**
 * Lambda Handler: Draft Trails Management
 * POST /draft-trails - Save new draft
 * GET /draft-trails/{referenceCode} - Get draft
 * PUT /draft-trails/{referenceCode}/update - Update draft data
 * PUT /draft-trails/{referenceCode}/paid - Mark as paid
 * PUT /draft-trails/{referenceCode}/status - Update status
 * DELETE /draft-trails/{referenceCode} - Delete draft
 * GET /draft-trails/my-drafts - Get user drafts (auth required)
 * GET /trails - Get published trails
 */

const draftTrailsService = require('../services/draftTrailsService');
const { httpResponse, parseBody, getPathParam, getQueryParam } = require('../utils/http');
const { verifyAuthToken } = require('../middleware/auth');

/**
 * POST /draft-trails
 * Save a new draft trail
 */
const saveDraftTrail = async (event) => {
  try {
    const body = parseBody(event);
    const { referenceCode, userId, userEmail, trailData } = body;

    // Validate required fields
    if (!referenceCode || !userId || !userEmail || !trailData) {
      return httpResponse.error(
        'Missing required fields: referenceCode, userId, userEmail, trailData'
      );
    }

    try {
      const result = await draftTrailsService.saveDraftTrail(
        referenceCode,
        userId,
        userEmail,
        trailData
      );

      return httpResponse.success(
        {
          success: true,
          message: 'Draft trail created successfully',
          referenceCode: result.referenceCode,
          createdAt: new Date().toISOString(),
          expiresAt: result.expiresAt,
        },
        201
      );
    } catch (error) {
      // Check if it's a duplicate key error
      if (error.code === 'ER_DUP_ENTRY') {
        return httpResponse.error(
          'Duplicate reference code. Please use a unique reference code.',
          409
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Error saving draft trail:', error);
    return httpResponse.serverError('Failed to save draft trail');
  }
};
  }
};

/**
 * GET /draft-trails/{referenceCode}
 * Get a draft trail by reference code
 */
const getDraftTrail = async (event) => {
  try {
    const path = event.path || event.rawPath;
    // Extract reference code from path like /draft-trails/TRAIL-ABC
    const match = path.match(/\/draft-trails\/([^/?]+)/);
    const referenceCode = match ? match[1] : null;

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode in path');
    }

    const draft = await draftTrailsService.getDraftTrail(referenceCode);

    if (!draft) {
      return httpResponse.notFound('Draft trail not found');
    }

    // Check if expired
    if (new Date(draft.expiresAt) < new Date()) {
      return httpResponse.error('Draft trail has expired', 410);
    }

    return httpResponse.success({
      success: true,
      referenceCode: draft.referenceCode,
      userId: draft.userId,
      userEmail: draft.email,
      trailData: draft.trailData,
      isPaid: draft.isPaid,
      createdAt: draft.createdAt,
      expiresAt: draft.expiresAt,
      expired: false,
    });
  } catch (error) {
    console.error('❌ Error getting draft trail:', error);
    return httpResponse.serverError('Failed to get draft trail');
  }
};

/**
 * GET /draft-trails/my-drafts
 * Get all drafts for authenticated user (REQUIRES AUTH)
 */
const getUserDraftTrails = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    if (!authResult.authenticated) {
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const userId = authResult.userId;

    const drafts = await draftTrailsService.getUserDraftTrails(userId);

    return httpResponse.success({
      success: true,
      drafts: drafts,
    });
  } catch (error) {
    console.error('❌ Error getting user drafts:', error);
    return httpResponse.serverError('Failed to get drafts');
  }
};

/**
 * PUT /draft-trails/{referenceCode}/update
 * Update draft trail data (REQUIRES AUTH)
 */
const updateDraftTrailData = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    if (!authResult.authenticated) {
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    // Extract reference code from path like /draft-trails/TRAIL-ABC/update
    const match = path.match(/\/draft-trails\/([^/]+)\//);
    const referenceCode = match ? match[1] : null;

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode in path');
    }

    const body = parseBody(event);
    const userId = authResult.userId;

    // Verify draft exists and user owns it
    const draft = await draftTrailsService.getDraftTrail(referenceCode);
    if (!draft) {
      return httpResponse.notFound('Draft trail not found');
    }

    if (draft.userId !== userId) {
      return httpResponse.error('You do not have permission to modify this draft', 403);
    }

    // Check if draft is expired
    if (new Date(draft.expiresAt) < new Date()) {
      return httpResponse.error('Draft trail has expired', 410);
    }

    // Check if draft is already paid (cannot update paid drafts)
    if (draft.isPaid) {
      return httpResponse.error('Cannot update a draft that has already been paid', 400);
    }

    // Update the draft data
    const updateData = {
      trailData: body.trailData,
    };

    const success = await draftTrailsService.updateDraftTrail(referenceCode, updateData);

    if (!success) {
      return httpResponse.serverError('Failed to update draft trail');
    }

    const updatedDraft = await draftTrailsService.getDraftTrail(referenceCode);

    return httpResponse.success({
      success: true,
      message: 'Draft trail updated successfully',
      referenceCode: referenceCode,
      updatedAt: updatedDraft.updatedAt,
    });
  } catch (error) {
    console.error('❌ Error updating draft trail:', error);
    return httpResponse.serverError('Failed to update draft trail');
  }
};

/**
 * DELETE /draft-trails/{referenceCode}
 * Delete a draft trail (REQUIRES AUTH)
 */
const deleteDraftTrail = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    if (!authResult.authenticated) {
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    // Extract reference code from path
    const match = path.match(/\/draft-trails\/([^/?]+)/);
    const referenceCode = match ? match[1] : null;

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode in path');
    }

    const userId = authResult.userId;

    // Verify draft exists and user owns it
    const draft = await draftTrailsService.getDraftTrail(referenceCode);
    if (!draft) {
      return httpResponse.notFound('Draft trail not found');
    }

    if (draft.userId !== userId) {
      return httpResponse.error('You do not have permission to delete this draft', 403);
    }

    // Can only delete unpaid drafts
    if (draft.isPaid) {
      return httpResponse.error('Cannot delete a draft that has already been paid', 400);
    }

    const success = await draftTrailsService.deleteDraftTrail(referenceCode);

    if (!success) {
      return httpResponse.notFound('Draft trail not found');
    }

    return httpResponse.success({
      success: true,
      message: 'Draft trail deleted successfully',
      referenceCode: referenceCode,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error deleting draft trail:', error);
    return httpResponse.serverError('Failed to delete draft trail');
  }
};


/**
 * PUT /draft-trails/{referenceCode}/paid
 * Mark draft as paid (REQUIRES AUTH)
 */
const markDraftAsPaid = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    if (!authResult.authenticated) {
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    const match = path.match(/\/draft-trails\/([^/]+)\//);
    const referenceCode = match ? match[1] : null;

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode in path');
    }

    const userId = authResult.userId;
    const body = parseBody(event);

    // Verify draft exists and user owns it
    const draft = await draftTrailsService.getDraftTrail(referenceCode);
    if (!draft) {
      return httpResponse.notFound('Draft trail not found');
    }

    if (draft.userId !== userId) {
      return httpResponse.error('You do not have permission to modify this draft', 403);
    }

    // Check if already paid
    if (draft.isPaid) {
      return httpResponse.error('Draft has already been paid', 400);
    }

    // Mark as paid
    const success = await draftTrailsService.markDraftAsPaid(referenceCode);

    if (!success) {
      return httpResponse.serverError('Failed to mark draft as paid');
    }

    const updatedDraft = await draftTrailsService.getDraftTrail(referenceCode);

    return httpResponse.success({
      success: true,
      message: 'Trail marked as paid and published',
      referenceCode: referenceCode,
      isPaid: true,
      publishedAt: new Date().toISOString(),
      trailId: draft.id,
    });
  } catch (error) {
    console.error('❌ Error marking draft as paid:', error);
    return httpResponse.serverError('Failed to mark draft as paid');
  }
};

/**
 * PUT /draft-trails/{referenceCode}/status
 * Update draft status (REQUIRES AUTH)
 */
const updateDraftStatus = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    if (!authResult.authenticated) {
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    const match = path.match(/\/draft-trails\/([^/]+)\//);
    const referenceCode = match ? match[1] : null;

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode in path');
    }

    const userId = authResult.userId;
    const body = parseBody(event);

    if (!body.status) {
      return httpResponse.error('Missing status in request body');
    }

    // Verify draft exists and user owns it
    const draft = await draftTrailsService.getDraftTrail(referenceCode);
    if (!draft) {
      return httpResponse.notFound('Draft trail not found');
    }

    if (draft.userId !== userId) {
      return httpResponse.error('You do not have permission to modify this draft', 403);
    }

    // Valid statuses
    const validStatuses = ['draft', 'payment_pending', 'payment_completed', 'payment_failed', 'expired'];
    if (!validStatuses.includes(body.status)) {
      return httpResponse.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Update status
    const success = await draftTrailsService.updateDraftTrail(referenceCode, { status: body.status });

    if (!success) {
      return httpResponse.serverError('Failed to update draft status');
    }

    return httpResponse.success({
      success: true,
      message: 'Trail status updated',
      referenceCode: referenceCode,
      status: body.status,
    });
  } catch (error) {
    console.error('❌ Error updating draft status:', error);
    return httpResponse.serverError('Failed to update draft status');
  }
};

/**
 * GET /trails
 * Get all published trails (public endpoint)
 */
const getPublishedTrails = async (event) => {
  try {
    const sortBy = getQueryParam(event, 'sort') || 'distance'; // distance, newest, difficulty
    const difficulty = getQueryParam(event, 'difficulty'); // Easy, Medium, Hard
    const limit = parseInt(getQueryParam(event, 'limit') || '50');
    const offset = parseInt(getQueryParam(event, 'offset') || '0');

    const trails = await draftTrailsService.getPublishedTrails({
      sortBy,
      difficulty,
      limit,
      offset,
    });

    return httpResponse.success({
      success: true,
      trails: trails,
    });
  } catch (error) {
    console.error('❌ Error getting published trails:', error);
    return httpResponse.serverError('Failed to get published trails');
  }
};

module.exports = {
  saveDraftTrail,
  getDraftTrail,
  getUserDraftTrails,
  updateDraftTrailData,
  markDraftAsPaid,
  updateDraftStatus,
  deleteDraftTrail,
  getPublishedTrails,
};
