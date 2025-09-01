#!/bin/bash

# Netlify build script for ThorEye Audit System
set -e

# Log all steps for easier debugging
log() {
  echo -e "\033[0;36m[Build] $1\033[0m"
}

log "Starting build process for ThorEye Audit System..."

# Check if dist folder exists and clean it
if [ -d "dist" ]; then
  log "Cleaning up previous build..."
  rm -rf dist
fi

# Install dependencies more efficiently
log "Installing dependencies..."
npm install --no-audit --prefer-offline

# Install serverless function dependencies in a more efficient way
log "Installing serverless function dependencies..."
npm install --no-save --no-audit bcryptjs express passport passport-local pg memorystore express-session serverless-http discord.js sqlite3

# Create dist folder for production build
log "Creating dist folder..."
mkdir -p dist/functions

# Build the frontend
log "Building frontend..."
VITE_BASE_URL="/" npm run build

# Copy serverless functions
log "Copying serverless functions..."
cp -r netlify/functions/* dist/functions/

# Create a .env file if it doesn't exist (for local testing)
if [ ! -f ".env" ]; then
  log "Creating default .env file for local testing..."
  echo "DATABASE_URL=postgres://localhost:5432/thoreye" > .env
  echo "JWT_SECRET=local-development-secret-key" >> .env
fi

# Set execution permissions for functions
log "Setting execution permissions..."
chmod +x dist/functions/*.js

log "Build completed successfully!"
log "To deploy, run 'netlify deploy' or use the Netlify UI."
