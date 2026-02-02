/**
 * Draft Trails Routes
 * Handles draft trail save, retrieve, update, and delete operations
 * Uses JSON file storage for persistence
 * Token-based authentication via Authorization header
 */

const express = require('express');
const router = express.Router();
const dataStore = require('../config/dataStore');
const { authMiddleware } = require('../middleware/auth');

/**
 * Helper function to check if draft is expired
 */
const isExpired = (expiresAt) => Date.now() > expiresAt;

/**
 * Helper function to calculate days remaining
 */
const getDaysRemaining = (expiresAt) => {
  const daysLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
};

/**
 * POST /api/draft-trails
 * Save a new draft trail
 * No authentication required for creation (using email/userId from body)
 */
router.post('/', (req, res) => {
  try {
    const { referenceCode, userId, userEmail, trailData } = req.body;

    console.log(`\n📍 POST /api/draft-trails`);
    console.log(`   Reference code: ${referenceCode}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   User email: ${userEmail}`);

    if (!referenceCode || !userId || !userEmail || !trailData) {
      console.log(`   ❌ Missing required fields`);
      return res.status(400).json({
        error: 'Missing required fields: referenceCode, userId, userEmail, trailData',
      });
    }

    // Calculate expiration time (7 days from now)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const draftData = {
      referenceCode,
      userId,
      userEmail,
      trailData,
      status: 'draft',
      createdAt: Date.now(),
      expiresAt,
      daysRemaining: 7,
    };

    const success = dataStore.saveDraftTrail(draftData);

    if (!success) {
      console.log(`   ❌ Failed to save to database`);
      return res.status(500).json({ error: 'Failed to save draft trail' });
    }

    console.log(`   ✅ Draft saved successfully`);
    console.log(`   Expires in 7 days\n`);

    res.status(201).json({
      success: true,
      message: 'Draft trail saved successfully',
      referenceCode,
      userId,
      userEmail,
      daysRemaining: 7,
    });
  } catch (error) {
    console.error('❌ Error saving draft trail:', error);
    res.status(500).json({ error: 'Failed to save draft trail' });
  }
});

/**
 * ============================================================================
 * ROUTE ORDER IMPORTANT: More specific routes BEFORE generic routes
 * ============================================================================
 * Routes are matched in order:
 * 1. POST / - Create draft
 * 2. GET / - Get all drafts (root)
 * 3. GET /my-drafts - Authenticated user's drafts (specific)
 * 4. GET /user/:userId - Deprecated user endpoint (specific)
 * 5. PUT /:referenceCode/status - Update status (more specific than GET)
 * 6. DELETE /:referenceCode - Delete (generic parameter)
 * 7. GET /:referenceCode - Get by code (generic parameter - catches rest)
 */

/**
 * GET /api/draft-trails
 * Get all draft trails (debug endpoint)
 */
router.get('/', (req, res) => {
  try {
    console.log(`\n📋 GET /api/draft-trails (all drafts)`);
    
    // Clean up expired drafts first
    dataStore.cleanupExpiredDrafts();
    
    const allDrafts = dataStore.readDraftTrails().map((draft) => ({
      ...draft,
      daysRemaining: getDaysRemaining(draft.expiresAt),
      isExpired: isExpired(draft.expiresAt),
    }));

    console.log(`   Total: ${allDrafts.length} drafts\n`);

    res.status(200).json({
      total: allDrafts.length,
      drafts: allDrafts,
    });
  } catch (error) {
    console.error('❌ Error listing draft trails:', error);
    res.status(500).json({ error: 'Failed to list draft trails' });
  }
});

/**
 * GET /api/draft-trails/my-drafts
 * Retrieve all draft trails for authenticated user
 * Requires: Authorization: Bearer <firebase-idToken>
 */
router.get('/my-drafts', authMiddleware, (req, res) => {
  try {
    const userEmail = req.user.email;
    console.log(`\n📍 GET /api/draft-trails/my-drafts`);
    console.log(`   Authenticated user: ${userEmail}`);

    // Clean up expired drafts first
    console.log(`   🧹 Cleaning up expired drafts...`);
    dataStore.cleanupExpiredDrafts();

    // Get all drafts and filter by email
    const allDrafts = dataStore.readDraftTrails();
    console.log(`   📚 Total drafts in database: ${allDrafts.length}`);

    const userDrafts = allDrafts
      .filter(draft => {
        const isUserDraft = draft.userEmail === userEmail;
        const isNotExpired = !isExpired(draft.expiresAt);
        if (isUserDraft) {
          console.log(`      ✓ Found draft: ${draft.referenceCode} (Status: ${draft.status})`);
        }
        return isUserDraft && isNotExpired;
      })
      .map(draft => ({
        ...draft,
        daysRemaining: getDaysRemaining(draft.expiresAt),
        isExpired: isExpired(draft.expiresAt),
      }));

    console.log(`   ✅ Retrieved ${userDrafts.length} active draft(s)\n`);
    if (userDrafts.length > 0) {
      userDrafts.forEach(draft => {
        console.log(`      • ${draft.referenceCode} - ${draft.status} (${draft.daysRemaining} days remaining)`);
      });
    }

    res.status(200).json({
      success: true,
      userEmail,
      total: userDrafts.length,
      drafts: userDrafts,
    });
  } catch (error) {
    console.error('❌ Error retrieving user draft trails:', error);
    res.status(500).json({ error: 'Failed to retrieve user draft trails' });
  }
});

/**
 * GET /api/draft-trails/user
 * Catch-all for /user endpoint without userId parameter
 * Returns helpful error message
 */
router.get('/user', (req, res) => {
  console.log(`\n⚠️ GET /api/draft-trails/user - Missing userId parameter`);
  return res.status(400).json({
    error: 'Missing userId parameter',
    hint: 'Use: GET /api/draft-trails/user/:userId or GET /api/draft-trails/my-drafts with token',
    exampleUrl: '/api/draft-trails/user/user123',
  });
});

/**
 * GET /api/draft-trails/user/:userId
 * DEPRECATED: Use GET /api/draft-trails/my-drafts with token instead
 * Retrieve all draft trails for a specific user
 */
router.get('/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`\n📍 GET /api/draft-trails/user/:userId`);
    console.log(`   User ID parameter: "${userId}"`);
    console.log(`   ⚠️  WARNING: This endpoint is deprecated. Use GET /api/draft-trails/my-drafts with Authorization token`);

    if (!userId) {
      console.log(`   ❌ Missing userId parameter`);
      return res.status(400).json({
        error: 'Missing required parameter: userId',
      });
    }

    // Clean up expired drafts first
    console.log(`   🧹 Cleaning up expired drafts...`);
    dataStore.cleanupExpiredDrafts();

    // Get all drafts and filter by userId
    const allDrafts = dataStore.readDraftTrails();
    console.log(`   📚 Total drafts in database: ${allDrafts.length}`);

    const userDrafts = allDrafts
      .filter(draft => {
        const isUserDraft = draft.userId === userId;
        const isNotExpired = !isExpired(draft.expiresAt);
        if (isUserDraft) {
          console.log(`      ✓ Found draft: ${draft.referenceCode} (Status: ${draft.status})`);
        }
        return isUserDraft && isNotExpired;
      })
      .map(draft => ({
        ...draft,
        daysRemaining: getDaysRemaining(draft.expiresAt),
        isExpired: isExpired(draft.expiresAt),
      }));

    console.log(`   ✅ Retrieved ${userDrafts.length} active draft(s) for user ${userId}`);
    if (userDrafts.length > 0) {
      userDrafts.forEach(draft => {
        console.log(`      • ${draft.referenceCode} - ${draft.status} (${draft.daysRemaining} days remaining)`);
      });
    }

    res.status(200).json({
      success: true,
      userId,
      total: userDrafts.length,
      drafts: userDrafts,
    });
  } catch (error) {
    console.error('❌ Error retrieving user draft trails:', error);
    res.status(500).json({ error: 'Failed to retrieve user draft trails' });
  }
});

/**
 * PUT /api/draft-trails/:referenceCode/status
 * Update draft trail status (e.g., payment_failed, payment_completed)
 * Requires: Authorization: Bearer <firebase-idToken>
 * NOTE: This route must come BEFORE the GET /:referenceCode route
 */
router.put('/:referenceCode/status', authMiddleware, (req, res) => {
  try {
    const { referenceCode } = req.params;
    const userEmail = req.user.email;
    const { status } = req.body;

    console.log(`\n📋 PUT /api/draft-trails/:referenceCode/status`);
    console.log(`   Reference code: "${referenceCode}"`);
    console.log(`   New status: "${status}"`);
    console.log(`   User email: ${userEmail}`);

    if (!status) {
      console.log(`   ❌ Missing status field in request body`);
      return res.status(400).json({
        error: 'Missing required field: status',
      });
    }

    const draft = dataStore.getDraftTrail(referenceCode);

    if (!draft) {
      console.log(`   ❌ Draft not found`);
      return res.status(404).json({
        error: 'Draft trail not found',
        requestedCode: referenceCode,
      });
    }

    // Verify ownership
    if (draft.userEmail !== userEmail) {
      console.log(`   ❌ Unauthorized status update attempt`);
      console.log(`      Requesting user: ${userEmail}`);
      console.log(`      Draft owner: ${draft.userEmail}`);
      return res.status(403).json({
        error: 'Unauthorized: You can only update your own drafts',
      });
    }

    const success = dataStore.updateDraftStatus(referenceCode, status);

    if (!success) {
      console.log(`   ❌ Failed to update status in database`);
      return res.status(500).json({ error: 'Failed to update draft trail status' });
    }

    console.log(`   ✅ Draft status updated`);
    console.log(`      Previous: ${draft.status}`);
    console.log(`      New: ${status}\n`);

    res.status(200).json({
      success: true,
      message: 'Draft trail status updated',
      status,
    });
  } catch (error) {
    console.error(`❌ Error updating draft status:`, error.message);
    res.status(500).json({ error: 'Failed to update draft trail status', detail: error.message });
  }
});

/**
 * PUT /api/draft-trails/:referenceCode/paid
 * Mark draft trail as paid
 * Requires: Authorization: Bearer <firebase-idToken>
 * NOTE: This route must come BEFORE the GET /:referenceCode route
 */
router.put('/:referenceCode/paid', authMiddleware, (req, res) => {
  try {
    const { referenceCode } = req.params;
    const userEmail = req.user.email;
    const { isPaid } = req.body;

    console.log(`\n📋 PUT /api/draft-trails/:referenceCode/paid`);
    console.log(`   Reference code: "${referenceCode}"`);
    console.log(`   isPaid value: ${isPaid}`);
    console.log(`   User email: ${userEmail}`);

    if (isPaid === undefined || isPaid === null) {
      console.log(`   ❌ Missing isPaid field in request body`);
      return res.status(400).json({
        error: 'Missing required field: isPaid',
      });
    }

    const draft = dataStore.getDraftTrail(referenceCode);

    if (!draft) {
      console.log(`   ❌ Draft not found`);
      return res.status(404).json({
        error: 'Draft trail not found',
        requestedCode: referenceCode,
      });
    }

    // Verify ownership
    if (draft.userEmail !== userEmail) {
      console.log(`   ❌ Unauthorized paid update attempt`);
      console.log(`      Requesting user: ${userEmail}`);
      console.log(`      Draft owner: ${draft.userEmail}`);
      return res.status(403).json({
        error: 'Unauthorized: You can only update your own drafts',
      });
    }

    // Read all drafts, update the specific one
    const allDrafts = dataStore.readDraftTrails();
    const draftIndex = allDrafts.findIndex(d => d.referenceCode === referenceCode);
    
    if (draftIndex === -1) {
      console.log(`   ❌ Draft not found in database`);
      return res.status(404).json({
        error: 'Draft trail not found',
      });
    }

    // Update the isPaid field
    allDrafts[draftIndex].isPaid = isPaid;
    allDrafts[draftIndex].paidAt = isPaid ? Date.now() : null;
    
    // Write back to database
    const success = dataStore.writeDraftTrails(allDrafts);

    if (!success) {
      console.log(`   ❌ Failed to update paid status in database`);
      return res.status(500).json({ error: 'Failed to update draft trail paid status' });
    }

    console.log(`   ✅ Draft paid status updated`);
    console.log(`      isPaid: ${isPaid}`);
    console.log(`      paidAt: ${isPaid ? new Date(allDrafts[draftIndex].paidAt).toISOString() : 'null'}\n`);

    res.status(200).json({
      success: true,
      message: 'Draft trail paid status updated',
      isPaid,
      paidAt: allDrafts[draftIndex].paidAt,
    });
  } catch (error) {
    console.error(`❌ Error updating draft paid status:`, error.message);
    res.status(500).json({ error: 'Failed to update draft trail paid status', detail: error.message });
  }
});

/**
 * DELETE /api/draft-trails/:referenceCode
 * Delete a draft trail (after successful payment)
 * Requires: Authorization: Bearer <firebase-idToken>
 */
router.delete('/:referenceCode', authMiddleware, (req, res) => {
  try {
    const { referenceCode } = req.params;
    const userEmail = req.user.email;
    
    console.log(`\n📋 DELETE /api/draft-trails/:referenceCode`);
    console.log(`   Reference code: "${referenceCode}"`);
    console.log(`   User email: ${userEmail}`);
    
    const draft = dataStore.getDraftTrail(referenceCode);

    if (!draft) {
      console.log(`   ❌ Draft not found`);
      return res.status(404).json({
        error: 'Draft trail not found',
        requestedCode: referenceCode,
      });
    }

    // Verify ownership
    if (draft.userEmail !== userEmail) {
      console.log(`   ❌ Unauthorized delete attempt`);
      console.log(`      Requesting user: ${userEmail}`);
      console.log(`      Draft owner: ${draft.userEmail}`);
      return res.status(403).json({
        error: 'Unauthorized: You can only delete your own drafts',
      });
    }

    dataStore.deleteDraftTrail(referenceCode);
    console.log(`   ✅ Draft deleted successfully\n`);

    res.status(200).json({
      success: true,
      message: 'Draft trail deleted successfully',
    });
  } catch (error) {
    console.error(`❌ Error deleting draft:`, error.message);
    res.status(500).json({ error: 'Failed to delete draft trail', detail: error.message });
  }
});

/**
 * GET /api/draft-trails/:referenceCode
 * Retrieve a draft trail by reference code
 * NOTE: This is the most generic GET route, so it comes LAST
 */
router.get('/:referenceCode', (req, res) => {
  try {
    const { referenceCode } = req.params;
    console.log(`\n📋 GET /api/draft-trails/:referenceCode`);
    console.log(`   Searching for reference code: "${referenceCode}"`);
    
    const draft = dataStore.getDraftTrail(referenceCode);

    if (!draft) {
      const allDrafts = dataStore.readDraftTrails();
      console.log(`\n❌ Draft not found: "${referenceCode}"`);
      console.log(`   Total drafts in database: ${allDrafts.length}`);
      if (allDrafts.length > 0) {
        console.log(`   Available reference codes:`);
        allDrafts.forEach(d => {
          const status = isExpired(d.expiresAt) ? '(EXPIRED)' : '(active)';
          console.log(`     • ${d.referenceCode} - ${d.status} ${status}`);
        });
      } else {
        console.log(`   Database is empty - no drafts exist`);
      }
      return res.status(404).json({
        error: 'Draft trail not found',
        requestedCode: referenceCode,
        totalDraftsInDatabase: allDrafts.length,
      });
    }

    // Check if expired
    if (isExpired(draft.expiresAt)) {
      console.log(`\n⏰ Draft expired: ${referenceCode}`);
      console.log(`   Created: ${new Date(draft.createdAt).toISOString()}`);
      console.log(`   Expired: ${new Date(draft.expiresAt).toISOString()}`);
      dataStore.deleteDraftTrail(referenceCode);
      return res.status(410).json({
        expired: true,
        error: 'Draft trail has expired',
        expiresAt: draft.expiresAt,
      });
    }

    const daysRemaining = getDaysRemaining(draft.expiresAt);
    const response = {
      ...draft,
      daysRemaining,
    };

    console.log(`\n✅ Draft retrieved: ${referenceCode}`);
    console.log(`   User: ${draft.userEmail} (${draft.userId})`);
    console.log(`   Status: ${draft.status}`);
    console.log(`   Days remaining: ${daysRemaining}`);
    console.log(`   Created: ${new Date(draft.createdAt).toISOString()}`);

    res.status(200).json(response);
  } catch (error) {
    console.error(`\n❌ Error retrieving draft trail "${req.params.referenceCode}":`, error.message);
    console.error('   Full error:', error);
    res.status(500).json({ error: 'Failed to retrieve draft trail', detail: error.message });
  }
});

module.exports = router;
