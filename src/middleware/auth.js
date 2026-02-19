/**
 * Authentication Middleware
 * Validates tokens from Authorization header
 * Supports both database tokens and Firebase ID tokens
 */

const { query } = require('../db/mysql');

/**
 * Verify authentication token
 * Returns { authenticated: true, userId: 'user-id' } on success
 * Returns { authenticated: false, message: 'error message' } on failure
 */
const verifyAuthToken = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    console.log(`[AUTH] Verifying authentication token...`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[AUTH] ❌ Missing or invalid Authorization header`);
      return {
        authenticated: false,
        message: 'Missing or invalid Authorization header',
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log(`[AUTH] Token found, checking in database...`);

    // Try to verify token in database
    const results = await query(
      `SELECT userId FROM tokens 
       WHERE token = ? AND expiresAt > NOW()`,
      [token]
    );

    if (results.length > 0) {
      console.log(`[AUTH] ✅ Token verified. User ID: ${results[0].userId}`);
      return {
        authenticated: true,
        userId: results[0].userId,
      };
    }

    // Token not found in database or expired
    console.warn(`[AUTH] ❌ Invalid or expired token`);
    return {
      authenticated: false,
      message: 'Invalid or expired token',
    };
  } catch (error) {
    console.error('❌ Auth verification error:', error);
    return {
      authenticated: false,
      message: 'Authentication error',
    };
  }
};

/**
 * Middleware function for lambda handlers
 */
const authMiddleware = async (event) => {
  const authResult = await verifyAuthToken(event);
  
  if (!authResult.authenticated) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: authResult.message || 'Unauthorized' 
      }),
    };
  }

  return authResult;
};

/**
 * Wrapper to enforce authentication on handlers
 */
const requireAuth = (handler) => {
  return async (event, context) => {
    const authResult = await authMiddleware(event);

    if (authResult.statusCode) {
      return authResult;
    }

    // Add userId to event for handler use
    event.userId = authResult.userId;
    return handler(event, context);
  };
};

module.exports = {
  verifyAuthToken,
  authMiddleware,
  requireAuth,
};
