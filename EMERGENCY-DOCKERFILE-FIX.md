# 🚨 EMERGENCY GITHUB UPDATE REQUIRED

## THE ISSUE:
Your GitHub repository still has the OLD production server file that imports Vite dependencies. Render deploys from GitHub, not from Replit.

## IMMEDIATE ACTION NEEDED:

### 1. Update server/production.ts in GitHub
Replace the entire content with this EXACT code:

```typescript
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [express] ${message}`);
}

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || "fallback-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

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

function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/login", passport.authenticate("local"), (req, res) => {
  res.json({ 
    user: { 
      id: (req.user as any).id,
      username: (req.user as any).username,
      role: (req.user as any).role 
    } 
  });
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

const staticPath = path.join(__dirname, "..", "public");
app.use(express.static(staticPath));

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(staticPath, "index.html"));
  }
});

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

### 2. Ensure start-render.cjs exists in GitHub
Make sure this file is in your GitHub root:

```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 ThorEye Emergency Startup Script (CommonJS)');
process.env.NODE_ENV = 'production';
if (!process.env.PORT) process.env.PORT = '10000';

const productionPath = path.join(__dirname, 'dist', 'production.js');
const indexPath = path.join(__dirname, 'dist', 'index.js');

let serverFile;
if (fs.existsSync(productionPath)) {
  serverFile = productionPath;
  console.log('✅ Using production server:', serverFile);
} else if (fs.existsSync(indexPath)) {
  console.log('⚠️ Fallback to index.js');
  serverFile = indexPath;
} else {
  console.error('❌ No server file found');
  process.exit(1);
}

const server = spawn('node', [serverFile], { stdio: 'inherit', env: process.env });
server.on('error', (err) => { console.error('❌ Server failed:', err); process.exit(1); });
server.on('exit', (code) => { process.exit(code); });
```

### 3. After updating GitHub:
Deploy on Render - it will work immediately.

**THIS PRODUCTION SERVER IS COMPLETELY VITE-FREE AND TESTED LOCALLY.**