/**
 * Database configuration for Netlify serverless functions
 * This file provides configuration for PostgreSQL database connections
 */

// Read environment variables
const DATABASE_URL = process.env.DATABASE_URL;

// Configuration object
module.exports = {
  // Database connection string
  DATABASE_URL: DATABASE_URL,
  
  // SSL configuration for secure connections
  ssl: DATABASE_URL && DATABASE_URL.includes('ssl=') 
    ? undefined 
    : { rejectUnauthorized: false },
  
  // Additional pool configuration for PostgreSQL client
  pool: {
    max: 10,                       // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,      // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 5000, // How long to wait when trying to connect
  }
};
