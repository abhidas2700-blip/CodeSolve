#!/bin/bash

# Simplified build script to prepare files for Netlify manual upload
set -e

# Log all steps for easier debugging
log() {
  echo -e "\033[0;36m[Build] $1\033[0m"
}

log "Preparing files for Netlify manual upload..."

# Create netlify folder structure
log "Creating netlify folder structure..."
mkdir -p netlify_package/functions

# Copy serverless functions
log "Copying serverless functions..."
cp -r netlify/functions/* netlify_package/functions/

# Copy netlify.toml
log "Copying netlify.toml file..."
cp netlify.toml netlify_package/

# Create a minimal package.json for the functions
log "Creating package.json for functions..."
cat > netlify_package/package.json << 'EOF'
{
  "name": "thoreye-audit-system",
  "version": "1.0.0",
  "description": "ThorEye Audit System deployed to Netlify",
  "main": "index.js",
  "scripts": {
    "build": "echo \"No build step needed for direct upload\""
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "express": "^4.18.2",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "pg": "^8.11.3",
    "memorystore": "^1.6.7",
    "express-session": "^1.17.3",
    "serverless-http": "^3.2.0",
    "discord.js": "^14.14.1",
    "sqlite3": "^5.1.7"
  }
}
EOF

# Create a Readme with instructions
log "Creating README with instructions..."
cat > netlify_package/README.md << 'EOF'
# ThorEye Audit System - Netlify Deployment Package

This package contains the necessary files for deploying the ThorEye Audit System to Netlify via direct upload.

## Deployment Instructions

1. Upload this entire folder to Netlify via the "Deploy manually" option
2. Set the following environment variables in Netlify:
   - DATABASE_URL: Your PostgreSQL connection string
   - JWT_SECRET: A secure random string for session encryption
   - NODE_ENV: Set to "production"

## Additional Notes

- The serverless functions will automatically connect to your PostgreSQL database using the DATABASE_URL environment variable
- Make sure your database has the correct schema by running the migrations on your local development environment first
- For optimal performance, consider using a database service that provides low-latency connections to Netlify (e.g., Neon, Supabase, etc.)

## Troubleshooting

If you encounter any issues with the deployment, check the following:

1. Verify that the environment variables are correctly set in Netlify
2. Check the Netlify function logs for any errors
3. Ensure your database is accessible from Netlify's serverless functions
EOF

log "Preparation completed successfully!"
log "Files are ready in the 'netlify_package' directory."
log "Upload the entire 'netlify_package' directory to Netlify using the 'Deploy manually' option."
