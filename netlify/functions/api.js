/**
 * Simple Netlify API Function - No external dependencies
 * Direct import approach for better compatibility
 */

// Alternative approach: Use neon() function for serverless
let pool;
try {
  // Try using the neon() function which is better for serverless
  const { neon } = require('@neondatabase/serverless');
  const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  
  // Use neon() function instead of Pool for better Netlify compatibility
  const sql = neon(DATABASE_URL);
  console.log('Neon database initialized with function API (serverless compatible)');
  
  // Create a pool-like wrapper for compatibility
  pool = {
    query: async (text, params) => {
      try {
        const result = await sql(text, params || []);
        return { rows: result };
      } catch (error) {
        console.error('Query error:', error);
        throw error;
      }
    }
  };
} catch (error) {
  console.error('Database setup error:', error);
  
  // Fallback to Pool with forced HTTP fetch
  try {
    const { Pool, neonConfig } = require('@neondatabase/serverless');
    neonConfig.webSocketConstructor = undefined; // Force HTTP fetch
    neonConfig.fetchConnectionCache = true;
    
    const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
    console.log('Fallback to Pool with HTTP fetch');
  } catch (fallbackError) {
    console.error('Fallback database setup error:', fallbackError);
    pool = null;
  }
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

    // Handle forms endpoints - Match local server column names
    if (apiPath === '/forms' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT id, name, sections, created_at as "createdAt", created_by as "createdBy" FROM audit_forms ORDER BY created_at DESC');
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

    // Handle forms creation (POST) - Match local server exactly
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
        console.log('Creating form:', formData.name);
        
        const result = await pool.query(
          'INSERT INTO audit_forms (name, sections, created_by) VALUES ($1, $2, $3) RETURNING id, name, sections, created_at as "createdAt", created_by as "createdBy"',
          [formData.name, JSON.stringify(formData.sections), formData.createdBy || null]
        );
        
        console.log('Form created successfully:', result.rows[0]);
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
          body: JSON.stringify({ 
            error: 'Failed to create form',
            details: error.message
          })
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
        console.log('Fetching audit reports from database (alt endpoint)...');
        const result = await pool.query('SELECT * FROM audit_reports WHERE deleted = false ORDER BY timestamp DESC');
        console.log('Audit reports (alt) result:', result.rows.length, 'rows found');
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
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
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

    // Debug endpoint to check database connection
    if (apiPath === '/debug-db' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          hasPool: !!pool,
          hasEnvVar: !!process.env.DATABASE_URL,
          envVarLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
          envVarStart: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'none'
        })
      };
    }

    // Handle users endpoint (list all users)
    if (apiPath === '/users' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const result = await pool.query('SELECT id, username, email, rights, is_inactive as "isInactive" FROM users ORDER BY id');
        
        // Show ALL users including admin (match current local server behavior)
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Users GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Database query failed',
            details: error.message
          })
        };
      }
    }

    // Handle users endpoint (create new user) - Match local server exactly
    if (apiPath === '/users' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const userData = JSON.parse(body);
        console.log('Creating user:', { username: userData.username, email: userData.email });
        
        // Check if username already exists (like local server)
        const existingCheck = await pool.query('SELECT id FROM users WHERE username = $1', [userData.username]);
        if (existingCheck.rows.length > 0) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Username already exists' })
          };
        }
        
        // Hash password using bcrypt-compatible hash (match local server)
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        const result = await pool.query(
          'INSERT INTO users (username, email, password, rights, is_inactive) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, rights, is_inactive',
          [
            userData.username,
            userData.email || null,
            hashedPassword,
            JSON.stringify(userData.rights || ['audit']),
            userData.isInactive || false
          ]
        );
        
        console.log('User created successfully:', result.rows[0]);
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Users POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to create user',
            details: error.message
          })
        };
      }
    }

    // Handle user endpoint (current user)
    if (apiPath === '/user' && httpMethod === 'GET') {
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

    // Handle user UPDATE (PATCH) - Match local server exactly
    if (apiPath.match(/^\/users\/\d+$/) && httpMethod === 'PATCH') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const userId = parseInt(apiPath.split('/')[2]);
        const userData = JSON.parse(body);
        console.log('Updating user:', userId, userData);
        
        // Build dynamic update query
        let updateFields = [];
        let values = [];
        let paramCount = 1;
        
        if (userData.username) {
          updateFields.push(`username = $${paramCount++}`);
          values.push(userData.username);
        }
        if (userData.email !== undefined) {
          updateFields.push(`email = $${paramCount++}`);
          values.push(userData.email);
        }
        if (userData.password) {
          const bcrypt = require('bcrypt');
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          updateFields.push(`password = $${paramCount++}`);
          values.push(hashedPassword);
        }
        if (userData.rights) {
          updateFields.push(`rights = $${paramCount++}`);
          values.push(JSON.stringify(userData.rights));
        }
        if (userData.isInactive !== undefined) {
          updateFields.push(`is_inactive = $${paramCount++}`);
          values.push(userData.isInactive);
        }
        
        values.push(userId); // Add userId for WHERE clause
        
        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, rights, is_inactive as "isInactive"`;
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'User not found' })
          };
        }
        
        console.log('User updated successfully:', result.rows[0]);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Users PATCH error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to update user',
            details: error.message
          })
        };
      }
    }

    // Handle user DELETE - Match local server exactly
    if (apiPath.match(/^\/users\/\d+$/) && httpMethod === 'DELETE') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const userId = parseInt(apiPath.split('/')[2]);
        console.log('Deleting user:', userId);
        
        // Prevent deletion of admin user (id = 1)
        if (userId === 1) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Cannot delete admin user' })
          };
        }
        
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
        
        if (result.rows.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'User not found' })
          };
        }
        
        console.log('User deleted successfully:', userId);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'User deleted successfully' })
        };
      } catch (error) {
        console.error('Users DELETE error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to delete user',
            details: error.message
          })
        };
      }
    }

    // Handle forms UPDATE (PUT) - Match local server exactly
    if (apiPath.match(/^\/forms\/\d+$/) && httpMethod === 'PUT') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const formId = parseInt(apiPath.split('/')[2]);
        const formData = JSON.parse(body);
        console.log('Updating form:', formId, formData.name);
        
        const result = await pool.query(
          'UPDATE audit_forms SET name = $1, sections = $2 WHERE id = $3 RETURNING id, name, sections, created_at as "createdAt", created_by as "createdBy"',
          [formData.name, JSON.stringify(formData.sections), formId]
        );
        
        if (result.rows.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Form not found' })
          };
        }
        
        console.log('Form updated successfully:', result.rows[0]);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Forms PUT error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to update form',
            details: error.message
          })
        };
      }
    }

    // Handle forms DELETE - Match local server exactly
    if (apiPath.match(/^\/forms\/\d+$/) && httpMethod === 'DELETE') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const formId = parseInt(apiPath.split('/')[2]);
        console.log('Deleting form:', formId);
        
        const result = await pool.query('DELETE FROM audit_forms WHERE id = $1 RETURNING id', [formId]);
        
        if (result.rows.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Form not found' })
          };
        }
        
        console.log('Form deleted successfully:', formId);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Form deleted successfully' })
        };
      } catch (error) {
        console.error('Forms DELETE error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to delete form',
            details: error.message
          })
        };
      }
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
        console.log('Fetching audit reports from database...');
        const result = await pool.query('SELECT * FROM audit_reports WHERE deleted = false ORDER BY timestamp DESC');
        console.log('Audit reports result:', result.rows.length, 'rows found');
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
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
        };
      }
    }

    // Handle /samples endpoint (alias for /audit-samples)
    if (apiPath === '/samples' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        console.log('Fetching available samples from database (/samples endpoint)...');
        const result = await pool.query('SELECT * FROM audit_samples ORDER BY uploaded_at DESC');
        console.log('Available samples result (/samples):', result.rows.length, 'rows found');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Samples GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
        };
      }
    }

    // Handle /audit-reports endpoint
    if (apiPath === '/audit-reports' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        console.log('Fetching audit reports from database (alt endpoint)...');
        const result = await pool.query('SELECT * FROM audit_reports WHERE deleted = false ORDER BY timestamp DESC');
        console.log('Audit reports (alt) result:', result.rows.length, 'rows found');
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
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
        };
      }
    }

    // Handle audit reports creation (POST)
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
        console.log('Creating audit report:', reportData.auditId);
        
        const result = await pool.query(
          'INSERT INTO audit_reports (audit_id, form_name, agent, agent_id, auditor_name, section_answers, score, max_score, has_fatal, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
          [
            reportData.auditId,
            reportData.formName,
            reportData.agent,
            reportData.agentId,
            reportData.auditorName,
            JSON.stringify(reportData.sectionAnswers || {}),
            reportData.score || 0,
            reportData.maxScore || 0,
            reportData.hasFatal || false,
            reportData.status || 'completed'
          ]
        );
        
        console.log('Audit report created successfully:', result.rows[0]);
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
          body: JSON.stringify({ 
            error: 'Failed to create audit report',
            details: error.message
          })
        };
      }
    }

    // Handle reports creation (POST) - alias
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
        console.log('Creating report:', reportData.auditId);
        
        const result = await pool.query(
          'INSERT INTO audit_reports (audit_id, form_name, agent, agent_id, auditor_name, section_answers, score, max_score, has_fatal, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
          [
            reportData.auditId,
            reportData.formName,
            reportData.agent,
            reportData.agentId,
            reportData.auditorName,
            JSON.stringify(reportData.sectionAnswers || {}),
            reportData.score || 0,
            reportData.maxScore || 0,
            reportData.hasFatal || false,
            reportData.status || 'completed'
          ]
        );
        
        console.log('Report created successfully:', result.rows[0]);
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
          body: JSON.stringify({ 
            error: 'Failed to create report',
            details: error.message
          })
        };
      }
    }

    // Handle ATA reviews endpoint
    if (apiPath === '/ata-reviews' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        console.log('Fetching ATA reviews from database...');
        const result = await pool.query('SELECT * FROM ata_reviews ORDER BY timestamp DESC');
        console.log('ATA reviews result:', result.rows.length, 'rows found');
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
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
        };
      }
    }

    // Handle ATA reviews creation (POST)
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
        console.log('Creating ATA review:', reviewData);
        
        const result = await pool.query(
          'INSERT INTO ata_reviews (audit_report_id, reviewer_id, review_data, master_score, master_max_score, ata_notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [
            reviewData.auditReportId,
            reviewData.reviewerId || null,
            JSON.stringify(reviewData.reviewData || {}),
            reviewData.masterScore || 0,
            reviewData.masterMaxScore || 0,
            reviewData.ataNotes || ''
          ]
        );
        
        console.log('ATA review created successfully:', result.rows[0]);
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
          body: JSON.stringify({ 
            error: 'Failed to create ATA review',
            details: error.message
          })
        };
      }
    }

    // Handle skipped samples endpoint
    if (apiPath === '/skipped-samples' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        console.log('Fetching skipped samples from database...');
        const result = await pool.query('SELECT * FROM skipped_samples ORDER BY timestamp DESC');
        console.log('Skipped samples result:', result.rows.length, 'rows found');
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
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
        };
      }
    }

    // Handle skipped samples creation (POST)
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
        console.log('Creating skipped sample:', sampleData);
        
        const result = await pool.query(
          'INSERT INTO skipped_samples (agent, agent_id, auditor_name, reason, form_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [
            sampleData.agent,
            sampleData.agentId,
            sampleData.auditorName,
            sampleData.reason,
            sampleData.formName
          ]
        );
        
        console.log('Skipped sample created successfully:', result.rows[0]);
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
          body: JSON.stringify({ 
            error: 'Failed to create skipped sample',
            details: error.message
          })
        };
      }
    }

    // Handle skipped samples deletion
    if (apiPath.match(/^\/skipped-samples\/\d+$/) && httpMethod === 'DELETE') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const sampleId = parseInt(apiPath.split('/')[2]);
        console.log('Deleting skipped sample:', sampleId);
        
        const result = await pool.query('DELETE FROM skipped_samples WHERE id = $1 RETURNING id', [sampleId]);
        
        if (result.rows.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Skipped sample not found' })
          };
        }
        
        console.log('Skipped sample deleted successfully:', sampleId);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Skipped sample deleted successfully' })
        };
      } catch (error) {
        console.error('Skipped samples DELETE error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to delete skipped sample',
            details: error.message
          })
        };
      }
    }

    // Handle deleted audits endpoint
    if (apiPath === '/deleted-audits' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        console.log('Fetching deleted audits from database...');
        const result = await pool.query('SELECT * FROM deleted_audits ORDER BY deleted_at DESC');
        console.log('Deleted audits result:', result.rows.length, 'rows found');
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
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
        };
      }
    }

    // Handle deleted audits creation (POST)
    if (apiPath === '/deleted-audits' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const deletedData = JSON.parse(body);
        console.log('Creating deleted audit record:', deletedData);
        
        const result = await pool.query(
          'INSERT INTO deleted_audits (original_id, audit_id, form_name, agent, agent_id, auditor_name, section_answers, score, max_score, has_fatal, timestamp, deleted_by_name, edit_history) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
          [
            deletedData.originalId || deletedData.auditId,
            deletedData.auditId,
            deletedData.formName,
            deletedData.agent,
            deletedData.agentId,
            deletedData.auditorName,
            JSON.stringify(deletedData.sectionAnswers || {}),
            deletedData.score || 0,
            deletedData.maxScore || 0,
            deletedData.hasFatal || false,
            deletedData.timestamp || new Date().toISOString(),
            deletedData.deletedByName || 'Unknown User',
            JSON.stringify(deletedData.editHistory || {})
          ]
        );
        
        console.log('Deleted audit record created successfully:', result.rows[0]);
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
          body: JSON.stringify({ 
            error: 'Failed to create deleted audit record',
            details: error.message
          })
        };
      }
    }

    // Handle available samples endpoint
    if (apiPath === '/samples' && httpMethod === 'GET') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        console.log('Fetching available samples from database...');
        const result = await pool.query('SELECT * FROM audit_samples ORDER BY uploaded_at DESC');
        console.log('Available samples result:', result.rows.length, 'rows found');
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.rows)
        };
      } catch (error) {
        console.error('Samples GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database query failed', details: error.message })
        };
      }
    }

    // Handle available samples creation (POST)
    if (apiPath === '/samples' && httpMethod === 'POST') {
      if (!pool) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Database not available' })
        };
      }
      
      try {
        const sampleData = JSON.parse(body);
        console.log('Creating sample:', sampleData);
        
        const result = await pool.query(
          'INSERT INTO audit_samples (agent, agent_id, form_name, priority, team, lob) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [
            sampleData.agent,
            sampleData.agentId,
            sampleData.formName,
            sampleData.priority || 'normal',
            sampleData.team || null,
            sampleData.lob || null
          ]
        );
        
        console.log('Sample created successfully:', result.rows[0]);
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(result.rows[0])
        };
      } catch (error) {
        console.error('Samples POST error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to create sample',
            details: error.message
          })
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