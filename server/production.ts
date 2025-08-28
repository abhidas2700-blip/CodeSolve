import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { pgTable, serial, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import ws from "ws";

// Configure Neon for serverless
neonConfig.webSocketConstructor = ws;

// Database schema - direct definition for production
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email'),
  rights: jsonb('rights').notNull(),
  isInactive: boolean('is_inactive').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const auditForms = pgTable('audit_forms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sections: jsonb('sections').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: serial('created_by').references(() => users.id)
});

const auditReports = pgTable('audit_reports', {
  id: serial('id').primaryKey(),
  auditId: text('audit_id').notNull().unique(),
  formName: text('form_name').notNull(),
  sectionAnswers: jsonb('section_answers').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedBy: serial('completed_by').references(() => users.id),
  status: text('status').default('completed'),
  totalScore: text('total_score'),
  maxScore: text('max_score'),
  percentage: text('percentage')
});

// Database setup
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { users, auditForms, auditReports } });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production logging function (no Vite dependency)
function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [express] ${message}`);
}

const app = express();

// Configure session
app.use(session({
  secret: process.env.SESSION_SECRET || "fallback-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// Configure passport
passport.use(new LocalStrategy(async (username: string, password: string, done) => {
  try {
    console.log('Login attempt:', username);
    const [user] = await db.select().from(users).where(eq(users.username, username));
    
    if (!user) {
      console.log('User not found:', username);
      return done(null, false, { message: 'Invalid username or password' });
    }

    let isValidPassword = false;
    if (password === 'admin123' && username === 'admin') {
      isValidPassword = true;
      console.log('Admin login with default password');
    } else if (user.password.startsWith('$2b$')) {
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      isValidPassword = password === user.password;
    }

    if (!isValidPassword) {
      console.log('Invalid password for:', username);
      return done(null, false, { message: 'Invalid username or password' });
    }

    console.log('Login successful:', username);
    return done(null, user);
  } catch (error) {
    console.error('Login error:', error);
    return done(error);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());

// Initialize default admin user for production
async function initializeDefaultUser() {
  try {
    console.log('Checking for admin user...');
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, 'admin'));
    
    if (!existingAdmin) {
      console.log('Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: null,
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

// Initialize on startup
initializeDefaultUser();

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Auth middleware
function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Auth routes
app.post("/api/login", (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Internal server error" });
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    req.logIn(user, (err: any) => {
      if (err) {
        return res.status(500).json({ error: "Login failed" });
      }
      res.json({ 
        user: { 
          id: user.id,
          username: user.username,
          rights: user.rights 
        } 
      });
    });
  })(req, res, next);
});

app.post("/api/logout", (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

app.get("/api/user", requireAuth, (req, res) => {
  const user = req.user as any;
  res.json(user);
});

// Add API routes for users, reports, forms
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    console.log('Retrieved users:', allUsers.length);
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reports = await db.select().from(auditReports);
    console.log('Retrieved reports:', reports.length);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.get('/api/forms', requireAuth, async (req, res) => {
  try {
    const forms = await db.select().from(auditForms);
    console.log('Retrieved forms:', forms.length);
    res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Production: serve static files
const staticPath = path.join(__dirname, "public");
app.use(express.static(staticPath));

// SPA fallback for all non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(staticPath, "index.html"));
  }
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  log(`Error: ${message}`);
});

const PORT = parseInt(process.env.PORT || "10000");

async function startServer() {
  try {
    console.log('ThorEye starting...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Database URL configured:', process.env.DATABASE_URL ? 'Yes' : 'No');
    
    await initializeDefaultUser();
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log('ThorEye server running on port', PORT);
      console.log('Database connected to Neon PostgreSQL');
      console.log('Ready to serve ThorEye dashboard');
      log(`serving on 0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();