/**
 * Main API Router
 * Routes requests to appropriate handlers based on method and path
 */

const draftTrailsHandlers = require('./draftTrails');
const filesHandlers = require('./files');
const { httpResponse } = require('../utils/http');

const router = async (event, context) => {
  try {
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;

    console.log(`📍 ${httpMethod} ${path}`);

    // Draft Trails Routes
    if (path.startsWith('/draft-trails')) {
      if (httpMethod === 'POST') {
        return draftTrailsHandlers.saveDraftTrail(event);
      }
      if (httpMethod === 'GET') {
        if (path.includes('/user/')) {
          return draftTrailsHandlers.getUserDraftTrails(event);
        }
        return draftTrailsHandlers.getDraftTrail(event);
      }
      if (httpMethod === 'PUT') {
        return draftTrailsHandlers.updateDraftTrail(event);
      }
      if (httpMethod === 'DELETE') {
        return draftTrailsHandlers.deleteDraftTrail(event);
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
