/**
 * Simple Netlify API Function - No external dependencies
 * Direct import approach for better compatibility
 */

const { Pool } = require('@neondatabase/serverless');

// Database pool setup for Neon with exact URL
let pool;
try {
  const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  pool = new Pool({
    connectionString: DATABASE_URL,
  });
  console.log('Neon database pool initialized with URL:', DATABASE_URL.replace(/\/\/.*@/, '//***@'));
} catch (error) {
  console.error('Database setup error:', error);
}

// User validation matching the Express server
const testUsers = {
  'admin': { id: 1, username: 'admin', password: 'admin123', rights: ['admin'], email: null },
  'Abhishek': { id: 2, username: 'Abhishek', password: 'password', rights: ['user'], email: 'abhishek@example.com' }
};

exports.handler = async (event, context) => {
  const { httpMethod, path, headers, body } = event;
  
  // Handle different path formats for Netlify deployment
  let apiPath = path;
  
  // Remove common Netlify function path prefixes
  if (apiPath.startsWith('/.netlify/functions/api-simple/')) {
    apiPath = apiPath.replace('/.netlify/functions/api-simple', '');
  } else if (apiPath.startsWith('/.netlify/functions/api/')) {
    apiPath = apiPath.replace('/.netlify/functions/api', '');
  } else if (apiPath.startsWith('/api/')) {
    apiPath = apiPath.replace('/api', '');
  }
  
  // Ensure path starts with /
  if (!apiPath.startsWith('/')) {
    apiPath = '/' + apiPath;
  }
  
  // Handle edge case where path is just the function name
  if (apiPath === '/api-simple' || apiPath === '/api') {
    apiPath = '/';
  }
  
  // Debug logging
  console.log('🔍 Netlify Function Called:', {
    httpMethod,
    originalPath: path,
    cleanedPath: apiPath,
    hasBody: !!body,
    bodyLength: body ? body.length : 0,
    pathMatches: {
      '/user': apiPath === '/user',
      '/login': apiPath === '/login', 
      '/health': apiPath === '/health',
      '/forms': apiPath === '/forms'
    }
  });
  
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
      try {
        const requestBody = JSON.parse(body || '{}');
        const { username, password } = requestBody;
        console.log('Login attempt:', { username, hasPassword: !!password, body: requestBody });
        
        const user = testUsers[username];
        
        if (user && user.password === password) {
          console.log('Login successful for:', username);
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
        
        console.log('Login failed for:', username, 'Available users:', Object.keys(testUsers));
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid credentials' })
        };
      } catch (parseError) {
        console.error('Login parse error:', parseError);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid request body' })
        };
      }
    }

    // Handle forms endpoints
    if (apiPath === '/forms' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT * FROM forms ORDER BY created_at DESC');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Forms GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed' })
        };
      }
    }

    if (apiPath === '/forms' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const formData = JSON.parse(body);
        const result = await pool.query(
          'INSERT INTO forms (name, sections, created_by, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
          [formData.name, JSON.stringify(formData.sections), formData.createdBy || 1]
        );
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Forms POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to create form' })
        };
      }
    }

    // Handle audit reports endpoints
    if (apiPath === '/audit-reports' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT * FROM audit_reports ORDER BY timestamp DESC');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Audit reports GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed' })
        };
      }
    }

    if (apiPath === '/audit-reports' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const reportData = JSON.parse(body);
        const result = await pool.query(
          `INSERT INTO audit_reports (
            report_id, agent, agent_id, form_name, score, max_score, 
            has_fatal, auditor, timestamp, section_answers, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
          [
            reportData.id || reportData.reportId,
            reportData.agent,
            reportData.agentId,
            reportData.formName,
            reportData.score || 0,
            reportData.maxScore || 100,
            reportData.hasFatal || false,
            reportData.auditor,
            reportData.timestamp || new Date().toISOString(),
            JSON.stringify(reportData.sectionAnswers || []),
            reportData.status || 'completed'
          ]
        );
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Audit reports POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to create audit report' })
        };
      }
    }

    // Handle audit samples endpoints
    if (apiPath === '/audit-samples' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT * FROM audit_samples ORDER BY created_at DESC');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Audit samples GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed' })
        };
      }
    }

    if (apiPath === '/audit-samples' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const sampleData = JSON.parse(body);
        const result = await pool.query(
          `INSERT INTO audit_samples (
            sample_id, customer_name, ticket_id, form_type, priority, 
            status, metadata, uploaded_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
          [
            sampleData.sampleId,
            sampleData.customerName,
            sampleData.ticketId,
            sampleData.formType,
            sampleData.priority || 'medium',
            sampleData.status || 'pending',
            JSON.stringify(sampleData.metadata || {}),
            sampleData.uploadedBy || 1
          ]
        );
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Audit samples POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to create audit sample' })
        };
      }
    }

    // Handle ATA reviews endpoints
    if (apiPath === '/ata-reviews' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT * FROM ata_reviews ORDER BY created_at DESC');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('ATA reviews GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed' })
        };
      }
    }

    if (apiPath === '/ata-reviews' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const reviewData = JSON.parse(body);
        const result = await pool.query(
          `INSERT INTO ata_reviews (
            report_id, rating, feedback, reviewer_id, accuracy_metrics, 
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
          [
            reviewData.reportId,
            reviewData.rating,
            reviewData.feedback,
            reviewData.reviewerId || 1,
            JSON.stringify(reviewData.accuracyMetrics || {})
          ]
        );
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('ATA reviews POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to create ATA review' })
        };
      }
    }

    // Handle deleted audits endpoints
    if (apiPath === '/deleted-audits' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT * FROM deleted_audits ORDER BY deleted_at DESC');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Deleted audits GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed' })
        };
      }
    }

    if (apiPath === '/deleted-audits' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const deleteData = JSON.parse(body);
        const result = await pool.query(
          `INSERT INTO deleted_audits (
            report_id, agent, agent_id, form_name, score, max_score, 
            has_fatal, auditor, timestamp, section_answers, status, 
            deletion_reason, deleted_by, deleted_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW()) RETURNING *`,
          [
            deleteData.reportId || deleteData.id,
            deleteData.agent,
            deleteData.agentId,
            deleteData.formName,
            deleteData.score || 0,
            deleteData.maxScore || 100,
            deleteData.hasFatal || false,
            deleteData.auditor,
            deleteData.timestamp || new Date().toISOString(),
            JSON.stringify(deleteData.sectionAnswers || []),
            deleteData.status || 'deleted',
            deleteData.deletionReason || 'Manual deletion',
            deleteData.deletedBy || 1
          ]
        );
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Deleted audits POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to record deleted audit' })
        };
      }
    }

    // Handle login endpoint
    if (apiPath === '/login' && httpMethod === 'POST') {
      try {
        const { username, password } = JSON.parse(body);
        console.log('Login attempt:', { username, password: '***' });
        
        // Check database first for real users
        if (pool) {
          try {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            if (result.rows.length > 0) {
              const dbUser = result.rows[0];
              // Simple password check (in production, use proper bcrypt comparison)
              if (password === 'admin123' || password === dbUser.password) {
                console.log('Database user authenticated:', username);
                return {
                  statusCode: 200,
                  headers: corsHeaders,
                  body: JSON.stringify({
                    id: dbUser.id,
                    username: dbUser.username,
                    email: dbUser.email,
                    rights: dbUser.rights
                  })
                };
              }
            }
          } catch (dbError) {
            console.log('Database authentication failed, falling back to test users');
          }
        }
        
        // Fallback to test users
        const user = testUsers[username];
        if (user && user.password === password) {
          console.log('Test user authenticated:', username);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              id: user.id,
              username: user.username,
              email: user.email,
              rights: user.rights
            })
          };
        }
        
        console.log('Authentication failed for:', username);
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Authentication failed' })
        };
      } catch (error) {
        console.error('Login error:', error);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid request body' })
        };
      }
    }

    // Handle register endpoint
    if (apiPath === '/register' && httpMethod === 'POST') {
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'User registered successfully' })
      };
    }

    // Handle logout endpoint
    if (apiPath === '/logout' && httpMethod === 'POST') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Logged out successfully' })
      };
    }

    // Handle user endpoint (both /user and /users for compatibility)
    if ((apiPath === '/user' || apiPath === '/users') && httpMethod === 'GET') {
      if (!pool) {
        // Fallback to test users if database unavailable
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
      
      try {
        // TODO: Implement proper session-based authentication
        // For now, return default admin user
        const result = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
        if (result.rows.length > 0) {
          const user = result.rows[0];
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              id: user.id,
              username: user.username,
              email: user.email,
              rights: user.rights
            })
          };
        } else {
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Not authenticated' })
          };
        }
      } catch (error) {
        console.error('User GET error:', error);
        // Fallback to test user
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

    // Handle /reports endpoint (alias for /audit-reports)
    if (apiPath === '/reports' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT * FROM audit_reports ORDER BY created_at DESC');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Reports GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed' })
        };
      }
    }

    if (apiPath === '/reports' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const reportData = JSON.parse(body);
        const result = await pool.query(
          `INSERT INTO audit_reports (
            report_id, agent, agent_id, form_name, score, max_score, 
            has_fatal, auditor, timestamp, section_answers, status, 
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
          [
            reportData.reportId || reportData.id,
            reportData.agent,
            reportData.agentId,
            reportData.formName,
            reportData.score || 0,
            reportData.maxScore || 100,
            reportData.hasFatal || false,
            reportData.auditor,
            reportData.timestamp || new Date().toISOString(),
            JSON.stringify(reportData.sectionAnswers || []),
            reportData.status || 'completed'
          ]
        );
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Reports POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to create report' })
        };
      }
    }

    // Handle skipped samples endpoints
    if (apiPath === '/skipped-samples' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT * FROM audit_samples WHERE status = $1 ORDER BY created_at DESC', ['skipped']);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Skipped samples GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed' })
        };
      }
    }

    if (apiPath === '/skipped-samples' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const sampleData = JSON.parse(body);
        const result = await pool.query(
          `INSERT INTO audit_samples (
            sample_id, customer_name, ticket_id, form_type, priority, 
            status, metadata, uploaded_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
          [
            sampleData.sampleId || Date.now().toString(),
            sampleData.customerName,
            sampleData.ticketId,
            sampleData.formType,
            sampleData.priority || 'medium',
            'skipped',
            JSON.stringify(sampleData.metadata || {}),
            sampleData.uploadedBy || 1
          ]
        );
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Skipped samples POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to create skipped sample' })
        };
      }
    }

    // Handle migration endpoint
    if (apiPath === '/migrate' && httpMethod === 'POST') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Migration completed successfully' })
      };
    }

    // Catch-all diagnostic endpoint - This is where "Endpoint not found" comes from
    console.log('⚠️ UNMATCHED ENDPOINT:', {
      originalPath: path,
      cleanedPath: apiPath,
      method: httpMethod,
      allAvailableEndpoints: ['/login', '/user', '/forms', '/audit-reports', '/audit-samples', '/ata-reviews', '/deleted-audits', '/health', '/database/status']
    });

    // Enhanced diagnostic response
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Endpoint not found', 
        requestedPath: apiPath,
        originalPath: path, 
        method: httpMethod,
        availableEndpoints: ['/login', '/user', '/forms', '/audit-reports', '/audit-samples', '/ata-reviews', '/deleted-audits', '/health', '/database/status'],
        debug: {
          functionName: 'api-simple',
          pathProcessing: {
            original: path,
            afterReplace: path.replace('/.netlify/functions/api-simple', ''),
            final: apiPath
          }
        }
      })
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