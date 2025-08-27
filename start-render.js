#!/usr/bin/env node

// Emergency startup script for Render deployment
// This bypasses any Docker CMD issues and forces production server usage

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 ThorEye Emergency Startup Script');
console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');
console.log('PORT:', process.env.PORT || 'Not set');

// Ensure production environment
process.env.NODE_ENV = 'production';
if (!process.env.PORT) {
  process.env.PORT = '10000';
}

// Check for production server file
const productionPath = path.join(__dirname, 'dist', 'production.js');
const indexPath = path.join(__dirname, 'dist', 'index.js');

let serverFile;
if (fs.existsSync(productionPath)) {
  serverFile = productionPath;
  console.log('✅ Using production server:', serverFile);
} else if (fs.existsSync(indexPath)) {
  console.log('⚠️  Production server not found, falling back to index.js');
  console.log('⚠️  This may cause Vite dependency errors');
  serverFile = indexPath;
} else {
  console.error('❌ No server file found in dist/');
  process.exit(1);
}

// Start the server
console.log('Starting server with:', serverFile);
const server = spawn('node', [serverFile], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('❌ Server startup failed:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.kill('SIGINT');
});