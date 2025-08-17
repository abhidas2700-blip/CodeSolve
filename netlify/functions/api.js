/**
 * Netlify Serverless API Function
 * Handles all API requests for the ThorEye Audit System
 */

// Import with proper error handling
let express, serverless, session, passport, LocalStrategy, MemoryStore, Pool, dbConfig;

try {
  express = require('express');
  serverless = require('serverless-http');
  session = require('express-session');
  passport = require('passport');
  LocalStrategy = require('passport-local').Strategy;
  MemoryStore = require('memorystore')(session);
  Pool = require('pg').Pool;
  dbConfig = require('./db-config');
} catch (error) {
  console.error('Failed to load dependencies:', error);
  // Export a basic error handler if dependencies fail
  module.exports.handler = async (event, context) => {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Server configuration error',
        message: 'Failed to load required dependencies'
      })
    };
  };
  return;
}

// Create Express app
const app = express();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database connection with error handling
let pool;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  
  console.log('Database pool initialized successfully');
} catch (error) {
  console.error('Database initialization error:', error);
  pool = null;
}

// Setup session management
app.use(session({
  cookie: { maxAge: 86400000 }, // 24 hours
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  resave: false,
  saveUninitialized: false,
  secret: process.env.JWT_SECRET || 'development-secret-key'
}));

// Initialize Passport.js for authentication
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport Local strategy
passport.use(new LocalStrategy(
  async function(username, password, done) {
    try {
      // Find user in database
      const userResult = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      if (userResult.rows.length === 0) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      
      const user = userResult.rows[0];
      
      // Compare password (in a real app, use bcrypt.compare)
      // For demo purposes, we're using a simple comparison
      if (password !== user.password) { 
        return done(null, false, { message: 'Incorrect password.' });
      }
      
      // Check if user is inactive
      if (user.isInactive) {
        return done(null, false, { message: 'Account is inactive.' });
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return done(null, false);
    }
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

// Authentication check middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

// Admin rights check middleware
function hasAdminRights(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (req.user.rights && Array.isArray(req.user.rights) && req.user.rights.includes('admin')) {
    return next();
  }
  
  res.status(403).json({ error: 'Insufficient permissions' });
}

// API health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasDatabase: !!pool,
    hasEnvVar: !!process.env.DATABASE_URL 
  });
});

// Authentication routes
app.post('/api/login', passport.authenticate('local'), (req, res) => {
  // Update last login timestamp (only if pool is available)
  if (pool) {
    pool.query(
      'UPDATE users SET lastLogin = NOW() WHERE id = $1',
      [req.user.id]
    ).catch(err => console.error('Error updating last login:', err));
  }
  
  // Return user info (except password)
  const { password, ...userInfo } = req.user;
  res.json(userInfo);
});

app.post('/api/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return res.status(500).json({ error: err.message }); }
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    const { password, ...userInfo } = req.user;
    return res.json(userInfo);
  }
  res.status(401).json({ error: 'Not authenticated' });
});

// Database status check  
app.get('/api/database/status', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({
        status: 'error',
        message: 'Database pool not initialized',
        hasEnvVar: !!process.env.DATABASE_URL
      });
    }
    
    const result = await pool.query('SELECT NOW() as time');
    res.json({
      status: 'connected',
      timestamp: result.rows[0].time,
      hasEnvVar: !!process.env.DATABASE_URL
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      hasEnvVar: !!process.env.DATABASE_URL
    });
  }
});

// Version info endpoint
app.get('/api/version', (req, res) => {
  res.json({
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    deployedAt: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Export the serverless function handler
module.exports.handler = serverless(app);
