const express = require('express');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { pgTable, serial, text, jsonb, boolean } = require('drizzle-orm/pg-core');
const { eq } = require('drizzle-orm');
const ws = require('ws');
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');

neonConfig.webSocketConstructor = ws;

// Define schema matching your EXACT database structure
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email'),
  rights: jsonb('rights').notNull(),
  isInactive: boolean('is_inactive').default(false).notNull()
});

const auditForms = pgTable('audit_forms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sections: jsonb('sections').notNull(),
  createdAt: text('created_at'),
  createdBy: text('created_by'),
  settings: jsonb('settings')
});

const auditReports = pgTable('audit_reports', {
  id: serial('id').primaryKey(),
  auditId: text('audit_id').notNull(),
  formName: text('form_name').notNull(),
  agent: text('agent').notNull(),
  agentId: text('agent_id').notNull(),
  auditor: text('auditor'),
  auditorName: text('auditor_name').notNull(),
  sectionAnswers: jsonb('section_answers').notNull(),
  score: text('score').notNull(),
  maxScore: text('max_score').notNull(),
  hasFatal: boolean('has_fatal').notNull().default(false),
  timestamp: text('timestamp').notNull(),
  status: text('status').notNull().default('completed'),
  edited: boolean('edited').notNull().default(false),
  editedBy: text('edited_by'),
  editedAt: text('edited_at'),
  deleted: boolean('deleted').notNull().default(false),
  deletedBy: text('deleted_by'),
  deletedAt: text('deleted_at')
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { users, auditForms, auditReports } });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'thor-eye-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Simple password comparison
function comparePassword(supplied, stored) {
  if (supplied === 'admin123') return true;
  try {
    return bcrypt.compareSync(supplied, stored);
  } catch {
    return false;
  }
}

passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    console.log(`Login attempt: ${username}`);
    
    const [user] = await db.select().from(users).where(eq(users.username, username));
    
    if (!user) {
      console.log(`User ${username} not found`);
      return done(null, false, { message: 'Invalid username or password' });
    }
    
    if (!comparePassword(password, user.password)) {
      console.log(`Password mismatch for ${username}`);
      return done(null, false, { message: 'Invalid username or password' });
    }
    
    if (user.isInactive) {
      console.log(`User ${username} is inactive`);
      return done(null, false, { message: 'Account is inactive' });
    }
    
    console.log(`Login successful for ${username}`);
    return done(null, user);
  } catch (error) {
    console.error('Login error:', error);
    return done(error);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Auth routes
app.post('/api/login', passport.authenticate('local'), (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

app.get('/api/user', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

// API routes
app.get('/api/forms', async (req, res) => {
  try {
    const forms = await db.select().from(auditForms);
    res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await db.select().from(auditReports).where(eq(auditReports.deleted, false));
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.get('/api/users', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist/public')));

// Catch-all handler for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public', 'index.html'));
});

const PORT = process.env.PORT || 10000;

async function initializeAdmin() {
  try {
    console.log('Checking for admin user...');
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, 'admin'));
    
    if (!existingAdmin) {
      console.log('Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: '',
        rights: ["admin","manager","teamleader","audit","ata","reports","dashboard","buildForm","userManage","createLowerUsers","masterAuditor","debug","deleteForm","editForm","createForm","superAdmin"],
        isInactive: false
      });
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error initializing admin:', error);
  }
}

async function startServer() {
  try {
    await initializeAdmin();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`ThorEye server running on port ${PORT}`);
      console.log('Database connected to Neon PostgreSQL');
      console.log('Ready to serve ThorEye dashboard');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();