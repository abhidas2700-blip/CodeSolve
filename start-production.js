// Production startup script for Render deployment
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting ThorEye Audit Management System in production mode...');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());
console.log('PORT:', process.env.PORT || 'Not set');
console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');

// Set default PORT if not provided
if (!process.env.PORT) {
  process.env.PORT = '10000';
  console.log('Setting default PORT to 10000');
}

// Ensure NODE_ENV is set to production
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
  console.log('Setting NODE_ENV to production');
}

// Check if built files exist
const fs = require('fs');
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ Built files not found. Please run "npm run build" first.');
  process.exit(1);
}

console.log('✅ Built files found, starting server...');

// Start the application
const server = spawn('node', [indexPath], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.kill('SIGINT');
});