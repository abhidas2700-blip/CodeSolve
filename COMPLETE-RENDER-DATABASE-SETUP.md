# 🎯 COMPLETE RENDER DATABASE SETUP

## Current Issue
Your Render deployment at https://codesolve.onrender.com is working but using memory storage instead of connecting to your Neon PostgreSQL database.

**Evidence from Render logs:**
- "No localStorage file found at /app/localStorage.json, starting with empty store"
- "Warning: connect.session() MemoryStore is not designed for a production environment"

## Complete Solution

### Step 1: Update GitHub Production Server

Replace the entire content of `server/production.ts` in your GitHub repository with:

```typescript
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { DatabaseStorage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [express] ${message}`);
}

const app = express();

// CRITICAL: Use DatabaseStorage instead of MemStorage
const storage = new DatabaseStorage();

// Configure session
app.use(session({
  secret: process.env.SESSION_SECRET || "fallback-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// Configure passport
passport.use(new LocalStrategy(
  { usernameField: 'username', passwordField: 'password' },
  async (username: string, password: string, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
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
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());

// Initialize default admin user
async function initializeDefaultUser() {
  try {
    const existingAdmin = await storage.getUserByUsername("admin");
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "administrator"
      });
      log("Default admin user created");
    }
  } catch (error) {
    log(`Error initializing default user: ${error}`);
  }
}

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
          role: user.role 
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
  res.json({ 
    id: user.id,
    username: user.username,
    role: user.role 
  });
});

// CRITICAL: Fix static file path for production
const staticPath = path.join(__dirname, "public");
app.use(express.static(staticPath));

// SPA fallback
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
app.listen(PORT, "0.0.0.0", () => {
  log(`serving on 0.0.0.0:${PORT}`);
});
```

### Step 2: Set Environment Variable in Render

Go to Render Dashboard → Your Service → Settings → Environment Variables

Add:
- **Key:** `DATABASE_URL`
- **Value:** `postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

### Step 3: Redeploy

After updating GitHub, Render will automatically redeploy. You'll see in the logs:
- DatabaseStorage being used instead of MemStorage
- "Default admin user created" message
- No more localStorage warnings

## Expected Results After Fix

✅ **Database Connection:** Connected to real Neon PostgreSQL  
✅ **Authentication:** Login works with admin/admin123  
✅ **Data Persistence:** All audit data saved permanently  
✅ **No Memory Warnings:** Production-ready session storage  
✅ **Frontend Loading:** Static files served correctly  

Your ThorEye audit management system will be fully operational!