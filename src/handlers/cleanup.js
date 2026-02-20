/**
 * Scheduled Lambda Handler: Clean up expired drafts
 * Runs daily to mark drafts as 'expired'
 */

const trailsService = require('../services/trailsService');
const { httpResponse } = require('../utils/http');

const handler = async (event, context) => {
  try {
    console.log('🧹 Starting cleanup of expired drafts...');

    const count = await trailsService.cleanupExpiredDrafts();

    console.log(`✅ Cleaned up ${count} expired drafts`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Cleaned up ${count} expired drafts`,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('❌ Error in cleanup handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Cleanup failed',
        message: error.message,
      }),
    };
  }
};

module.exports = { handler };
