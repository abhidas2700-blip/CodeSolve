# ThorEye Audit Management System

## Overview

ThorEye is a comprehensive quality assurance audit management web application built with modern technologies. The system provides a complete solution for managing audits, forms, reports, and user access with role-based permissions. It features a React-based frontend with TypeScript, an Express.js backend, and PostgreSQL database integration through Neon, designed for serverless deployment on platforms like Render and Netlify.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **UI Library**: Shadcn/ui components built on Radix UI primitives for accessible, customizable interfaces
- **Styling**: Tailwind CSS with custom design system and CSS variables for theming
- **State Management**: React Query (TanStack Query) for server state and caching, React Context for authentication
- **Routing**: React Router for client-side navigation with protected routes
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API endpoints
- **Authentication**: Passport.js with local strategy, bcrypt for password hashing, express-session for session management
- **Database ORM**: Drizzle ORM for type-safe database operations and schema management
- **API Design**: RESTful endpoints with consistent error handling and response formats
- **File Structure**: Separation of concerns with dedicated routes, storage, and authentication modules
- **Production Server**: Dedicated production.ts for deployment environments without dev dependencies

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon with WebSocket support for real-time operations
- **ORM Configuration**: Drizzle ORM with PostgreSQL dialect, automated migrations through drizzle-kit
- **Schema Design**: 
  - Users table with role-based access control (rights array)
  - Audit forms with JSON sections for flexible form definitions
  - Audit reports with JSON answers and scoring systems
  - Audit samples for workflow management
- **Connection Management**: Connection pooling with @neondatabase/serverless for serverless environments
- **Fallback Storage**: Memory storage implementation for development and testing scenarios

### Authentication and Authorization
- **Strategy**: Session-based authentication using Passport.js local strategy
- **Password Security**: bcrypt hashing with salt rounds for secure password storage
- **Session Management**: Express-session with configurable session stores, secure cookie settings
- **Role-Based Access**: Granular permissions system with rights arrays (admin, manager, auditor, etc.)
- **Route Protection**: Middleware-based route protection with role validation
- **User Management**: CRUD operations for user accounts with hierarchical permissions

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver with WebSocket support
- **drizzle-orm**: Type-safe ORM with PostgreSQL support and migration tools
- **express**: Web framework with middleware ecosystem
- **passport & passport-local**: Authentication middleware and local strategy
- **bcrypt**: Cryptographic password hashing library
- **express-session**: Session management middleware

### UI and Frontend Dependencies
- **@radix-ui/react-***: Comprehensive collection of accessible UI primitives (dialogs, dropdowns, forms, etc.)
- **@tanstack/react-query**: Server state management and caching solution
- **react-hook-form**: Performant form library with minimal re-renders
- **@hookform/resolvers**: Validation resolvers for React Hook Form
- **zod**: TypeScript-first schema validation library
- **class-variance-authority**: Utility for creating variant-based component APIs
- **clsx**: Conditional className utility
- **tailwind-merge**: Utility for merging Tailwind CSS classes

### Development and Build Tools
- **vite**: Fast build tool with HMR and optimized production builds
- **@vitejs/plugin-react**: React support for Vite with Fast Refresh
- **typescript**: Static type checking and compilation
- **tsx**: TypeScript execution engine for development
- **tailwindcss**: Utility-first CSS framework
- **autoprefixer**: CSS vendor prefixing
- **drizzle-kit**: Database migration and studio tools

### Deployment Dependencies
- **ws**: WebSocket library for database connections
- **@types/***: TypeScript type definitions for various packages
- **esbuild**: Fast JavaScript bundler for production builds (used in deployment pipeline)

### Third-Party Integrations
- **Neon PostgreSQL**: Serverless PostgreSQL database platform with branching capabilities
- **Render**: Cloud platform for web service deployment with Docker support
- **Netlify**: Edge computing platform for serverless function deployment
- **GitHub**: Version control and CI/CD integration for automated deployments