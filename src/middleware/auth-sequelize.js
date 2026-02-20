/**
 * Authentication Middleware - Sequelize Version
 * Decodes Firebase JWT tokens to extract user information
 * TODO: Add Firebase Admin SDK verification in production
 */

const jwt = require('jsonwebtoken');

/**
 * Verify authentication token
 * Returns { authenticated: true, userId: 'user-id', email: 'user@email.com' } on success
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
    console.log(`[AUTH] Decoding Firebase JWT token...`);

    // Decode Firebase JWT token (without verification for dev environment)
    // In production, use Firebase Admin SDK to verify the token signature
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.user_id) {
      console.warn(`[AUTH] ❌ Invalid token format or missing user_id`);
      return {
        authenticated: false,
        message: 'Invalid token format',
      };
    }

    console.log(`[AUTH] ✅ Token decoded. User ID: ${decoded.user_id}`);
    console.log(`[AUTH] Email: ${decoded.email || 'N/A'}`);
    
    return {
      authenticated: true,
      userId: decoded.user_id,
      email: decoded.email,
      name: decoded.name,
    };
  } catch (error) {
    console.error('[AUTH] ❌ Error decoding token:', error);
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
