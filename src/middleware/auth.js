/**
 * Authentication Middleware
 * Validates tokens from Authorization header
 */

const { query } = require('../db/mysql');

const authMiddleware = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token in database
    const results = await query(
      `SELECT userId FROM tokens 
       WHERE token = ? AND expiresAt > NOW()`,
      [token]
    );

    if (results.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    return {
      authenticated: true,
      userId: results[0].userId,
    };
  } catch (error) {
    console.error('❌ Auth error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Authentication error' }),
    };
  }
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
  authMiddleware,
  requireAuth,
};
