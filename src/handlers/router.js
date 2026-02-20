/**
 * Main API Router
 * Routes requests to appropriate handlers based on method and path
 */

const trailsHandlers = require('./trails');
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

    // Trails Routes
    if (path.startsWith('/trails')) {
      if (httpMethod === 'POST') {
        return trailsHandlers.saveTrail(event);
      }
      if (httpMethod === 'GET') {
        // GET /trails/my - requires auth
        if (path.includes('/my') || path.endsWith('/my')) {
          return trailsHandlers.getUserTrails(event);
        }
        // GET /trails/:code - public
        return trailsHandlers.getTrail(event);
      }
      if (httpMethod === 'PUT') {
        // PUT /trails/:code/update - requires auth
        if (path.includes('/update')) {
          return trailsHandlers.updateTrailData(event);
        }
        // PUT /trails/:code/paid - requires auth
        if (path.includes('/paid')) {
          return trailsHandlers.markTrailAsPaid(event);
        }
        // PUT /trails/:code/status - requires auth
        if (path.includes('/status')) {
          return trailsHandlers.updateTrailStatus(event);
        }
        // Fallback for generic update
        return trailsHandlers.updateTrailData(event);
      }
      if (httpMethod === 'DELETE') {
        return trailsHandlers.deleteTrail(event);
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

    // 404 Not Found - Log unknown endpoint details
    console.log(`\n⚠️ [UNKNOWN ENDPOINT] ${httpMethod} ${path}`);
    console.log('📦 Payload Details:');
    console.log('  Headers:', JSON.stringify(event.headers || {}, null, 2));
    console.log('  Query Params:', JSON.stringify(event.queryStringParameters || {}, null, 2));
    console.log('  Path Params:', JSON.stringify(event.pathParameters || {}, null, 2));
    console.log('  Body:', event.body ? (typeof event.body === 'string' ? event.body : JSON.stringify(event.body, null, 2)) : 'No body');
    console.log(`${'='.repeat(80)}\n`);
    
    return httpResponse.notFound(`Path ${path} not found`);
  } catch (error) {
    console.error('❌ Router error:', error);
    return httpResponse.serverError('Internal server error');
  }
};

module.exports = router;
