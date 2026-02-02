/**
 * Authentication Middleware
 * Handles Firebase token-based authentication using idToken
 */

const crypto = require('crypto');

/**
 * Generate a simple token for a user (kept for backward compatibility)
 * Token format: base64(userId:timestamp:signature)
 */
const generateToken = (userId) => {
  const timestamp = Date.now();
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  
  // Create signature
  const data = `${userId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  // Combine into token
  const token = Buffer.from(`${data}:${signature}`).toString('base64');
  return token;
};

/**
 * Simple token verification (kept for backward compatibility)
 */
const verifyToken = (token) => {
  try {
    console.log(`   \n   📋 TOKEN DECODE & VERIFY`);
    console.log(`      Raw token: "${token.substring(0, 30)}..."`);
    
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    // Decode token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    console.log(`      Decoded: "${decoded}"`);
    
    const [userId, timestamp, signature] = decoded.split(':');
    console.log(`      Parts extracted:`);
    console.log(`         - userId: "${userId}"`);
    console.log(`         - timestamp: "${timestamp}"`);
    console.log(`         - signature: "${signature.substring(0, 16)}..."`);
    
    if (!userId || !timestamp || !signature) {
      console.log(`      ❌ Invalid token format (missing parts)`);
      return { valid: false, error: 'Invalid token format' };
    }
    
    // Verify signature
    const data = `${userId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    
    console.log(`      Signature verification:`);
    console.log(`         Expected: "${expectedSignature.substring(0, 16)}..."`);
    console.log(`         Got:      "${signature.substring(0, 16)}..."`);
    
    if (signature !== expectedSignature) {
      console.log(`         ❌ MISMATCH - Token tampered or wrong secret`);
      return { valid: false, error: 'Token signature invalid' };
    }
    
    console.log(`         ✅ MATCH - Token is authentic`);
    
    return {
      valid: true,
      userId,
      timestamp: parseInt(timestamp),
    };
  } catch (error) {
    console.error(`      ❌ Token verification error:`, error.message);
    return { valid: false, error: 'Token verification failed' };
  }
};

/**
 * Extract user info from Firebase idToken
 * Firebase idTokens are JWTs with format: header.payload.signature
 */
const extractUserFromToken = (token) => {
  try {
    console.log(`   📋 FIREBASE TOKEN EXTRACTION`);
    console.log(`      Token preview: "${token.substring(0, 50)}..."`);
    
    // Firebase tokens are JWTs: header.payload.signature
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      console.log(`      ⚠️  Token is not a valid JWT (expected 3 parts, got ${parts.length})`);
      return { valid: false, error: 'Invalid token format - not a JWT' };
    }
    
    console.log(`      ✅ Valid JWT format detected (3 parts)`);
    
    // Decode the payload (2nd part)
    // JWT payloads use base64url encoding, need to add padding
    const payload = parts[1];
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    
    let decodedPayload;
    try {
      decodedPayload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf-8'));
    } catch (e) {
      console.log(`      ❌ Failed to decode JWT payload:`, e.message);
      return { valid: false, error: 'Failed to decode token payload' };
    }
    
    console.log(`      📦 Decoded JWT Payload:`);
    console.log(`         - sub (uid): "${decodedPayload.sub}"`);
    console.log(`         - email: "${decodedPayload.email}"`);
    console.log(`         - name: "${decodedPayload.name}"`);
    console.log(`         - iat: ${decodedPayload.iat} (${new Date(decodedPayload.iat * 1000).toISOString()})`);
    console.log(`         - exp: ${decodedPayload.exp} (${new Date(decodedPayload.exp * 1000).toISOString()})`);
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp && decodedPayload.exp < now) {
      console.log(`      ❌ Token has expired`);
      return { valid: false, error: 'Token has expired' };
    }
    
    // Extract user info
    const userId = decodedPayload.sub; // Firebase UID
    const email = decodedPayload.email;
    const name = decodedPayload.name;
    
    if (!userId || !email) {
      console.log(`      ❌ Missing required user fields (uid or email)`);
      return { valid: false, error: 'Missing uid or email in token' };
    }
    
    console.log(`      ✅ User extracted successfully`);
    
    return {
      valid: true,
      userId: userId,
      email: email,
      name: name,
      firebaseUid: userId,
    };
  } catch (error) {
    console.error(`      ❌ Token extraction error:`, error.message);
    return { valid: false, error: 'Failed to extract user from token' };
  }
};

/**
 * Express middleware to authenticate using Firebase idToken
 * Expected header: Authorization: Bearer <firebase-idToken>
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔐 AUTH MIDDLEWARE - Firebase Token Verification`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   Authorization header received: ${authHeader ? 'YES' : 'NO'}`);
    
    if (!authHeader) {
      console.log(`   ❌ Missing Authorization header`);
      console.log(`${'='.repeat(80)}\n`);
      return res.status(401).json({
        error: 'Missing Authorization header',
        hint: 'Use: Authorization: Bearer <idToken>',
      });
    }
    
    console.log(`   Header value: "${authHeader.substring(0, 80)}..."`);
    console.log(`   Full header length: ${authHeader.length} characters`);
    
    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');
    console.log(`   \n   Split header into parts: ${parts.length}`);
    console.log(`      [0] "${parts[0]}"`);
    console.log(`      [1] "${parts[1] ? parts[1].substring(0, 50) + '...' : 'undefined'}"`);
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log(`   ❌ Invalid header format (expected 2 parts with 'Bearer' prefix)`);
      console.log(`${'='.repeat(80)}\n`);
      return res.status(401).json({
        error: 'Invalid Authorization header format',
        hint: 'Use: Authorization: Bearer <idToken>',
      });
    }
    
    const token = parts[1];
    console.log(`   ✅ Bearer token extracted successfully`);
    console.log(`   \n   📍 FULL TOKEN (for debugging):`);
    console.log(`      ${token}`);
    console.log(`   \n   Token length: ${token.length} characters`);
    
    // Extract user from Firebase token
    const userExtraction = extractUserFromToken(token);
    console.log(`   \n   User extraction result: ${userExtraction.valid ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (!userExtraction.valid) {
      console.log(`   Error detail: ${userExtraction.error}`);
      console.log(`${'='.repeat(80)}\n`);
      return res.status(401).json({
        error: 'Invalid or malformed token',
        detail: userExtraction.error,
      });
    }
    
    console.log(`   \n   ✅ User extracted from token:`);
    console.log(`      - userId (Firebase UID): ${userExtraction.userId}`);
    console.log(`      - email: ${userExtraction.email}`);
    console.log(`      - name: ${userExtraction.name}`);
    
    // Attach user info to request
    req.user = {
      userId: userExtraction.userId,
      email: userExtraction.email,
      firebaseUid: userExtraction.firebaseUid,
    };
    
    console.log(`   \n   ✅ User attached to request object`);
    console.log(`   Ready to proceed to route handler`);
    console.log(`${'='.repeat(80)}\n`);
    next();
  } catch (error) {
    console.error(`\n❌ Auth middleware error:`, error.message);
    console.error('   Full error:', error);
    console.log(`${'='.repeat(80)}\n`);
    res.status(500).json({ error: 'Authentication error' });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  extractUserFromToken,
  authMiddleware,
};
