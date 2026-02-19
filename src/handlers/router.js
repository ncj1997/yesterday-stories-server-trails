/**
 * Main API Router
 * Routes requests to appropriate handlers based on method and path
 */

const draftTrailsHandlers = require('./draftTrails');
const filesHandlers = require('./files');
const paymentsHandler = require('./payments');
const { httpResponse } = require('../utils/http');

const router = async (event, context) => {
  try {
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const requestId = context.requestId || context.awsRequestId || 'unknown';

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${new Date().toISOString()}] REQUEST ID: ${requestId}`);
    console.log(`📍 ${httpMethod} ${path}`);
    console.log(`${'='.repeat(80)}`);

    // Draft Trails Routes
    if (path.startsWith('/draft-trails')) {
      if (httpMethod === 'POST') {
        return draftTrailsHandlers.saveDraftTrail(event);
      }
      if (httpMethod === 'GET') {
        // GET /draft-trails/my-drafts - requires auth
        if (path.includes('/my-drafts') || path.endsWith('/my-drafts')) {
          return draftTrailsHandlers.getUserDraftTrails(event);
        }
        // GET /draft-trails/:code - public
        return draftTrailsHandlers.getDraftTrail(event);
      }
      if (httpMethod === 'PUT') {
        // PUT /draft-trails/:code/update - requires auth
        if (path.includes('/update')) {
          return draftTrailsHandlers.updateDraftTrailData(event);
        }
        // PUT /draft-trails/:code/paid - requires auth
        if (path.includes('/paid')) {
          return draftTrailsHandlers.markDraftAsPaid(event);
        }
        // PUT /draft-trails/:code/status - requires auth
        if (path.includes('/status')) {
          return draftTrailsHandlers.updateDraftStatus(event);
        }
        // Fallback for generic update
        return draftTrailsHandlers.updateDraftTrailData(event);
      }
      if (httpMethod === 'DELETE') {
        return draftTrailsHandlers.deleteDraftTrail(event);
      }
    }

    // Published Trails Routes
    if (path === '/trails' || path === '/trails/') {
      if (httpMethod === 'GET') {
        return draftTrailsHandlers.getPublishedTrails(event);
      }
    }

    // File Upload Routes
    if (path.startsWith('/images')) {
      if (httpMethod === 'POST') {
        return filesHandlers.uploadImage(event);
      }
    }

    if (path.startsWith('/videos')) {
      if (httpMethod === 'POST') {
        return filesHandlers.uploadVideo(event);
      }
    }

    // Files List Route
    if (path.startsWith('/files')) {
      if (httpMethod === 'GET') {
        return filesHandlers.getFilesByReference(event);
      }
    }

    // Payments Routes
    if (path.startsWith('/payments')) {
      if (httpMethod === 'POST') {
        if (path.includes('/create-intent')) {
          return paymentsHandler.createPaymentIntent(event);
        }
      }
    }

    // Health Check
    if (path === '/health' || path === '/health/') {
      return httpResponse.success({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }

    // 404 Not Found
    return httpResponse.notFound(`Path ${path} not found`);
  } catch (error) {
    console.error('❌ Router error:', error);
    return httpResponse.serverError('Internal server error');
  }
};

module.exports = router;
