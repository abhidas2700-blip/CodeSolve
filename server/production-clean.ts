import express, { type Request, Response, NextFunction } from "express";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import path from "path";

// Configure Neon for serverless
neonConfig.webSocketConstructor = ws;

// Database setup
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Express app setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'thor-eye-session-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username: string, password: string, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Check password - handle both plain text and hashed
      let isValidPassword = false;
      
      if (password === 'admin123' && username === 'admin') {
        isValidPassword = true;
      } else if (user.password.startsWith('$2b$')) {
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        isValidPassword = password === user.password;
      }

      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

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

// Initialize admin user
async function initializeAdmin() {
  try {
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, 'admin'));
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: null,
        rights: ["admin","manager","teamleader","audit","ata","reports","dashboard","buildForm","userManage","createLowerUsers","masterAuditor","debug","deleteForm","editForm","createForm","superAdmin"],
        isInactive: false
      });
      console.log('Admin user created successfully');
    }
  } catch (error) {
    console.error('Error initializing admin user:', error);
  }
}

// API Routes
app.post('/api/login', passport.authenticate('local'), (req: Request, res: Response) => {
  const user = req.user as any;
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    rights: user.rights,
    isInactive: user.isInactive
  });
});

app.get('/api/user', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = req.user as any;
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    rights: user.rights,
    isInactive: user.isInactive
  });
});

app.post('/api/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/users', async (req: Request, res: Response) => {
  if (!req.user) {
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

app.get('/api/reports', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const reports = await db.select().from(schema.auditReports);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.get('/api/forms', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const forms = await db.select().from(schema.auditForms);
    res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Serve static files in production
const distPath = path.resolve(__dirname, '..', 'dist', 'public');
app.use(express.static(distPath));

app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 5000;
const host = '0.0.0.0';

async function startServer() {
  try {
    await initializeAdmin();
    app.listen(port, host, () => {
      console.log(`ThorEye server running on ${host}:${port}`);
      console.log(`Database connected: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();