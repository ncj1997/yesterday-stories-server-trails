/**
 * HTTP Response Utilities
 * Standardized response formatting for Lambda handlers
 */

const httpResponse = {
  success: (data, statusCode = 200) => {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: JSON.stringify(data),
    };
  },

  error: (message, statusCode = 400) => {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: message }),
    };
  },

  notFound: (message = 'Not found') => {
    return httpResponse.error(message, 404);
  },

  unauthorized: (message = 'Unauthorized') => {
    return httpResponse.error(message, 401);
  },

  serverError: (message = 'Internal server error') => {
    return httpResponse.error(message, 500);
  },
};

const parseBody = (event) => {
  if (!event.body) {
    return {};
  }

  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch (error) {
      console.error('❌ JSON parse error:', error);
      return {};
    }
  }

  return event.body;
};

const getPathParam = (event, paramName) => {
  return event.pathParameters?.[paramName] || null;
};

const getQueryParam = (event, paramName) => {
  return event.queryStringParameters?.[paramName] || null;
};

module.exports = {
  httpResponse,
  parseBody,
  getPathParam,
  getQueryParam,
};
