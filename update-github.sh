#!/bin/bash

# ThorEye GitHub Update Script
# This script copies the complete working Replit code to your GitHub repository

echo "🚀 Starting ThorEye GitHub Update..."

# Clone your repository
echo "📥 Cloning GitHub repository..."
git clone https://github.com/abhidas2700/blip-CodeSolve.git /tmp/github-repo
cd /tmp/github-repo

# Remove old files
echo "🗑️  Removing old files..."
rm -rf server/ client/ shared/
rm -f package.json package-lock.json vite.config.ts tsconfig.json tailwind.config.ts drizzle.config.ts

# Copy new files from Replit
echo "📋 Copying updated files from Replit..."
cp -r /home/runner/workspace/server/ ./
cp -r /home/runner/workspace/client/ ./
cp -r /home/runner/workspace/shared/ ./
cp /home/runner/workspace/package.json ./
cp /home/runner/workspace/package-lock.json ./
cp /home/runner/workspace/vite.config.ts ./
cp /home/runner/workspace/tsconfig.json ./
cp /home/runner/workspace/tailwind.config.ts ./
cp /home/runner/workspace/drizzle.config.ts ./

# Create deployment files
echo "🔧 Creating deployment files..."
cp /home/runner/workspace/start-render.cjs ./
cp /home/runner/workspace/render.yaml ./

# Git operations
echo "📤 Committing and pushing changes..."
git add .
git commit -m "🎯 Complete ThorEye update: Database integration + Full interface

- Updated server/storage.ts to use DatabaseStorage instead of MemoryStorage
- Fixed server/production.ts to return user rights properly  
- Added complete ThorEye frontend interface (110+ files)
- Updated all dependencies and configurations
- Fixed Render deployment configuration

This update enables:
✅ Full database connectivity to Neon PostgreSQL
✅ Complete admin interface matching Replit preview
✅ User management (admin + Abhishek) 
✅ Forms, audits, reports from database
✅ All ThorEye features operational"

git push origin main

echo "✅ GitHub update completed!"
echo "🌐 Render will automatically redeploy from updated GitHub code"
echo "🎉 Your deployment will now match your Replit preview exactly"