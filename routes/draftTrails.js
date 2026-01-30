/**
 * Draft Trails Routes
 * Handles draft trail save, retrieve, update, and delete operations
 * Uses JSON file storage for persistence
 */

const express = require('express');
const router = express.Router();
const dataStore = require('../config/dataStore');

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
 */
router.post('/', (req, res) => {
  try {
    const { referenceCode, userId, userEmail, trailData } = req.body;

    if (!referenceCode || !userId || !trailData) {
      return res.status(400).json({
        error: 'Missing required fields: referenceCode, userId, trailData',
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
      return res.status(500).json({ error: 'Failed to save draft trail' });
    }

    console.log(
      `✅ Draft saved: ${referenceCode} for user ${userEmail} (expires in 7 days)`
    );

    res.status(201).json({
      success: true,
      message: 'Draft trail saved successfully',
      referenceCode,
      daysRemaining: 7,
    });
  } catch (error) {
    console.error('Error saving draft trail:', error);
    res.status(500).json({ error: 'Failed to save draft trail' });
  }
});

/**
 * GET /api/draft-trails/user/:userId
 * Retrieve all draft trails for a specific user
 */
router.get('/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`\n📍 GET /api/draft-trails/user/:userId - Fetching drafts for user: ${userId}`);

    if (!userId) {
      console.log(`❌ Missing userId parameter`);
      return res.status(400).json({
        error: 'Missing required parameter: userId',
      });
    }

    // Clean up expired drafts first
    console.log(`🧹 Cleaning up expired drafts...`);
    dataStore.cleanupExpiredDrafts();

    // Get all drafts and filter by userId
    const allDrafts = dataStore.readDraftTrails();
    console.log(`📚 Total drafts in database: ${allDrafts.length}`);

    const userDrafts = allDrafts
      .filter(draft => {
        const isUserDraft = draft.userId === userId;
        const isNotExpired = !isExpired(draft.expiresAt);
        if (isUserDraft) {
          console.log(`  ✓ Found draft: ${draft.referenceCode} (Status: ${draft.status})`);
        }
        return isUserDraft && isNotExpired;
      })
      .map(draft => ({
        ...draft,
        daysRemaining: getDaysRemaining(draft.expiresAt),
        isExpired: isExpired(draft.expiresAt),
      }));

    console.log(`✅ Retrieved ${userDrafts.length} active draft(s) for user ${userId}`);
    if (userDrafts.length > 0) {
      userDrafts.forEach(draft => {
        console.log(`   • ${draft.referenceCode} - ${draft.status} (${draft.daysRemaining} days remaining)`);
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
 * GET /api/draft-trails/:referenceCode
 * Retrieve a draft trail by reference code
 */
router.get('/:referenceCode', (req, res) => {
  try {
    const { referenceCode } = req.params;
    const draft = dataStore.getDraftTrail(referenceCode);

    if (!draft) {
      console.log(`❌ Draft not found: ${referenceCode}`);
      return res.status(404).json({
        error: 'Draft trail not found',
      });
    }

    // Check if expired
    if (isExpired(draft.expiresAt)) {
      console.log(`⏰ Draft expired: ${referenceCode}`);
      dataStore.deleteDraftTrail(referenceCode);
      return res.status(410).json({
        expired: true,
        error: 'Draft trail has expired',
      });
    }

    const daysRemaining = getDaysRemaining(draft.expiresAt);
    const response = {
      ...draft,
      daysRemaining,
    };

    console.log(`✅ Draft retrieved: ${referenceCode} (${daysRemaining} days remaining)`);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error retrieving draft trail:', error);
    res.status(500).json({ error: 'Failed to retrieve draft trail' });
  }
});

/**
 * DELETE /api/draft-trails/:referenceCode
 * Delete a draft trail (after successful payment)
 */
router.delete('/:referenceCode', (req, res) => {
  try {
    const { referenceCode } = req.params;
    const draft = dataStore.getDraftTrail(referenceCode);

    if (!draft) {
      console.log(`❌ Draft not found for deletion: ${referenceCode}`);
      return res.status(404).json({
        error: 'Draft trail not found',
      });
    }

    dataStore.deleteDraftTrail(referenceCode);
    console.log(`🗑️ Draft deleted: ${referenceCode}`);

    res.status(200).json({
      success: true,
      message: 'Draft trail deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting draft trail:', error);
    res.status(500).json({ error: 'Failed to delete draft trail' });
  }
});

/**
 * PUT /api/draft-trails/:referenceCode/status
 * Update draft trail status (e.g., payment_failed, payment_completed)
 */
router.put('/:referenceCode/status', (req, res) => {
  try {
    const { referenceCode } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Missing required field: status',
      });
    }

    const draft = dataStore.getDraftTrail(referenceCode);

    if (!draft) {
      console.log(`❌ Draft not found for status update: ${referenceCode}`);
      return res.status(404).json({
        error: 'Draft trail not found',
      });
    }

    const success = dataStore.updateDraftStatus(referenceCode, status);

    if (!success) {
      return res.status(500).json({ error: 'Failed to update draft trail status' });
    }

    console.log(`✅ Draft status updated: ${referenceCode} → ${status}`);

    res.status(200).json({
      success: true,
      message: 'Draft trail status updated',
      status,
    });
  } catch (error) {
    console.error('Error updating draft trail status:', error);
    res.status(500).json({ error: 'Failed to update draft trail status' });
  }
});

/**
 * GET /api/draft-trails
 * Get all draft trails (debug endpoint)
 */
router.get('/', (req, res) => {
  try {
    // Clean up expired drafts first
    dataStore.cleanupExpiredDrafts();
    
    const allDrafts = dataStore.readDraftTrails().map((draft) => ({
      ...draft,
      daysRemaining: getDaysRemaining(draft.expiresAt),
      isExpired: isExpired(draft.expiresAt),
    }));

    console.log(`📋 Listing all drafts: ${allDrafts.length} total`);

    res.status(200).json({
      total: allDrafts.length,
      drafts: allDrafts,
    });
  } catch (error) {
    console.error('Error listing draft trails:', error);
    res.status(500).json({ error: 'Failed to list draft trails' });
  }
});

module.exports = router;
