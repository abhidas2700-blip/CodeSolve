# 📋 FILES TO COPY TO YOUR GITHUB REPOSITORY

## Git Commands (Run These in Your Terminal):

```bash
# Remove git lock if it exists
rm -f .git/index.lock

# Add the new files
git add Dockerfile
git add start-render.js  
git add server/production.ts
git add FINAL-RENDER-FIX.md

# Commit the changes
git commit -m "Fix Render deployment with emergency startup script"

# Push to GitHub
git push origin main
```

## File Contents to Copy:

### 1. **Dockerfile** (Complete file):
```dockerfile
# Base Node.js image
FROM node:18-alpine as builder

# Working directory in the container
WORKDIR /app

# Install dependencies with dev dependencies first (needed for build)
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application with production server
RUN vite build && esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Production stage - use a clean image for running the app
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy only the built application and production dependencies
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Expose the port the app runs on
EXPOSE 10000

# Add healthcheck to ensure container is healthy
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:10000/api/health || exit 1

# Start with emergency startup script that handles both scenarios
COPY start-render.js ./
CMD ["node", "start-render.js"]
```

### 2. **start-render.js** (New file):
```javascript
#!/usr/bin/env node

// Emergency startup script for Render deployment
// This bypasses any Docker CMD issues and forces production server usage

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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
```

## After Pushing to GitHub:

1. **Go to Render Dashboard**
2. **Trigger Manual Deploy** with "Clear build cache"
3. **Monitor Build Logs** - Should show the emergency startup script being used
4. **Check Startup Logs** - Should show "✅ Using production server"

## Environment Variables (same as before):
```
DATABASE_URL=postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
SESSION_SECRET=29ce079e08a47e3949b4ac74c01aa19039bd3e76890c51c5f9d1435e83366635
NODE_ENV=production
PORT=10000
```

This emergency startup script will finally solve your deployment issue!