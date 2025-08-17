# ThorEye Audit Management

## Overview
ThorEye is a comprehensive audit management web application designed for quality assurance processes. It provides role-based access control for managing audit forms, conducting audits, generating reports, and tracking quality metrics. The system supports multiple user roles (auditors, team leaders, managers, administrators) with specific permissions. Built as a full-stack solution with React frontend and Express.js backend, it's designed for deployment on serverless platforms. The project's vision is to streamline quality assurance workflows, improve data accuracy, and provide actionable insights for businesses.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React 18 with TypeScript, employing a component-based architecture with shadcn/ui and Tailwind CSS for a consistent, responsive design. State management leverages React Context, local state, and React Query for server state. Forms are handled with React Hook Form and Zod validation.

### Backend Architecture
The backend is a Node.js Express application with TypeScript, designed for serverless deployment. It uses a hybrid storage approach with PostgreSQL via Drizzle ORM and localStorage for UI compatibility. Authentication uses Passport.js with local strategy and role-based access control. Session management is handled by express-session.

### Database Design
PostgreSQL is the primary database, managed with Drizzle ORM. The schema includes tables for users, audit forms, reports, ATA reviews, deleted audits, and audit samples, designed with relationships, soft deletes, and timestamping. JSON fields support complex data structures.

**Recent Updates (Aug 17, 2025)**: 
- Successfully migrated Forms component from localStorage-only storage to full database integration. All form operations (create, read, update, delete, duplicate) now persist to PostgreSQL database with automatic UI refresh.
- CRITICAL FIX: Fixed audit reports not being saved to database after auditor completion. Updated AuditFormRenderer to load forms from database API and added database API call in completeAudit function to save audit reports to PostgreSQL. All audit data now properly persists to database.
- FINAL FIX: Resolved deleted audits database integration - updated markReportAsDeleted to save deleted audits via /api/deleted-audits API with proper async handling and field mapping.
- VALIDATION FIX: Fixed sectionAnswers data structure conversion from array to object format for database schema compliance, resolving 400 validation errors.
- DATABASE INTEGRATION COMPLETE: All core functionality (forms, audit reports, deleted audits, samples, ATA reviews) now fully integrated with PostgreSQL database with real-time synchronization. System ready for production deployment.
- NETLIFY DEPLOYMENT FIX: Fixed 404 routing errors by configuring proper SPA redirects. Added _redirects file to dist/public/ directory and updated netlify.toml with correct publish directory (dist/public/) and build commands. All routes now properly handled for serverless deployment.
- NEON DATABASE CONNECTION ESTABLISHED: Successfully connected Netlify deployment to real Neon PostgreSQL database. DATABASE_URL environment variable properly configured in Netlify dashboard. Database connection confirmed working with debug endpoint returning {"hasPool":true,"hasEnvVar":true,"envVarLength":153}.
- PENDING: Function code deployment - updated netlify/functions/api.js with proper users endpoint (returns array) and enhanced error handling, but deployment not yet reflected. Requires manual deployment trigger to show real database data in Users management page.

### Real-time Communication
WebSocket integration enables real-time updates for collaborative features, such as live changes in audit statuses, assignments, and report updates.

### Deployment Architecture
The system supports deployment via Docker, Render, and Netlify serverless functions. Vite is used for frontend builds and esbuild for the backend. Environment variables manage configuration.

### Conditional Visibility
The system supports conditional visibility for questions and sections within audit forms. Questions with a `controlledBy` property are shown based on the controlling question's answer. Sections with `controlsSection: true` are displayed based on their controlling question's answer.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL.
- **PostgreSQL**: Traditional PostgreSQL.

### UI Component Libraries
- **Radix UI**: Accessible, unstyled UI components.
- **shadcn/ui**: Pre-styled components built on Radix UI and Tailwind CSS.
- **Lucide React**: Icon library.

### Authentication & Session Management
- **Passport.js**: Authentication middleware.
- **express-session**: Session management.

### Development & Build Tools
- **Vite**: Frontend build tool.
- **TypeScript**: Type safety.
- **Tailwind CSS**: Utility-first CSS framework.
- **Drizzle Kit**: Database migration and schema management.