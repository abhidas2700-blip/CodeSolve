# ThorEye Audit Management

## Overview

ThorEye is a comprehensive audit management web application designed for quality assurance processes. The system provides role-based access control for managing audit forms, conducting audits, generating reports, and tracking quality metrics. It supports multiple user roles including auditors, team leaders, managers, and administrators, each with specific permissions and capabilities. The application is built as a full-stack solution with React frontend and Express.js backend, designed for deployment on serverless platforms like Render and Netlify.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built using React 18 with TypeScript, utilizing a component-based architecture with shadcn/ui components for consistent styling. The application uses Tailwind CSS for styling and implements a modern design system with custom color schemes and responsive layouts. State management is handled through React Context and local state, with React Query (@tanstack/react-query) for server state management and caching. The frontend supports real-time updates through WebSocket connections and uses React Hook Form with Zod validation for form handling.

### Backend Architecture
The backend follows a Node.js Express architecture with TypeScript, designed for serverless deployment. The system uses a hybrid storage approach, combining PostgreSQL database operations through Drizzle ORM with localStorage-based data persistence for UI compatibility. Session management is implemented using express-session with MemoryStore for development and in-memory storage. Authentication is handled through Passport.js with local strategy, supporting role-based access control with granular permissions.

### Database Design
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations. The schema includes tables for users, audit forms, audit reports, ATA reviews, deleted audits, skipped samples, and audit samples. Each table is designed with proper relationships and constraints, supporting features like soft deletes, timestamps, and JSON field storage for complex data structures. The database configuration supports both Neon serverless PostgreSQL and traditional PostgreSQL deployments.

### Real-time Communication
WebSocket integration provides real-time updates for collaborative features, enabling multiple users to see live changes in audit statuses, assignments, and report updates. The WebSocket implementation is built into the Express server and handles connection management, broadcasting, and error handling.

### Deployment Architecture
The system is designed for multiple deployment scenarios including Docker containerization, Render platform deployment, and Netlify serverless functions. Build processes are configured with Vite for the frontend and esbuild for the backend, supporting both development and production environments. Environment variables handle configuration for database connections, JWT secrets, and deployment-specific settings.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL database service with connection pooling and automatic scaling
- **PostgreSQL**: Traditional PostgreSQL database for self-hosted deployments

### UI Component Libraries
- **Radix UI**: Comprehensive set of accessible, unstyled UI components including dialogs, dropdowns, tooltips, and form controls
- **shadcn/ui**: Pre-styled component library built on top of Radix UI with Tailwind CSS
- **Lucide React**: Icon library providing consistent iconography throughout the application

### Authentication & Session Management
- **Passport.js**: Authentication middleware supporting local strategy with extensible authentication methods
- **express-session**: Session management with configurable storage backends

### Development & Build Tools
- **Vite**: Frontend build tool with hot module replacement and optimized production builds
- **TypeScript**: Type safety across the entire application stack
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Drizzle Kit**: Database migration and schema management tools

## Recent Changes

### January 2025 - Complete Database Integration & Export Functionality  
- **PostgreSQL Integration**: Successfully migrated from localStorage to Neon PostgreSQL database with full CRUD operations. All data is now persisted in the database with no risk of data loss.
- **Deployment Ready**: Created comprehensive deployment configurations for Render and manual server deployment with render.yaml, proper .gitignore, and deployment guide.
- **Database Services**: Implemented DatabaseService class with complete user management, audit forms, reports, samples, and statistics functionality.
- **Health Monitoring**: Added /api/health endpoint for database connectivity monitoring and /api/stats for system statistics.
- **Security**: Implemented bcrypt password hashing, secure session management, and proper environment variable handling.
- **Repeatable Sections**: Completed implementation of "Was there another interaction?" functionality in both preview and auditing forms with dynamic section creation/removal.
- **Export Functionality**: Completely rewrote CSV export to handle multiple interactions horizontally (side-by-side columns) instead of vertically (separate rows). Each audit appears as one row with interaction questions displayed as "Interaction 1 - Question", "Interaction 2 - Question" column groups.
- **Conditional Validation**: Fixed form validation to properly skip mandatory validation for hidden questions controlled by conditional logic.

### August 2025 - Critical Dynamic Sections Fix
- **Root Cause Identified**: Dynamic sections (Interaction 2, 3, etc.) were being created correctly in the UI but not saved during audit submission because they weren't included in the global form state.
- **Audit Submission Fix**: Updated audit submission process in audits.tsx to include dynamic sections from global state in both validation and processing phases.
- **Global State Enhancement**: Extended global form state to include dynamicSections property and updated all form value events to properly pass dynamic sections data.
- **Export Cleanup**: Fixed CSV export to eliminate duplicate questions by using question text as unique keys instead of section indices, and excluded control questions ("Was there another interaction?") from export columns.
- **Data Integrity**: All multiple interaction audits now properly save and display in reports with distinct blue-bordered sections for each interaction.

### Database Architecture
- **Primary Storage**: PostgreSQL via Neon with connection pooling and SSL encryption
- **Schema Management**: Drizzle ORM with type-safe operations and automated migrations
- **Data Persistence**: All forms, audit reports, user data, and samples stored in PostgreSQL
- **Backup Strategy**: Automated backups managed by Neon PostgreSQL service

### Deployment Configurations
- **Render**: render.yaml with auto-scaling, health checks, and environment variable configuration
- **Manual Deployment**: Complete deployment guide with Docker and traditional server setup instructions
- **Environment Variables**: DATABASE_URL and SESSION_SECRET properly configured for production security

### How Conditional Visibility Works
- **Question Level**: Questions with a `controlledBy` property will only show when their controlling question's answer matches one of the values in `visibleOnValues`
- **Section Level**: Sections with `controlsSection: true` will only show when their controlling question (identified by `controlledSectionId`) has an answer matching `visibleOnValues`
- **Debug Output**: Console logs show detailed visibility decisions including which questions are being controlled and why they're hidden/shown