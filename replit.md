# ThorEye Audit Management System

## Overview

ThorEye is a comprehensive audit management system designed for quality assurance operations. The application provides a complete solution for managing audit forms, samples, reports, and user workflows in a business environment. It features user authentication, role-based access control, and comprehensive audit tracking capabilities with real-time data management.

The system supports multiple audit workflows including form creation, sample assignment, audit execution, and report generation. It's built as a full-stack web application with streamlined production deployment.

## Recent Changes (September 1, 2025)

**Production Deployment Fixes:**
- Cleaned up codebase by removing problematic TypeScript files causing database schema errors
- Created simplified `server.js` with schema matching actual Neon database structure
- Fixed `created_at` column issues that were causing deployment failures
- Streamlined package.json for production deployment
- Removed duplicate and conflicting deployment files
- Authentication now works directly with admin/admin123 credentials

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development practices
- **UI Library**: Shadcn/ui components built on Radix UI primitives for consistent, accessible user interfaces
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: TanStack React Query for server state management and caching
- **Form Handling**: React Hook Form with Zod resolvers for type-safe form validation
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API endpoints
- **Language**: TypeScript with ES modules for modern JavaScript features
- **Authentication**: Passport.js with local strategy and bcrypt for password hashing
- **Session Management**: Express sessions with configurable storage backends
- **Data Persistence**: Dual storage approach supporting both localStorage (development) and PostgreSQL (production)
- **WebSocket Support**: Real-time communication capabilities for live updates

### Data Storage Solutions
- **Development**: localStorage-based storage for rapid prototyping and testing
- **Production**: PostgreSQL database with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon serverless PostgreSQL for scalable cloud deployment
- **Migration System**: Drizzle Kit for database schema management and version control

### Authentication and Authorization
- **Strategy**: Session-based authentication with Passport.js local strategy
- **Password Security**: bcrypt hashing with configurable salt rounds
- **Role Management**: User rights system supporting audit and reporting permissions
- **Session Storage**: Configurable session store (memory for development, database for production)

### Build and Deployment System
- **Development**: Live reload with Vite dev server and concurrent backend/frontend development
- **Production**: Multi-stage Docker build with optimized bundling and server compilation
- **Static Assets**: Vite-optimized frontend bundle served by Express static middleware
- **Process Management**: Emergency startup scripts for production resilience

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18 with TypeScript, React Hook Form, and TanStack React Query
- **Node.js Backend**: Express.js with TypeScript compilation via TSX
- **UI Components**: Extensive Radix UI component library with Shadcn/ui abstractions

### Database and ORM
- **Drizzle ORM**: Type-safe PostgreSQL operations with schema management
- **Neon Database**: Serverless PostgreSQL provider for production deployments
- **Database Migrations**: Drizzle Kit for schema versioning and deployment

### Authentication Services
- **Passport.js**: Authentication middleware with local and extensible strategies
- **bcrypt**: Industry-standard password hashing and verification

### Development and Build Tools
- **Vite**: Frontend build tool with React plugin and development server
- **esbuild**: Fast JavaScript bundler for server-side code compilation
- **TypeScript**: Type checking and compilation for both frontend and backend
- **Tailwind CSS**: Utility-first CSS framework with Vite integration

### Production Infrastructure
- **Docker**: Containerized deployment with multi-stage builds
- **Express Static**: Static file serving for production frontend assets
- **Process Management**: Custom startup scripts for production error handling