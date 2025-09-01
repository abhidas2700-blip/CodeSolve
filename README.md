# ThorEye Audit Management

A sophisticated React-based web application for comprehensive audit management, leveraging serverless architecture with advanced deployment capabilities.

## Features

- React.js with TypeScript frontend
- Express.js backend
- PostgreSQL database integration
- WebSocket real-time communication
- Authentication with Passport.js
- Role-based access control

## Deployment Options

### Option 1: One-Click Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/abhi6798/ThorEye)

### Option 2: Manual Docker Deployment on Render

1. **Download** this project as a ZIP file
2. **Create** a new Web Service on Render
3. Choose **Upload Files** instead of connecting to a repo
4. **Upload** the ZIP file
5. Select **Docker** as the environment
6. Leave the **Root Directory** field empty
7. Add the following environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure random string
   - `NODE_ENV`: Set to `production`
8. Click **Create Web Service**

### Option 3: Local Docker Development

```bash
# Clone the repository
git clone [your-repo-url]
cd [your-repo-name]

# Start the app with Docker Compose
docker-compose up
```

## Database Setup

- The application is configured to work with PostgreSQL
- When deploying through Render, you can create a PostgreSQL database service
- For local development, PostgreSQL is included in the docker-compose configuration

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `NODE_ENV`: Application environment (development, production)

## Troubleshooting

If you encounter issues during deployment:

1. Check the logs in the Render dashboard
2. Verify that your environment variables are set correctly
3. Ensure your PostgreSQL database is correctly configured and accessible