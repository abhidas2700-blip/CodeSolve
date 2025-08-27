# 🚀 FINAL GITHUB UPDATES FOR RENDER DEPLOYMENT

## What to Update in GitHub

### 1. Fix Static File Path (`server/production.ts` line 145)
```typescript
// Change from:
const staticPath = path.join(__dirname, "..", "public");

// Change to:
const staticPath = path.join(__dirname, "public");
```

### 2. Fix Authentication (`server/production.ts` lines 118-127)
Replace the entire login route:

```typescript
// Replace this:
app.post("/api/login", passport.authenticate("local"), (req, res) => {
  res.json({ 
    user: { 
      id: (req.user as any).id,
      username: (req.user as any).username,
      role: (req.user as any).role 
    } 
  });
});

// With this:
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
```

### 3. Add Default User Initialization (after line 74)
Add this code after `app.use(passport.session());`:

```typescript
// Initialize default admin user for production
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

// Initialize on startup
initializeDefaultUser();
```

## After Updating GitHub
1. Push changes to GitHub
2. Render will auto-deploy
3. Login will work with admin/admin123
4. Frontend will load properly
5. Full ThorEye functionality available

**These fixes resolve both the frontend serving and authentication issues!**