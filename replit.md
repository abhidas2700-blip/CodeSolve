# ThorEye Audit Management

## Overview
ThorEye is a comprehensive audit management web application designed for quality assurance processes. It provides role-based access control for managing audit forms, conducting audits, generating reports, and tracking quality metrics. The system supports multiple user roles (auditors, team leaders, managers, administrators) with specific permissions. Built as a full-stack solution with React frontend and Express.js backend, it's designed for deployment on serverless platforms. The project's vision is to streamline quality assurance workflows, improve data accuracy, and provide actionable insights for businesses.

**CRITICAL DATABASE PERSISTENCE FIXED (Aug 15, 2025)**: Resolved complete database persistence issues where forms and audit reports were not saving to PostgreSQL. Fixed both form creation and audit completion to properly call database APIs. Bypassed memory storage fallback mechanism that was preventing PostgreSQL persistence. All audit data now persists correctly to PostgreSQL database with comprehensive error handling and logging. User confirmed audit reports and edits are now saving successfully to database. Current status: 5 audit reports in PostgreSQL, all persistence working correctly.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React 18 with TypeScript, employing a component-based architecture with shadcn/ui and Tailwind CSS for a consistent, responsive design. State management leverages React Context, local state, and React Query for server state. Forms are handled with React Hook Form and Zod validation.

### Backend Architecture
The backend is a Node.js Express application with TypeScript, designed for serverless deployment. It uses a hybrid storage approach with PostgreSQL via Drizzle ORM and localStorage for UI compatibility. Authentication uses Passport.js with local strategy and role-based access control. Session management is handled by express-session.

### Database Design
PostgreSQL is the primary database, managed with Drizzle ORM. The schema includes tables for users, audit forms, reports, ATA reviews, deleted audits, and audit samples, designed with relationships, soft deletes, and timestamping. JSON fields support complex data structures.

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