/**
 * Lambda Handler: Trails Management
 * POST /trails - Save new trail
 * GET /trails/{referenceCode} - Get trail
 * PUT /trails/{referenceCode}/update - Update trail data
 * PUT /trails/{referenceCode}/paid - Mark as paid
 * PUT /trails/{referenceCode}/status - Update status
 * DELETE /trails/{referenceCode} - Delete trail
 * GET /trails/my - Get user trails (auth required)
 * GET /trails/published - Get published trails
 */

const trailsService = require('../services/trailsService');
const { httpResponse, parseBody, getPathParam, getQueryParam } = require('../utils/http');
const { verifyAuthToken } = require('../middleware/auth-sequelize');

/**
 * POST /trails
 * Save a new trail
 * Requires Authentication
 */
const saveTrail = async (event) => {
  try {
    // Verify authentication first
    const auth = await verifyAuthToken(event);
    if (!auth.authenticated) {
      console.warn(`[TRAIL] ❌ Authentication failed: ${auth.message}`);
      return httpResponse.error(auth.message, 401);
    }

    const body = parseBody(event);
    const { referenceCode, trailData, isPublished } = body;
    
    // Use authenticated user ID from token, not from request body
    const userId = auth.userId;
    const userEmail = auth.email;

    console.log(`[TRAIL] POST /trails - Save new trail`);
    console.log(`[TRAIL] Reference Code: ${referenceCode}`);
    console.log(`[TRAIL] User ID: ${userId}`);
    console.log(`[TRAIL] User Email: ${userEmail}`);
    console.log(`[TRAIL] Publish Requested: ${isPublished || false}`);
    console.log(`[TRAIL] Full body keys:`, Object.keys(body));
    if (body.isPaid !== undefined) {
      console.log(`[TRAIL] ⚠️  WARNING: isPaid found in request body: ${body.isPaid}`);
    }

    // Validate required fields
    if (!referenceCode || !trailData) {
      console.warn(`[TRAIL] ❌ Missing required fields`);
      return httpResponse.error(
        'Missing required fields: referenceCode, trailData'
      );
    }

    // Check if trail already exists
    const existingTrail = await trailsService.getTrail(referenceCode);
    
    if (existingTrail) {
      console.log(`[TRAIL] Trail ${referenceCode} already exists. Checking ownership...`);
      
      // Verify user owns this trail
      if (existingTrail.userId !== userId) {
        console.warn(`[TRAIL] ❌ User ${userId} does not own trail ${referenceCode} (owner: ${existingTrail.userId})`);
        return httpResponse.error(
          'Trail with this reference code already exists and belongs to another user',
          409
        );
      }
      
      // User owns the trail - update it instead
      console.log(`[TRAIL] User owns trail. Updating existing trail instead of creating new one...`);
      
      try {
        // Only pass the fields we want to update, never isPaid from frontend
        const updateData = {
          trailData,
          isPublished: isPublished || false
          // NOTE: isPaid should NEVER be set from frontend, only via payment webhook
        };
        
        // Safeguard: Remove any isPaid that might be in the body or trailData
        if (body.isPaid !== undefined) {
          console.log(`[TRAIL] ⚠️  WARNING: Ignoring isPaid from request body - this should only be set via payment webhook`);
        }
        if (trailData && trailData.isPaid !== undefined) {
          console.log(`[TRAIL] ⚠️  WARNING: Ignoring isPaid from trailData - this should only be set via payment webhook`);
          delete trailData.isPaid;
        }
        
        console.log(`[TRAIL] Update data:`, { hasTrailData: !!updateData.trailData, isPublished: updateData.isPublished });
        
        const success = await trailsService.updateTrail(referenceCode, updateData);
        
        if (!success) {
          console.error(`[TRAIL] ❌ Failed to update existing trail`);
          return httpResponse.serverError('Failed to update trail');
        }
        
        // Get updated trail
        const updatedTrail = await trailsService.getTrail(referenceCode);
        
        console.log(`[TRAIL] ✅ Trail updated successfully`);
        console.log(`[TRAIL] Status: ${updatedTrail.status}`);
        
        return httpResponse.success({
          success: true,
          message: 'Trail updated successfully',
          referenceCode: updatedTrail.referenceCode,
          status: updatedTrail.status,
          expiresAt: updatedTrail.expiresAt,
        });
      } catch (error) {
        if (error.message === 'PAYMENT_REQUIRED') {
          console.warn(`[TRAIL] ❌ Cannot publish - payment required`);
          return httpResponse.error(
            'Cannot publish trail with more than 5 stories. Payment is required.',
            400
          );
        }
        throw error;
      }
    }
    
    // Trail doesn't exist - create new one
    try {
      const result = await trailsService.saveTrail(
        referenceCode,
        userId,
        userEmail,
        trailData,
        isPublished || false
      );

      console.log(`[TRAIL] ✅ Trail created successfully`);
      console.log(`[TRAIL] Expires At: ${result.expiresAt}`);

      return httpResponse.success(
        {
          success: true,
          message: 'Trail created successfully',
          referenceCode: result.referenceCode,
          createdAt: new Date().toISOString(),
          expiresAt: result.expiresAt,
        },
        201
      );
    } catch (error) {
      // Check if it's a duplicate key error (race condition)
      if (error.code === 'ER_DUP_ENTRY' || error.name === 'SequelizeUniqueConstraintError') {
        console.warn(`[TRAIL] ❌ Duplicate reference code: ${referenceCode}`);
        return httpResponse.error(
          'Duplicate reference code. Please try again.',
          409
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Error saving trail:', error);
    return httpResponse.serverError('Failed to save trail');
  }
};

/**
 * GET /trails/{referenceCode}
 * Get a trail by reference code
 */
const getTrail = async (event) => {
  try {
    const path = event.path || event.rawPath;
    // Extract reference code from path like /trails/TRAIL-ABC
    const match = path.match(/\/trails\/([^/?]+)/);
    const referenceCode = match ? match[1] : null;

    console.log(`[TRAIL] GET /trails/:code - Fetch trail`);
    console.log(`[TRAIL] Reference Code: ${referenceCode}`);

    if (!referenceCode) {
      console.warn(`[TRAIL] ❌ Missing reference code`);
      return httpResponse.error('Missing referenceCode in path');
    }

    const trail = await trailsService.getTrail(referenceCode);

    if (!trail) {
      console.warn(`[TRAIL] ❌ Trail not found: ${referenceCode}`);
      return httpResponse.notFound('Trail not found');
    }

    // Check if expired
    if (new Date(trail.expiresAt) < new Date()) {
      console.warn(`[TRAIL] ⚠️  Trail expired: ${referenceCode}`);
      return httpResponse.error('Trail has expired', 410);
    }

    console.log(`[TRAIL] ✅ Trail found and valid`);
    return httpResponse.success({
      success: true,
      referenceCode: trail.referenceCode,
      userId: trail.userId,
      userEmail: trail.email,
      trailData: trail.trailData,
      isPaid: trail.isPaid,
      createdAt: trail.createdAt,
      expiresAt: trail.expiresAt,
      expired: false,
    });
  } catch (error) {
    console.error('❌ Error getting trail:', error);
    return httpResponse.serverError('Failed to get trail');
  }
};

/**
 * GET /trails/my
 * Get all trails for authenticated user (REQUIRES AUTH)
 */
const getUserTrails = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    console.log(`[TRAIL] GET /trails/my - Get user trails`);
    console.log(`[TRAIL] Auth Status: ${authResult.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);
    if (!authResult.authenticated) {
      console.warn(`[TRAIL] ❌ ${authResult.message || 'Not authenticated'}`);
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const userId = authResult.userId;
    console.log(`[TRAIL] User ID: ${userId}`);

    const trails = await trailsService.getUserTrails(userId);

    console.log(`[TRAIL] ✅ Retrieved ${trails.length} trails for user`);

    return httpResponse.success({
      success: true,
      trails: trails,
    });
  } catch (error) {
    console.error('❌ Error getting user trails:', error);
    return httpResponse.serverError('Failed to get trails');
  }
};

/**
 * PUT /trails/{referenceCode}/update
 * Update trail data (REQUIRES AUTH)
 */
const updateTrailData = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    console.log(`[TRAIL] PUT /trails/:code/update - Update trail`);
    console.log(`[TRAIL] Auth Status: ${authResult.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);

    if (!authResult.authenticated) {
      console.warn(`[TRAIL] ❌ ${authResult.message || 'Not authenticated'}`);
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    // Extract reference code from path like /trails/TRAIL-ABC/update
    const match = path.match(/\/trails\/([^\/]+)\//);    
    const referenceCode = match ? match[1] : null;

    console.log(`[TRAIL] Reference Code: ${referenceCode}`);

    if (!referenceCode) {
      console.warn(`[TRAIL] ❌ Missing reference code`);
      return httpResponse.error('Missing referenceCode in path');
    }

    const body = parseBody(event);
    const userId = authResult.userId;

    // Verify trail exists and user owns it
    const trail = await trailsService.getTrail(referenceCode);
    if (!trail) {
      console.warn(`[TRAIL] ❌ Trail not found: ${referenceCode}`);
      return httpResponse.notFound('Trail not found');
    }

    console.log(`[TRAIL] Trail found. Owner: ${trail.userId}, Current User: ${userId}`);

    if (trail.userId !== userId) {
      console.error(`[TRAIL] ❌ Unauthorized: User ${userId} cannot modify trail of ${trail.userId}`);
      return httpResponse.error('You do not have permission to modify this trail', 403);
    }

    // Check if trail is expired
    if (new Date(trail.expiresAt) < new Date()) {
      console.warn(`[TRAIL] ⚠️  Trail expired: ${referenceCode}`);
      return httpResponse.error('Trail has expired', 410);
    }

    // Update the trail data (allowed even if paid)
    const updateData = {
      trailData: body.trailData,
    };

    // Safeguard: Remove any isPaid that might be in the body or trailData
    if (body.isPaid !== undefined) {
      console.log(`[TRAIL] ⚠️  WARNING: Ignoring isPaid from request body - this should only be set via payment webhook`);
    }
    if (body.trailData && body.trailData.isPaid !== undefined) {
      console.log(`[TRAIL] ⚠️  WARNING: Ignoring isPaid from trailData - this should only be set via payment webhook`);
      delete body.trailData.isPaid;
    }

    // Handle publish/unpublish request
    if (body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished;
    }

    let success;
    try {
      success = await trailsService.updateTrail(referenceCode, updateData);
    } catch (error) {
      if (error.message === 'PAYMENT_REQUIRED') {
        console.warn(`[TRAIL] ❌ Cannot publish - payment required`);
        return httpResponse.error(
          'Cannot publish trail with more than 5 stories. Payment is required.',
          400
        );
      }
      throw error;
    }

    if (!success) {
      console.error(`[TRAIL] ❌ Failed to update trail: ${referenceCode}`);
      return httpResponse.serverError('Failed to update trail');
    }

    const updatedTrail = await trailsService.getTrail(referenceCode);
    console.log(`[TRAIL] ✅ Trail updated successfully`);
    return httpResponse.success({
      success: true,
      message: 'Trail updated successfully',
      referenceCode: referenceCode,
      updatedAt: updatedTrail.updatedAt,
    });
  } catch (error) {
    console.error('❌ Error updating trail:', error);
    return httpResponse.serverError('Failed to update trail');
  }
};

/**
 * DELETE /trails/{referenceCode}
 * Delete a trail (REQUIRES AUTH)
 */
const deleteTrail = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    if (!authResult.authenticated) {
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    // Extract reference code from path
    const match = path.match(/\/trails\/([^/?]+)/);
    const referenceCode = match ? match[1] : null;

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode in path');
    }

    const userId = authResult.userId;

    // Verify trail exists and user owns it
    const trail = await trailsService.getTrail(referenceCode);
    if (!trail) {
      return httpResponse.notFound('Trail not found');
    }

    if (trail.userId !== userId) {
      return httpResponse.error('You do not have permission to delete this trail', 403);
    }

    // Can only delete unpaid trails
    if (trail.isPaid) {
      return httpResponse.error('Cannot delete a trail that has already been paid', 400);
    }

    const success = await trailsService.deleteTrail(referenceCode);

    if (!success) {
      return httpResponse.notFound('Trail not found');
    }

    return httpResponse.success({
      success: true,
      message: 'Trail deleted successfully',
      referenceCode: referenceCode,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error deleting trail:', error);
    return httpResponse.serverError('Failed to delete trail');
  }
};


/**
 * PUT /trails/{referenceCode}/paid
 * Mark trail as paid (REQUIRES AUTH)
 */
const markTrailAsPaid = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    console.log(`[PAYMENT] PUT /trails/:code/paid - Mark as Paid`);
    console.log(`[PAYMENT] Auth Status: ${authResult.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);

    if (!authResult.authenticated) {
      console.warn(`[PAYMENT] ❌ ${authResult.message || 'Not authenticated'}`);
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    const match = path.match(/\/trails\/([^\/]+)\//);    
    const referenceCode = match ? match[1] : null;

    console.log(`[PAYMENT] Reference Code: ${referenceCode}`);

    if (!referenceCode) {
      console.warn(`[PAYMENT] ❌ Missing reference code`);
      return httpResponse.error('Missing referenceCode in path');
    }

    const userId = authResult.userId;
    const body = parseBody(event);

    console.log(`[PAYMENT] User ID: ${userId}`);

    // Verify trail exists and user owns it
    const trail = await trailsService.getTrail(referenceCode);
    if (!trail) {
      console.warn(`[PAYMENT] ❌ Trail not found: ${referenceCode}`);
      return httpResponse.notFound('Trail not found');
    }

    console.log(`[PAYMENT] Trail found. Owner: ${trail.userId}`);

    if (trail.userId !== userId) {
      console.error(`[PAYMENT] ❌ Unauthorized: User ${userId} cannot pay for trail of ${trail.userId}`);
      return httpResponse.error('You do not have permission to modify this trail', 403);
    }

    // Check if already paid
    if (trail.isPaid) {
      console.warn(`[PAYMENT] ⚠️  Trail already paid: ${referenceCode}`);
      return httpResponse.error('Trail has already been paid', 400);
    }

    // Mark as paid
    console.log(`[PAYMENT] Marking trail as paid...`);
    const success = await trailsService.markTrailAsPaid(referenceCode);

    if (!success) {
      console.error(`[PAYMENT] ❌ Failed to mark trail as paid: ${referenceCode}`);
      return httpResponse.serverError('Failed to mark trail as paid');
    }

    const updatedTrail = await trailsService.getTrail(referenceCode);

    console.log(`[PAYMENT] ✅ Trail marked as paid successfully`);
    console.log(`[PAYMENT] Published At: ${new Date().toISOString()}`);

    return httpResponse.success({
      success: true,
      message: 'Trail marked as paid and published',
      referenceCode: referenceCode,
      isPaid: true,
      publishedAt: new Date().toISOString(),
      trailId: trail.id,
    });
  } catch (error) {
    console.error('❌ Error marking trail as paid:', error);
    return httpResponse.serverError('Failed to mark trail as paid');
  }
};

/**
 * PUT /trails/{referenceCode}/status
 * Update trail status (REQUIRES AUTH)
 */
const updateTrailStatus = async (event) => {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(event);
    if (!authResult.authenticated) {
      return httpResponse.unauthorized(authResult.message || 'Missing or invalid authentication token');
    }

    const path = event.path || event.rawPath;
    const match = path.match(/\/trails\/([^\/]+)\//);    
    const referenceCode = match ? match[1] : null;

    if (!referenceCode) {
      return httpResponse.error('Missing referenceCode in path');
    }

    const userId = authResult.userId;
    const body = parseBody(event);

    if (!body.status) {
      return httpResponse.error('Missing status in request body');
    }

    // Verify trail exists and user owns it
    const trail = await trailsService.getTrail(referenceCode);
    if (!trail) {
      return httpResponse.notFound('Trail not found');
    }

    if (trail.userId !== userId) {
      return httpResponse.error('You do not have permission to modify this trail', 403);
    }

    // Valid statuses
    const validStatuses = ['free_draft', 'paid_draft', 'payment_pending', 'payment_completed', 'payment_failed', 'submitted', 'completed', 'free_published', 'paid_published'];
    if (!validStatuses.includes(body.status)) {
      return httpResponse.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Update status
    const success = await trailsService.updateTrail(referenceCode, { status: body.status });

    if (!success) {
      return httpResponse.serverError('Failed to update trail status');
    }

    return httpResponse.success({
      success: true,
      message: 'Trail status updated',
      referenceCode: referenceCode,
      status: body.status,
    });
  } catch (error) {
    console.error('❌ Error updating trail status:', error);
    return httpResponse.serverError('Failed to update trail status');
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

    const trails = await trailsService.getPublishedTrails({
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
  saveTrail,
  getTrail,
  getUserTrails,
  updateTrailData,
  markTrailAsPaid,
  updateTrailStatus,
  deleteTrail,
  getPublishedTrails,
};

