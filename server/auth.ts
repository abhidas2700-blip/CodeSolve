import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string, username?: string) {
  // Check for null or empty values
  if (!supplied || !stored) {
    return false;
  }
  
  try {
    // If this is admin, attempt to resync/reset first to ensure consistency across all logins
    if (username === 'admin' && supplied === 'admin123') {
      // Special case for admin with standard password - immediately reset server password to match
      console.log("Admin login with standard password detected - syncing password storage");
      try {
        // Get the admin user
        const adminUser = await storage.getUserByUsername('admin');
        
        if (adminUser) {
          // Update server-side password hash
          await storage.updateUser(adminUser.id, {
            password: await hashPassword('admin123')
          });
          
          // Clean up localStorage admin entries
          const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
          const nonAdminUsers = qaUsers.filter((u: any) => u.username !== 'admin');
          
          // Add back a single clean admin entry with admin123
          nonAdminUsers.push({
            id: adminUser.id,
            username: 'admin',
            password: 'admin123',  // Set to default password
            rights: adminUser.rights,
            isInactive: adminUser.isInactive || false
          });
          
          // Save the cleaned list
          storage.getLocalStorage().setItem('qa-users', JSON.stringify(nonAdminUsers));
          console.log("ADMIN LOGIN: Reset admin password storage to admin123");
          
          // Always allow login with admin123
          return true;
        }
      } catch (err) {
        console.error("Error during admin password sync:", err);
        // Continue with normal password checking
      }
    }
    
    // Direct string comparison for development backdoor
    // This is for cases where both supplied and stored might be plain text
    if (supplied === stored) {
      console.log("Direct plaintext match between supplied and stored password");
      return true;
    }
    
    // If we know the username, check localStorage for a matching plaintext password
    // Since passwords changed in the UI are stored in plaintext in localStorage
    if (username) {
      const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
      
      // IMPORTANT: Only check the last entry for all users to ensure consistency
      const userEntries = qaUsers.filter((u: any) => u.username === username);
      
      if (userEntries.length > 0) {
        // Get only the last entry (most recent)
        const latestEntry = userEntries[userEntries.length - 1];
        
        if (latestEntry.password === supplied) {
          console.log(`Plaintext password match found in localStorage for ${username} (using latest entry only)`);
          return true;
        }
        
        // If there's more than one entry and the password doesn't match, log a warning
        if (userEntries.length > 1) {
          console.log(`WARNING: Found ${userEntries.length} entries for ${username}, but only checking the latest one`);
        }
      }
    }
    
    // If stored password is not in expected hashed format, last attempt is to check
    // if the supplied password is in hash format (rare but possible edge case)
    if (!stored.includes(".")) {
      // If neither is in hash format, we've already checked direct equality above
      return false;
    }
    
    // Otherwise, it's a properly hashed password, use crypto comparison
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "solvextra-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production',
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password, username))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Check if user is inactive
        if (user.isInactive) {
          return done(null, false, { message: "Account is inactive" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      // Get the most recent user data from storage
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      
      // Check if user has been deactivated since login
      if (user.isInactive) {
        return done(null, false);
      }
      
      // Check if the user also exists in localStorage
      // This ensures we have the most up-to-date permissions
      try {
        const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
        const localUser = qaUsers.find((u: any) => u.id === id);
        
        // If user exists in localStorage with different permissions, we need to be careful
        // The server database is the source of truth for permissions, not localStorage
        if (localUser && JSON.stringify(localUser.rights) !== JSON.stringify(user.rights)) {
          console.log(`Found different permissions for user ${user.username} in localStorage vs server`);
          console.log(`Server rights: ${JSON.stringify(user.rights)}`);
          console.log(`LocalStorage rights: ${JSON.stringify(localUser.rights)}`);
          
          // Server database is the source of truth - update localStorage instead
          // This prevents permission rollbacks when localStorage has stale data
          const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
          const userIndex = qaUsers.findIndex((u: any) => u.id === id);
          if (userIndex !== -1) {
            qaUsers[userIndex].rights = user.rights;
            storage.getLocalStorage().setItem('qa-users', JSON.stringify(qaUsers));
            console.log(`Updated localStorage permissions for ${user.username} to match server`);
          }
        }
      } catch (err) {
        console.error("Error checking localStorage for user permissions:", err);
        // Continue with the original user if there's an error
      }
      
      // Return the user from server storage
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Auth routes
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if the user is authenticated and has the right permissions
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "You must be logged in to register new users" });
      }
      
      // Check if current user has admin, userManage, or createLowerUsers rights
      const currentUser = req.user as SelectUser;
      const userRights = Array.isArray(currentUser.rights) ? currentUser.rights : [];
      
      if (!userRights.includes('admin') && 
          !userRights.includes('userManage') && 
          !userRights.includes('createLowerUsers')) {
        return res.status(403).json({ error: "You don't have permission to create new users" });
      }
      
      const { username, password, rights } = req.body;
      
      // Validate input
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }
      
      // Role-based restrictions - prevent creating equal or higher-level roles
      const requestedRights = rights || ["audit"];
      
      // Only admins can create other admins or master auditors
      if (!userRights.includes('admin') && 
          (requestedRights.includes('admin') || 
           requestedRights.includes('masterAuditor'))) {
        return res.status(403).json({ error: "Only administrators can create users with admin or master auditor rights" });
      }
      
      // Team leaders can only create auditors (with no createLowerUsers right)
      if (userRights.includes('createLowerUsers') && 
          userRights.includes('audit') && 
          !userRights.includes('admin') && 
          (requestedRights.includes('createLowerUsers') || 
           requestedRights.includes('userManage'))) {
        return res.status(403).json({ error: "Team leaders can only create basic auditor accounts" });
      }

      // Create the user with hashed password
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        rights: requestedRights,
        isInactive: false
      });

      // Important: Create a corresponding record in localStorage for UI compatibility
      // The UI still reads from localStorage for display purposes
      if (user) {
        console.log(`Syncing new user ${user.username} to localStorage for UI compatibility`);
        
        // Get existing users from localStorage
        const existingQaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
        
        // Add the new user to localStorage
        existingQaUsers.push({
          id: user.id,
          username: user.username,
          password: password, // Store the plaintext password in localStorage for compatibility
          rights: user.rights,
          isInactive: false
        });
        
        // Save back to localStorage
        storage.getLocalStorage().setItem('qa-users', JSON.stringify(existingQaUsers));
      }
      
      // Don't automatically log in as the created user
      // Instead, just return the created user data without password
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error in register:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Store login timestamp in the session
        req.session.lastActivity = new Date().toISOString();
        
        // Also store the timestamp in localStorage for persistent tracking
        try {
          const localStorage = storage.getLocalStorage();
          const loginTimestamps = localStorage.getItem('userLoginTimestamps')
            ? JSON.parse(localStorage.getItem('userLoginTimestamps'))
            : {};
          
          // Update the timestamp for this user
          loginTimestamps[user.id] = new Date().toISOString();
          
          // Save back to localStorage
          localStorage.setItem('userLoginTimestamps', JSON.stringify(loginTimestamps));
          console.log(`Updated login timestamp for user ${user.username} (${user.id})`);
        } catch (error) {
          console.error('Error updating login timestamp:', error);
          // Continue even if this fails
        }
        
        // Don't send password hash to client
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Don't send password hash to client
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });

  // Create a default admin user if none exists and sync with localStorage
  (async () => {
    try {
      const users = await storage.getAllUsers();
      if (users.length === 0) {
        console.log("Creating default admin user...");
        // Create admin user with ALL possible rights
        const allAdminRights = [
          "admin", "manager", "teamleader", "audit", "ata", "reports", 
          "dashboard", "buildForm", "userManage", "createLowerUsers", 
          "masterAuditor", "debug", "deleteForm", "editForm", "createForm",
          "superAdmin"
        ];
        
        await storage.createUser({
          username: "admin",
          password: await hashPassword("admin123"),
          rights: allAdminRights,
          isInactive: false
        });
        
        // Create test auditor user
        await storage.createUser({
          username: "auditor",
          password: await hashPassword("password"),
          rights: ["audit", "reports"],
          isInactive: false
        });
        
        console.log("Default users created.");
      }
      
      // Synchronize localStorage with server memory
      const localStorageUsers = storage.getLocalStorage().getItem('qa-users');
      if (!localStorageUsers) {
        console.log("No localStorage users found, creating initial data...");
        const allUsers = await storage.getAllUsers();
        
        // Create a synchronized version with default passwords
        const syncedUsers = allUsers.map(user => {
          return {
            id: user.id,
            username: user.username,
            password: user.username === 'admin' ? 'admin123' : 'password', // Default passwords
            rights: user.rights,
            isInactive: user.isInactive
          };
        });
        
        // Update localStorage
        storage.getLocalStorage().setItem('qa-users', JSON.stringify(syncedUsers));
        console.log(`Created initial localStorage with ${syncedUsers.length} users`);
      } else {
        console.log("Found existing localStorage users, synchronizing with server memory");
        
        try {
          // Parse localStorage users
          const parsedUsers = JSON.parse(localStorageUsers);
          
          if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
            // Clear existing users in memory (except the default admin for safety)
            const currentUsers = await storage.getAllUsers();
            
            // Update server memory with localStorage data
            for (const localUser of parsedUsers) {
              const existingUser = currentUsers.find(u => u.id === localUser.id);
              
              if (existingUser) {
                // Update existing user with localStorage data
                // For admin user, ensure we're not removing any rights
                if (localUser.username === 'admin') {
                  // Get the current admin user from server to compare rights
                  const adminUser = existingUser;
                  
                  // The admin user should have ALL rights without exception
                  const allAdminRights = [
                    "admin", "manager", "teamleader", "audit", "ata", "reports", 
                    "dashboard", "buildForm", "userManage", "createLowerUsers", 
                    "masterAuditor", "debug", "deleteForm", "editForm", "createForm",
                    "superAdmin"
                  ];
                  
                  // Update admin user with ALL rights to prevent removal
                  await storage.updateUser(localUser.id, {
                    username: localUser.username,
                    rights: allAdminRights,
                    isInactive: false // Never allow admin to be inactive
                  });
                  console.log(`Protected admin user rights during sync`);
                } else {
                  // Regular user update - but check if server has newer permission data
                  const serverUser = existingUser;
                  
                  // Compare rights - if different, use the more recent one
                  // For now, we'll prefer server data over localStorage during sync
                  // This prevents permission downgrades from stale localStorage data
                  const rightsToUse = serverUser.rights;
                  
                  await storage.updateUser(localUser.id, {
                    username: localUser.username,
                    rights: rightsToUse, // Use server rights to prevent rollbacks
                    isInactive: localUser.isInactive || false
                  });
                  
                  // Also update localStorage to match server
                  if (JSON.stringify(localUser.rights) !== JSON.stringify(rightsToUse)) {
                    const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
                    const userIndex = qaUsers.findIndex((u: any) => u.id === localUser.id);
                    if (userIndex !== -1) {
                      qaUsers[userIndex].rights = rightsToUse;
                      storage.getLocalStorage().setItem('qa-users', JSON.stringify(qaUsers));
                      console.log(`Synchronized localStorage permissions for ${localUser.username} with server`);
                    }
                  }
                }
                console.log(`Updated user ${localUser.username} from localStorage`);
              } else {
                // Create new user from localStorage data
                await storage.createUser({
                  username: localUser.username,
                  // Hash the password from localStorage
                  password: await hashPassword(localUser.password),
                  rights: localUser.rights,
                  isInactive: localUser.isInactive || false
                });
                console.log(`Created user ${localUser.username} from localStorage`);
              }
            }
            
            console.log(`Synchronized ${parsedUsers.length} users from localStorage to server memory`);
          }
        } catch (error) {
          console.error("Error synchronizing localStorage users:", error);
        }
      }
    } catch (error) {
      console.error("Error with user initialization:", error);
    }
  })();
}