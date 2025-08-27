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

# Start the application with production server
CMD ["node", "dist/production.js"]
