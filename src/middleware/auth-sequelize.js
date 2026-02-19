/**
 * Authentication Middleware - Sequelize Version
 * Validates tokens from Authorization header using Sequelize ORM
 */

const { getModels } = require('../models');
const { Op } = require('sequelize');

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
    const { Token, User } = getModels();
    
    const tokenRecord = await Token.findOne({
      where: {
        token,
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['userId'],
        },
      ],
    });

    if (tokenRecord) {
      console.log(`[AUTH] ✅ Token verified. User ID: ${tokenRecord.user.userId}`);
      return {
        authenticated: true,
        userId: tokenRecord.user.userId,
      };
    }

    // Token not found in database or expired
    console.warn(`[AUTH] ❌ Invalid or expired token`);
    return {
      authenticated: false,
      message: 'Invalid or expired token',
    };
  } catch (error) {
    console.error('[AUTH] ❌ Error verifying token:', error);
    return {
      authenticated: false,
      message: 'Authentication error',
    };
  }
};

/**
 * Middleware wrapper that throws 401 on auth failure
 */
const requireAuth = async (event) => {
  const auth = await verifyAuthToken(event);
  if (!auth.authenticated) {
    throw new Error(auth.message || 'Unauthorized');
  }
  return auth.userId;
};

module.exports = {
  verifyAuthToken,
  requireAuth,
};
