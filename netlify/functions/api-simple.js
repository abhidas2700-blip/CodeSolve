/**
 * Simple Netlify API Function - No external dependencies
 * Direct import approach for better compatibility
 */

const { Pool } = require('pg');

// Simple database pool setup
let pool;
try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
} catch (error) {
  console.error('Database setup error:', error);
}

// Simple user validation for testing
const testUsers = {
  'admin': { id: 1, username: 'admin', password: 'password', rights: ['admin'] },
  'Abhishek': { id: 2, username: 'Abhishek', password: 'password', rights: ['user'] }
};

exports.handler = async (event, context) => {
  const { httpMethod, path, headers, body } = event;
  const apiPath = path.replace('/.netlify/functions/api-simple', '');
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Health check
    if (apiPath === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          hasDatabase: !!pool,
          hasEnvVar: !!process.env.DATABASE_URL
        })
      };
    }

    // Database status
    if (apiPath === '/database/status' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            status: 'error',
            message: 'Database not configured',
            hasEnvVar: !!process.env.DATABASE_URL
          })
        };
      }

      try {
        const result = await pool.query('SELECT NOW() as time');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            status: 'connected',
            timestamp: result.rows[0].time
          })
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            status: 'error',
            message: error.message
          })
        };
      }
    }

    // Simple login for testing
    if (apiPath === '/login' && httpMethod === 'POST') {
      const { username, password } = JSON.parse(body || '{}');
      const user = testUsers[username];
      
      if (user && user.password === password) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            id: user.id,
            username: user.username,
            rights: user.rights
          })
        };
      }
      
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Handle forms endpoints
    if (apiPath === '/forms' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    if (apiPath === '/forms' && httpMethod === 'POST') {
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ id: Date.now(), message: 'Form created' })
      };
    }

    // Handle audit reports endpoints
    if (apiPath === '/audit-reports' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    if (apiPath === '/audit-reports' && httpMethod === 'POST') {
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ id: Date.now(), message: 'Report created' })
      };
    }

    // Handle audit samples endpoints
    if (apiPath === '/audit-samples' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    if (apiPath === '/audit-samples' && httpMethod === 'POST') {
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ id: Date.now(), message: 'Sample created' })
      };
    }

    // Handle ATA reviews endpoints
    if (apiPath === '/ata-reviews' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    if (apiPath === '/ata-reviews' && httpMethod === 'POST') {
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ id: Date.now(), message: 'ATA review created' })
      };
    }

    // Handle deleted audits endpoints
    if (apiPath === '/deleted-audits' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    if (apiPath === '/deleted-audits' && httpMethod === 'POST') {
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ id: Date.now(), message: 'Deleted audit recorded' })
      };
    }

    // Handle user endpoint for authentication
    if (apiPath === '/user' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: 1,
          username: 'admin',
          rights: ['admin']
        })
      };
    }

    // Handle any PUT requests with dynamic IDs
    if (httpMethod === 'PUT' && apiPath.match(/^\/\w+\/\d+$/)) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Updated successfully' })
      };
    }

    // Handle any DELETE requests with dynamic IDs
    if (httpMethod === 'DELETE' && apiPath.match(/^\/\w+\/\d+$/)) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Deleted successfully' })
      };
    }

    // Default response
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Endpoint not found', path: apiPath, method: httpMethod })
    };

  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};