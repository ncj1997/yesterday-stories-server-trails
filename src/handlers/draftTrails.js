/**
 * Lambda Handler: Draft Trails Management
 * POST /draft-trails - Save new draft
 * GET /draft-trails/{referenceCode} - Get draft
 * PUT /draft-trails/{referenceCode} - Update draft
 * DELETE /draft-trails/{referenceCode} - Delete draft
 */

const draftTrailsService = require('../services/draftTrailsService');
const { httpResponse, parseBody, getPathParam } = require('../utils/http');

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

    const result = await draftTrailsService.saveDraftTrail(
      referenceCode,
      userId,
      userEmail,
      trailData
    );

    return httpResponse.success(
      {
        success: true,
        message: 'Draft trail saved successfully',
        data: result,
      },
      201
    );
  } catch (error) {
    console.error('❌ Error saving draft trail:', error);
    return httpResponse.serverError('Failed to save draft trail');
  }
};

/**
 * GET /draft-trails/{referenceCode}
 * Get a draft trail by reference code
 */
const getDraftTrail = async (event) => {
  try {
    const referenceCode = getPathParam(event, 'referenceCode');

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode parameter');
    }

    const draft = await draftTrailsService.getDraftTrail(referenceCode);

    if (!draft) {
      return httpResponse.notFound('Draft trail not found');
    }

    return httpResponse.success({
      success: true,
      data: draft,
    });
  } catch (error) {
    console.error('❌ Error getting draft trail:', error);
    return httpResponse.serverError('Failed to get draft trail');
  }
};

/**
 * GET /draft-trails/user/{userId}
 * Get all drafts for a user
 */
const getUserDraftTrails = async (event) => {
  try {
    const userId = getPathParam(event, 'userId');

    if (!userId) {
      return httpResponse.error('Missing userId parameter');
    }

    const drafts = await draftTrailsService.getUserDraftTrails(userId);

    return httpResponse.success({
      success: true,
      count: drafts.length,
      data: drafts,
    });
  } catch (error) {
    console.error('❌ Error getting user drafts:', error);
    return httpResponse.serverError('Failed to get drafts');
  }
};

/**
 * PUT /draft-trails/{referenceCode}
 * Update a draft trail
 */
const updateDraftTrail = async (event) => {
  try {
    const referenceCode = getPathParam(event, 'referenceCode');
    const body = parseBody(event);

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode parameter');
    }

    // Verify draft exists
    const draft = await draftTrailsService.getDraftTrail(referenceCode);
    if (!draft) {
      return httpResponse.notFound('Draft trail not found');
    }

    const success = await draftTrailsService.updateDraftTrail(
      referenceCode,
      body
    );

    if (!success) {
      return httpResponse.error('Failed to update draft trail');
    }

    const updatedDraft = await draftTrailsService.getDraftTrail(referenceCode);

    return httpResponse.success({
      success: true,
      message: 'Draft trail updated successfully',
      data: updatedDraft,
    });
  } catch (error) {
    console.error('❌ Error updating draft trail:', error);
    return httpResponse.serverError('Failed to update draft trail');
  }
};

/**
 * DELETE /draft-trails/{referenceCode}
 * Delete a draft trail
 */
const deleteDraftTrail = async (event) => {
  try {
    const referenceCode = getPathParam(event, 'referenceCode');

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode parameter');
    }

    const success = await draftTrailsService.deleteDraftTrail(referenceCode);

    if (!success) {
      return httpResponse.notFound('Draft trail not found');
    }

    return httpResponse.success({
      success: true,
      message: 'Draft trail deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting draft trail:', error);
    return httpResponse.serverError('Failed to delete draft trail');
  }
};

module.exports = {
  saveDraftTrail,
  getDraftTrail,
  getUserDraftTrails,
  updateDraftTrail,
  deleteDraftTrail,
};
