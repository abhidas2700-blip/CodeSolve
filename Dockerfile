# Base Node.js image
FROM node:18-alpine as builder

# Working directory in the container
WORKDIR /app

# Copy package files for build stage
COPY package.dev.json ./package.json
COPY package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Build the frontend only
RUN npx vite build

# Production stage - use a clean image for running the app
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy only the built application and production dependencies
COPY --from=builder /app/dist ./dist
COPY package.production.json ./package.json

# Install only production dependencies
RUN npm install --production

# Expose the port the app runs on
EXPOSE 10000

# Add healthcheck to ensure container is healthy
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:10000/api/health || exit 1

# Start with production server
COPY server.js ./
CMD ["node", "server.js"]
