/**
 * AWS Lambda Handler Entry Point
 * Main handler called by API Gateway
 */

const router = require('./handlers/router');
const { initializeDatabase } = require('./db/mysql');

// Initialize database on cold start
let dbInitialized = false;

const handler = async (event, context) => {
  try {
    // Initialize database on first invocation
    if (!dbInitialized) {
      await initializeDatabase();
      dbInitialized = true;
    }

    // Keep Lambda warm (X-Ray cold start optimization)
    context.callbackWaitsForEmptyEventLoop = false;

    // Route request to appropriate handler
    return await router(event, context);
  } catch (error) {
    console.error('❌ Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

module.exports = { handler };
