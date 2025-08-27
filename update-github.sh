#!/bin/bash

echo "🚀 Updating GitHub for Render Database Connection"

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix Render deployment: Connect to Neon database, authentication, and static paths

- Replace MemStorage with DatabaseStorage in production
- Fix authentication JSON responses 
- Fix static file path for frontend
- Add default admin user initialization
- Enable real PostgreSQL database connection"

# Push to GitHub
git push origin main

echo "✅ GitHub updated! Now set DATABASE_URL in Render dashboard:"
echo "postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"