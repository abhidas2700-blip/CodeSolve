import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { 
  insertUserSchema, 
  insertAuditFormSchema, 
  insertAuditReportSchema,
  insertAtaReviewSchema,
  insertSkippedSampleSchema,
  insertDeletedAuditSchema,
  insertAuditSampleSchema,
  users,
  auditForms,
  auditReports,
  ataReviews,
  deletedAudits,
  skippedSamples,
  auditSamples
} from "@shared/schema";
import { z } from "zod";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { db } from "./db";
import { eq, desc, asc, and, or } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add middleware to update session lastActivity timestamp
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.session) {
      (req.session as any).lastActivity = new Date().toISOString();
      
      // Store basic user agent and IP for security purposes
      (req.session as any).userAgent = req.headers['user-agent'];
      (req.session as any).ip = req.ip || req.socket.remoteAddress;
      
      // If this is an authenticated user, also update activity tracking
      if (req.isAuthenticated() && req.user) {
        try {
          const userId = (req.user as any).id;
          if (userId) {
            const localStorage = storage.getLocalStorage();
            const loginTimestamps = localStorage.getItem('userLoginTimestamps')
              ? JSON.parse(localStorage.getItem('userLoginTimestamps'))
              : {};
              
            // Update the timestamp for this user
            loginTimestamps[userId] = new Date().toISOString();
            localStorage.setItem('userLoginTimestamps', JSON.stringify(loginTimestamps));
          }
        } catch (error) {
          console.error('Error updating activity timestamp:', error);
          // Continue even if this fails
        }
      }
    }
    next();
  });

  // Set up authentication
  setupAuth(app);
  
  // HTTP Server
  const httpServer = createServer(app);
  
  // WebSocket Server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // WebSocket Handler
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to ThorEye server'
    }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        
        // Handle different message types
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
            break;
            
          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Unknown message type'
            }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Broadcast function - send message to all connected clients
  const broadcast = (message: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };
  
  // USER ROUTES
  
  // Get all users
  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      
      // Filter out the default admin user from the displayed list
      // The admin still exists and has all rights, but is hidden from the user list
      const filteredUsers = users.filter(user => user.username !== 'admin');
      
      res.json(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  // Get user by ID
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // Create user
  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await db.select().from(users).where(eq(users.username, validatedData.username));
      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const [newUser] = await db.insert(users).values({
        ...validatedData,
        password: await hashPassword(validatedData.password)
      }).returning();

      broadcast({
        type: 'user_created',
        user: { id: newUser.id, username: newUser.username, rights: newUser.rights }
      });

      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Update user
  app.put('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const validatedData = insertUserSchema.partial().parse(req.body);
      
      // Hash password if provided
      if (validatedData.password) {
        validatedData.password = await hashPassword(validatedData.password);
      }

      const [updatedUser] = await db
        .update(users)
        .set(validatedData)
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      broadcast({
        type: 'user_updated',
        user: { id: updatedUser.id, username: updatedUser.username, rights: updatedUser.rights }
      });

      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Delete user
  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const [deletedUser] = await db.delete(users).where(eq(users.id, userId)).returning();

      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      broadcast({
        type: 'user_deleted',
        userId: userId
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // AUDIT FORMS ROUTES

  // Get all audit forms
  app.get('/api/forms', async (req: Request, res: Response) => {
    try {
      const forms = await db.select().from(auditForms).orderBy(desc(auditForms.createdAt));
      res.json(forms);
    } catch (error) {
      console.error('Error fetching forms:', error);
      res.status(500).json({ error: 'Failed to fetch forms' });
    }
  });

  // Get form by ID
  app.get('/api/forms/:id', async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ error: 'Invalid form ID' });
      }

      const [form] = await db.select().from(auditForms).where(eq(auditForms.id, formId));
      
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }

      res.json(form);
    } catch (error) {
      console.error('Error fetching form:', error);
      res.status(500).json({ error: 'Failed to fetch form' });
    }
  });

  // Create audit form
  app.post('/api/forms', async (req: Request, res: Response) => {
    try {
      const validatedData = insertAuditFormSchema.parse(req.body);
      
      const [newForm] = await db.insert(auditForms).values({
        ...validatedData,
        createdBy: req.user?.id || null
      }).returning();

      broadcast({
        type: 'form_created',
        form: newForm
      });

      res.status(201).json(newForm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating form:', error);
      res.status(500).json({ error: 'Failed to create form' });
    }
  });

  // Update audit form
  app.put('/api/forms/:id', async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ error: 'Invalid form ID' });
      }

      const validatedData = insertAuditFormSchema.partial().parse(req.body);

      const [updatedForm] = await db
        .update(auditForms)
        .set(validatedData)
        .where(eq(auditForms.id, formId))
        .returning();

      if (!updatedForm) {
        return res.status(404).json({ error: 'Form not found' });
      }

      broadcast({
        type: 'form_updated',
        form: updatedForm
      });

      res.json(updatedForm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error updating form:', error);
      res.status(500).json({ error: 'Failed to update form' });
    }
  });

  // Delete audit form
  app.delete('/api/forms/:id', async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ error: 'Invalid form ID' });
      }

      const [deletedForm] = await db.delete(auditForms).where(eq(auditForms.id, formId)).returning();

      if (!deletedForm) {
        return res.status(404).json({ error: 'Form not found' });
      }

      broadcast({
        type: 'form_deleted',
        formId: formId
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting form:', error);
      res.status(500).json({ error: 'Failed to delete form' });
    }
  });

  // AUDIT REPORTS ROUTES

  // Get all audit reports
  app.get('/api/reports', async (req: Request, res: Response) => {
    try {
      const reports = await db.select().from(auditReports).orderBy(desc(auditReports.timestamp));
      res.json(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  // Get report by ID
  app.get('/api/reports/:id', async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ error: 'Invalid report ID' });
      }

      const [report] = await db.select().from(auditReports).where(eq(auditReports.id, reportId));
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json(report);
    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  });

  // Create audit report
  app.post('/api/reports', async (req: Request, res: Response) => {
    try {
      const validatedData = insertAuditReportSchema.parse(req.body);
      
      const [newReport] = await db.insert(auditReports).values({
        ...validatedData,
        auditor: req.user?.id || null
      }).returning();

      broadcast({
        type: 'report_created',
        report: newReport
      });

      res.status(201).json(newReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating report:', error);
      res.status(500).json({ error: 'Failed to create report' });
    }
  });

  // Update audit report
  app.put('/api/reports/:id', async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ error: 'Invalid report ID' });
      }

      const validatedData = insertAuditReportSchema.partial().parse(req.body);

      const [updatedReport] = await db
        .update(auditReports)
        .set({
          ...validatedData,
          edited: true,
          editedBy: req.user?.id || null,
          editedAt: new Date()
        })
        .where(eq(auditReports.id, reportId))
        .returning();

      if (!updatedReport) {
        return res.status(404).json({ error: 'Report not found' });
      }

      broadcast({
        type: 'report_updated',
        report: updatedReport
      });

      res.json(updatedReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error updating report:', error);
      res.status(500).json({ error: 'Failed to update report' });
    }
  });

  // Delete audit report
  app.delete('/api/reports/:id', async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ error: 'Invalid report ID' });
      }

      // First get the report to move to deleted_audits
      const [reportToDelete] = await db.select().from(auditReports).where(eq(auditReports.id, reportId));
      
      if (!reportToDelete) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Move to deleted audits table
      await db.insert(deletedAudits).values({
        originalId: reportToDelete.id.toString(),
        auditId: reportToDelete.auditId,
        formName: reportToDelete.formName,
        agent: reportToDelete.agent,
        agentId: reportToDelete.agentId,
        auditor: reportToDelete.auditor,
        auditorName: reportToDelete.auditorName,
        sectionAnswers: reportToDelete.sectionAnswers,
        score: reportToDelete.score,
        maxScore: reportToDelete.maxScore,
        hasFatal: reportToDelete.hasFatal,
        timestamp: reportToDelete.timestamp,
        deletedBy: req.user?.id || 1,
        deletedByName: (req.user as any)?.username || 'Unknown',
        editHistory: null
      });

      // Delete from audit reports
      await db.delete(auditReports).where(eq(auditReports.id, reportId));

      broadcast({
        type: 'report_deleted',
        reportId: reportId
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting report:', error);
      res.status(500).json({ error: 'Failed to delete report' });
    }
  });

  // ATA REVIEW ROUTES

  // Get all ATA reviews
  app.get('/api/ata-reviews', async (req: Request, res: Response) => {
    try {
      const reviews = await db.select().from(ataReviews).orderBy(desc(ataReviews.timestamp));
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching ATA reviews:', error);
      res.status(500).json({ error: 'Failed to fetch ATA reviews' });
    }
  });

  // Get ATA review by ID
  app.get('/api/ata-reviews/:id', async (req: Request, res: Response) => {
    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        return res.status(400).json({ error: 'Invalid review ID' });
      }

      const [review] = await db.select().from(ataReviews).where(eq(ataReviews.id, reviewId));
      
      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }

      res.json(review);
    } catch (error) {
      console.error('Error fetching ATA review:', error);
      res.status(500).json({ error: 'Failed to fetch ATA review' });
    }
  });

  // Create ATA review
  app.post('/api/ata-reviews', async (req: Request, res: Response) => {
    try {
      const validatedData = insertAtaReviewSchema.parse(req.body);
      
      const [newReview] = await db.insert(ataReviews).values({
        ...validatedData,
        reviewerId: req.user?.id || null
      }).returning();

      broadcast({
        type: 'ata_review_created',
        review: newReview
      });

      res.status(201).json(newReview);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating ATA review:', error);
      res.status(500).json({ error: 'Failed to create ATA review' });
    }
  });

  // Update ATA review
  app.put('/api/ata-reviews/:id', async (req: Request, res: Response) => {
    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        return res.status(400).json({ error: 'Invalid review ID' });
      }

      const validatedData = insertAtaReviewSchema.partial().parse(req.body);

      const [updatedReview] = await db
        .update(ataReviews)
        .set(validatedData)
        .where(eq(ataReviews.id, reviewId))
        .returning();

      if (!updatedReview) {
        return res.status(404).json({ error: 'Review not found' });
      }

      broadcast({
        type: 'ata_review_updated',
        review: updatedReview
      });

      res.json(updatedReview);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error updating ATA review:', error);
      res.status(500).json({ error: 'Failed to update ATA review' });
    }
  });

  // Delete ATA review
  app.delete('/api/ata-reviews/:id', async (req: Request, res: Response) => {
    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        return res.status(400).json({ error: 'Invalid review ID' });
      }

      const [deletedReview] = await db.delete(ataReviews).where(eq(ataReviews.id, reviewId)).returning();

      if (!deletedReview) {
        return res.status(404).json({ error: 'Review not found' });
      }

      broadcast({
        type: 'ata_review_deleted',
        reviewId: reviewId
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting ATA review:', error);
      res.status(500).json({ error: 'Failed to delete ATA review' });
    }
  });

  // MIGRATION ROUTES

  // Migrate localStorage data to database
  app.post('/api/migrate', async (req: Request, res: Response) => {
    try {
      const { data } = req.body;
      let migratedCount = 0;

      if (data.forms && Array.isArray(data.forms)) {
        for (const form of data.forms) {
          try {
            const validatedForm = insertAuditFormSchema.parse({
              name: form.name,
              sections: form.sections,
              createdBy: form.createdBy || null
            });
            
            await db.insert(auditForms).values(validatedForm).onConflictDoNothing();
            migratedCount++;
          } catch (error) {
            console.error('Error migrating form:', error);
          }
        }
      }

      if (data.reports && Array.isArray(data.reports)) {
        for (const report of data.reports) {
          try {
            const validatedReport = insertAuditReportSchema.parse({
              auditId: report.auditId || report.id,
              formName: report.formName,
              agent: report.agent,
              agentId: report.agentId,
              auditor: null,
              auditorName: report.auditorName || report.auditor || 'Unknown',
              sectionAnswers: report.answers || report.sectionAnswers || [],
              score: report.score || 0,
              maxScore: report.maxScore || 0,
              hasFatal: report.hasFatal || false,
              status: report.status || 'completed'
            });
            
            await db.insert(auditReports).values(validatedReport).onConflictDoNothing();
            migratedCount++;
          } catch (error) {
            console.error('Error migrating report:', error);
          }
        }
      }

      res.json({
        success: true,
        message: `Migrated ${migratedCount} items to database`,
        migratedCount
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ error: 'Failed to migrate data' });
    }
  });

  // Dashboard route - get summary data
  app.get('/api/dashboard', async (req: Request, res: Response) => {
    try {
      const [formsCount] = await db.select().from(auditForms);
      const [reportsCount] = await db.select().from(auditReports);
      const [reviewsCount] = await db.select().from(ataReviews);
      const [usersCount] = await db.select().from(users);

      res.json({
        forms: formsCount?.length || 0,
        reports: reportsCount?.length || 0,
        reviews: reviewsCount?.length || 0,
        users: usersCount?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Database initialization route
  app.post('/api/init-db', async (req: Request, res: Response) => {
    try {
      // Check if admin user exists
      const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin'));
      
      if (existingAdmin.length === 0) {
        await db.insert(users).values({
          username: 'admin',
          password: await hashPassword('admin123'),
          rights: ['admin', 'manager', 'team_leader', 'auditor'],
          isInactive: false
        });
      }

      // Check if default user exists
      const existingUser = await db.select().from(users).where(eq(users.username, 'Abhishek'));
      
      if (existingUser.length === 0) {
        await db.insert(users).values({
          username: 'Abhishek',
          password: await hashPassword('1234'),
          rights: ['auditor'],
          isInactive: false
        });
      }

      res.json({ success: true, message: 'Database initialized successfully' });
    } catch (error) {
      console.error('Database initialization error:', error);
      res.status(500).json({ error: 'Failed to initialize database' });
    }
  });

  return httpServer;
}
  
  // Update user
  app.patch('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const userData = req.body;
      
      // First check if user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Protect the admin user - ensure admin always has all rights
      if (existingUser.username === 'admin') {
        // For the admin user, make sure all rights are assigned
        const allAdminRights = [
          "admin", "manager", "teamleader", "audit", "ata", "reports", 
          "dashboard", "buildForm", "userManage", "createLowerUsers", 
          "masterAuditor", "debug", "deleteForm", "editForm", "createForm",
          "superAdmin"
        ];

        // Always override all rights for admin user
        userData.rights = allAdminRights;
        
        // Never allow admin to be deactivated
        userData.isInactive = false;
        
        console.log('Admin user protected - ensured all rights are assigned and user remains active');
      }
      
      const updatedUser = await storage.updateUser(userId, userData);
      
      // CRITICAL: Also update the user in localStorage for UI consistency and
      // to ensure permissions persist across sessions
      try {
        const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
        const localUserIndex = qaUsers.findIndex((u: any) => u.id === userId);
        
        if (localUserIndex !== -1) {
          // Get the current localStorage record
          const localUser = qaUsers[localUserIndex];
          
          // Update only the fields that were modified
          const updatedLocalUser = {
            ...localUser,
            ...userData
          };
          
          // Important: Don't modify the password field since it's stored in plaintext
          if (userData.password) {
            console.log(`Preserving original plaintext password for user ${existingUser.username} in localStorage`);
            // Keep the original plaintext password
            updatedLocalUser.password = localUser.password;
          }
          
          // Update the user in the local array
          qaUsers[localUserIndex] = updatedLocalUser;
          
          // Save the updated array back to localStorage
          storage.getLocalStorage().setItem('qa-users', JSON.stringify(qaUsers));
          console.log(`Updated user ${existingUser.username} permissions in localStorage for session persistence`);
        } else {
          console.warn(`User ${existingUser.username} not found in localStorage, couldn't update permissions`);
        }
      } catch (err) {
        console.error("Error synchronizing user update to localStorage:", err);
        // Continue even if localStorage update fails
      }
      
      res.json(updatedUser);
      
      // Broadcast user updated event
      broadcast({
        type: 'user_updated',
        data: { 
          id: updatedUser!.id,
          username: updatedUser!.username,
          rightsUpdated: userData.rights ? true : false
        }
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });
  
  // Delete user
  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // First check if user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Protect the admin user from deletion
      // Double protection based on both username and rights to ensure admin safety
      if (existingUser.username === 'admin' || 
          (existingUser.rights && Array.isArray(existingUser.rights) && existingUser.rights.includes('admin'))) {
        console.log('Prevented deletion of admin user');
        return res.status(403).json({ 
          error: 'Cannot delete admin user', 
          message: 'The admin user is protected and cannot be deleted for security reasons' 
        });
      }
      
      // Also remove user from localStorage for consistency
      try {
        const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
        const filteredUsers = qaUsers.filter((u: any) => u.id !== userId);
        
        // If we found and removed the user from localStorage
        if (qaUsers.length !== filteredUsers.length) {
          // Save updated array back to localStorage
          storage.getLocalStorage().setItem('qa-users', JSON.stringify(filteredUsers));
          console.log(`Deleted user ${existingUser.username} from localStorage for consistency`);
        }
      } catch (err) {
        console.error("Error removing user from localStorage:", err);
        // Continue even if localStorage update fails
      }
      
      // Now delete the user from server storage
      const result = await storage.deleteUser(userId);
      
      if (result) {
        res.status(204).send();
        
        // Broadcast user deleted event
        broadcast({
          type: 'user_deleted',
          data: { 
            id: userId,
            username: existingUser.username
          }
        });
      } else {
        res.status(500).json({ error: 'Failed to delete user' });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });
  
  // AUDIT FORM ROUTES
  
  // Get all forms
  app.get('/api/forms', async (req: Request, res: Response) => {
    try {
      const forms = await storage.getAllForms();
      res.json(forms);
    } catch (error) {
      console.error('Error fetching forms:', error);
      res.status(500).json({ error: 'Failed to fetch forms' });
    }
  });
  
  // Get form by ID
  app.get('/api/forms/:id', async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id, 10);
      const form = await storage.getForm(formId);
      
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      res.json(form);
    } catch (error) {
      console.error('Error fetching form:', error);
      res.status(500).json({ error: 'Failed to fetch form' });
    }
  });
  
  // Create new form
  app.post('/api/forms', async (req: Request, res: Response) => {
    try {
      const formInput = insertAuditFormSchema.parse(req.body);
      const newForm = await storage.createForm(formInput);
      res.status(201).json(newForm);
      
      // Broadcast form created event
      broadcast({
        type: 'form_created',
        data: { 
          id: newForm.id,
          name: newForm.name
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid form data',
          details: error.errors
        });
      }
      
      console.error('Error creating form:', error);
      res.status(500).json({ error: 'Failed to create form' });
    }
  });
  
  // Update form
  app.patch('/api/forms/:id', async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id, 10);
      const formData = req.body;
      
      // First check if form exists
      const existingForm = await storage.getForm(formId);
      if (!existingForm) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      const updatedForm = await storage.updateForm(formId, formData);
      res.json(updatedForm);
      
      // Broadcast form updated event
      broadcast({
        type: 'form_updated',
        data: { 
          id: updatedForm!.id,
          name: updatedForm!.name
        }
      });
    } catch (error) {
      console.error('Error updating form:', error);
      res.status(500).json({ error: 'Failed to update form' });
    }
  });
  
  // Delete form
  app.delete('/api/forms/:id', async (req: Request, res: Response) => {
    try {
      const formId = parseInt(req.params.id, 10);
      
      // First check if form exists
      const existingForm = await storage.getForm(formId);
      if (!existingForm) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      const result = await storage.deleteForm(formId);
      
      if (result) {
        res.status(204).send();
        
        // Broadcast form deleted event
        broadcast({
          type: 'form_deleted',
          data: { 
            id: formId,
            name: existingForm.name
          }
        });
      } else {
        res.status(500).json({ error: 'Failed to delete form' });
      }
    } catch (error) {
      console.error('Error deleting form:', error);
      res.status(500).json({ error: 'Failed to delete form' });
    }
  });
  
  // AUDIT REPORT ROUTES
  
  // Get all reports
  app.get('/api/reports', async (req: Request, res: Response) => {
    try {
      const reports = await storage.getAllReports();
      res.json(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });
  
  // Get reports by auditor
  app.get('/api/reports/auditor/:id', async (req: Request, res: Response) => {
    try {
      const auditorId = parseInt(req.params.id, 10);
      const reports = await storage.getReportsByAuditor(auditorId);
      res.json(reports);
    } catch (error) {
      console.error('Error fetching reports by auditor:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });
  
  // Get report by ID
  app.get('/api/reports/:id', async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      const report = await storage.getReport(reportId);
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      res.json(report);
    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  });
  
  // Create new report
  app.post('/api/reports', async (req: Request, res: Response) => {
    try {
      const reportInput = insertAuditReportSchema.parse(req.body);
      const newReport = await storage.createReport(reportInput);
      res.status(201).json(newReport);
      
      // Broadcast report created event
      broadcast({
        type: 'report_created',
        data: { 
          id: newReport.id,
          auditId: newReport.auditId,
          agent: newReport.agent
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid report data',
          details: error.errors
        });
      }
      
      console.error('Error creating report:', error);
      res.status(500).json({ error: 'Failed to create report' });
    }
  });
  
  // Update report
  app.patch('/api/reports/:id', async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      const reportData = req.body;
      
      // First check if report exists
      const existingReport = await storage.getReport(reportId);
      if (!existingReport) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      const updatedReport = await storage.updateReport(reportId, reportData);
      res.json(updatedReport);
      
      // Broadcast report updated event
      broadcast({
        type: 'report_updated',
        data: { 
          id: updatedReport!.id,
          auditId: updatedReport!.auditId,
          agent: updatedReport!.agent
        }
      });
    } catch (error) {
      console.error('Error updating report:', error);
      res.status(500).json({ error: 'Failed to update report' });
    }
  });
  
  // Delete report
  app.delete('/api/reports/:id', async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      const deletedBy = parseInt(req.body.deletedBy, 10);
      
      if (!deletedBy) {
        return res.status(400).json({ error: 'deletedBy is required' });
      }
      
      // First check if report exists
      const existingReport = await storage.getReport(reportId);
      if (!existingReport) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      const result = await storage.deleteReport(reportId, deletedBy);
      
      if (result) {
        res.status(204).send();
        
        // Broadcast report deleted event
        broadcast({
          type: 'report_deleted',
          data: { 
            id: reportId,
            auditId: existingReport.auditId,
            agent: existingReport.agent
          }
        });
      } else {
        res.status(500).json({ error: 'Failed to delete report' });
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      res.status(500).json({ error: 'Failed to delete report' });
    }
  });
  
  // ATA REVIEW ROUTES
  
  // Get all ATA reviews
  app.get('/api/ata-reviews', async (req: Request, res: Response) => {
    try {
      const reviews = await storage.getAllAtaReviews();
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching ATA reviews:', error);
      res.status(500).json({ error: 'Failed to fetch ATA reviews' });
    }
  });
  
  // Get ATA review by ID
  app.get('/api/ata-reviews/:id', async (req: Request, res: Response) => {
    try {
      const reviewId = parseInt(req.params.id, 10);
      const review = await storage.getAtaReview(reviewId);
      
      if (!review) {
        return res.status(404).json({ error: 'ATA review not found' });
      }
      
      res.json(review);
    } catch (error) {
      console.error('Error fetching ATA review:', error);
      res.status(500).json({ error: 'Failed to fetch ATA review' });
    }
  });
  
  // Get ATA review by report ID
  app.get('/api/ata-reviews/report/:reportId', async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      const review = await storage.getAtaReviewByReportId(reportId);
      
      if (!review) {
        return res.status(404).json({ error: 'ATA review not found for this report' });
      }
      
      res.json(review);
    } catch (error) {
      console.error('Error fetching ATA review by report:', error);
      res.status(500).json({ error: 'Failed to fetch ATA review' });
    }
  });
  
  // Create new ATA review
  app.post('/api/ata-reviews', async (req: Request, res: Response) => {
    try {
      const reviewInput = insertAtaReviewSchema.parse(req.body);
      const newReview = await storage.createAtaReview(reviewInput);
      res.status(201).json(newReview);
      
      // Broadcast ATA review created event
      broadcast({
        type: 'ata_review_created',
        data: { 
          id: newReview.id,
          auditReportId: newReview.auditReportId,
          reviewerId: newReview.reviewerId
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid ATA review data',
          details: error.errors
        });
      }
      
      console.error('Error creating ATA review:', error);
      res.status(500).json({ error: 'Failed to create ATA review' });
    }
  });
  
  // Update ATA review
  app.patch('/api/ata-reviews/:id', async (req: Request, res: Response) => {
    try {
      const reviewId = parseInt(req.params.id, 10);
      const reviewData = req.body;
      
      // First check if review exists
      const existingReview = await storage.getAtaReview(reviewId);
      if (!existingReview) {
        return res.status(404).json({ error: 'ATA review not found' });
      }
      
      const updatedReview = await storage.updateAtaReview(reviewId, reviewData);
      res.json(updatedReview);
      
      // Broadcast ATA review updated event
      broadcast({
        type: 'ata_review_updated',
        data: { 
          id: updatedReview!.id,
          auditReportId: updatedReview!.auditReportId
        }
      });
    } catch (error) {
      console.error('Error updating ATA review:', error);
      res.status(500).json({ error: 'Failed to update ATA review' });
    }
  });
  
  // Delete ATA review
  app.delete('/api/ata-reviews/:id', async (req: Request, res: Response) => {
    try {
      const reviewId = parseInt(req.params.id, 10);
      
      // First check if review exists
      const existingReview = await storage.getAtaReview(reviewId);
      if (!existingReview) {
        return res.status(404).json({ error: 'ATA review not found' });
      }
      
      const result = await storage.deleteAtaReview(reviewId);
      
      if (result) {
        res.status(204).send();
        
        // Broadcast ATA review deleted event
        broadcast({
          type: 'ata_review_deleted',
          data: { 
            id: reviewId,
            auditReportId: existingReview.auditReportId
          }
        });
      } else {
        res.status(500).json({ error: 'Failed to delete ATA review' });
      }
    } catch (error) {
      console.error('Error deleting ATA review:', error);
      res.status(500).json({ error: 'Failed to delete ATA review' });
    }
  });
  
  // DATABASE STATUS ENDPOINT
  
  // Check database connection
  // User password route with localStorage sync
  app.patch('/api/users/password/:id', async (req: Request, res: Response) => {
    try {
      // Verify authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = parseInt(req.params.id);
      const { newPassword, oldPassword } = req.body;
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only admin users or the user themselves can change passwords
      const currentUser = req.user as any;
      const userRights = Array.isArray(currentUser.rights) ? currentUser.rights : [];
      
      if (currentUser.id !== userId && !userRights.includes('admin') && !userRights.includes('userManage')) {
        return res.status(403).json({ error: "You don't have permission to change this user's password" });
      }
      
      // For security, verify the old password if it's the user changing their own password
      // Skip this check for admin users who can reset passwords
      if (currentUser.id === userId && !userRights.includes('admin')) {
        const isOldPasswordValid = await comparePasswords(oldPassword, user.password);
        if (!isOldPasswordValid) {
          return res.status(400).json({ error: "Old password is incorrect" });
        }
      }
      
      // Update the password
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      
      // Always update localStorage for UI compatibility
      // Get existing users from localStorage
      const existingQaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
      const userIndex = existingQaUsers.findIndex((u: any) => u.id === userId);
      
      if (userIndex !== -1) {
        // Always update the password in localStorage regardless of user
        existingQaUsers[userIndex].password = newPassword;
        storage.getLocalStorage().setItem('qa-users', JSON.stringify(existingQaUsers));
        console.log(`Updated localStorage password for user ${user.username} (ID: ${userId})`);
      }
      
      // Special case for admin user to handle password synchronization issues
      if (user.username === 'admin') {
        console.log("Admin password change detected - cleaning up old passwords");
        
        // Instead of updating admin entries, filter out ALL admin entries
        const filteredUsers = existingQaUsers.filter((u: any) => u.username !== 'admin');
        
        // The admin user should have ALL rights without exception
        const allAdminRights = [
          "admin", "manager", "teamleader", "audit", "ata", "reports", 
          "dashboard", "buildForm", "userManage", "createLowerUsers", 
          "masterAuditor", "debug", "deleteForm", "editForm", "createForm",
          "superAdmin"
        ];
        
        // Then add back just one admin entry with the correct password and ALL rights
        filteredUsers.push({
          id: user.id,
          username: 'admin',
          password: newPassword,
          rights: allAdminRights,  // Always give admin ALL rights
          isInactive: false  // Never allow admin to be inactive
        });
        
        // Also update the admin user in storage with ALL rights
        await storage.updateUser(userId, { 
          rights: allAdminRights,
          isInactive: false
        });
        
        // Save the cleaned-up list
        storage.getLocalStorage().setItem('qa-users', JSON.stringify(filteredUsers));
        console.log("Special handling: Removed all old admin entries, created a single clean entry with full rights");
      }
      
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update password" });
      }
      
      // Omit password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ message: "Password updated successfully", user: userWithoutPassword });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Debug routes for localStorage inspection and management
  app.get('/api/debug/localstorage/:key', async (req: Request, res: Response) => {
    try {
      
      const key = req.params.key;
      const data = storage.getLocalStorage().getItem(key);
      
      if (data === null) {
        return res.status(404).json({ error: `No data found for key: ${key}` });
      }
      
      // If it's JSON data, parse it before returning
      try {
        const jsonData = JSON.parse(data);
        return res.json({ key, data: jsonData });
      } catch {
        // If not valid JSON, return as string
        return res.json({ key, data });
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      res.status(500).json({ error: "Failed to access localStorage" });
    }
  });
  
  // Add a debug endpoint to test admin password logic
  app.post('/api/debug/check-admin-password', async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      // Get admin user from server storage
      const adminUser = await storage.getUserByUsername('admin');
      if (!adminUser) {
        return res.status(404).json({ error: "Admin user not found in database" });
      }
      
      // Get all admin entries from localStorage
      const qaUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
      const adminUsers = qaUsers.filter((u: any) => u.username === 'admin');
      
      // Check if the provided password would match any admin password
      const result = {
        password,
        adminUsersCount: adminUsers.length,
        hashMatch: await comparePasswords(password, adminUser.password, 'admin'),
        directMatches: adminUsers.filter((u: any) => u.password === password).length,
        allAdminPasswords: adminUsers.map((u: any) => u.password)
      };
      
      res.json(result);
    } catch (error) {
      console.error("Error checking admin password:", error);
      res.status(500).json({ error: "Failed to check admin password" });
    }
  });
  
  // Fix localStorage users (publicly accessible for emergency use)
  app.post('/api/debug/fix-users', async (req: Request, res: Response) => {
    try {
      // Check if direct data update was provided
      if (req.body && req.body.data && Array.isArray(req.body.data)) {
        console.log("Direct user data update received");
        
        // Update localStorage directly with provided data
        storage.getLocalStorage().setItem('qa-users', JSON.stringify(req.body.data));
        
        res.json({ 
          message: "User data synchronized between storage and localStorage",
          count: req.body.data.length 
        });
        return;
      }
      
      // Otherwise, perform standard synchronization
      // Get all users from storage
      const storageUsers = await storage.getAllUsers();
      
      // Get localStorage users
      const localStorageUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
      
      // Fix localStorage users based on storage users
      const updatedLocalStorageUsers = storageUsers.map(user => {
        // Find matching localStorage user if exists
        const localUser = localStorageUsers.find((lu: any) => lu.id === user.id);
        
        return {
          id: user.id,
          username: user.username,
          // Use localStorage password if available, otherwise use a default
          password: localUser ? localUser.password : 'password',
          rights: user.rights,
          isInactive: user.isInactive
        };
      });
      
      // Update localStorage
      storage.getLocalStorage().setItem('qa-users', JSON.stringify(updatedLocalStorageUsers));
      
      res.json({ 
        message: "User data synchronized between storage and localStorage",
        count: updatedLocalStorageUsers.length 
      });
    } catch (error) {
      console.error("Error fixing users:", error);
      res.status(500).json({ error: "Failed to fix users" });
    }
  });
  
  // Fix admin user password (publicly accessible for emergency use)
  app.post('/api/debug/reset-admin', async (req: Request, res: Response) => {
    try {
      // Get admin user from storage
      const adminUser = await storage.getUserByUsername('admin');
      
      if (!adminUser) {
        // Create admin user if not exists
        const newAdminUser = await storage.createUser({
          username: 'admin',
          password: await hashPassword('admin123'),
          rights: ["admin", "manager", "teamleader", "audit", "ata", "reports", "dashboard", "buildForm", "userManage", "createLowerUsers", "masterAuditor", "debug"],
          isInactive: false
        });
        
        // Update localStorage
        const existingUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
        const adminIndex = existingUsers.findIndex((u: any) => u.username === 'admin');
        
        if (adminIndex !== -1) {
          // Update existing localStorage entry
          existingUsers[adminIndex] = {
            id: newAdminUser.id,
            username: 'admin',
            password: 'admin123',
            rights: newAdminUser.rights,
            isInactive: false
          };
        } else {
          // Add new entry
          existingUsers.push({
            id: newAdminUser.id,
            username: 'admin',
            password: 'admin123',
            rights: newAdminUser.rights,
            isInactive: false
          });
        }
        
        storage.getLocalStorage().setItem('qa-users', JSON.stringify(existingUsers));
        
        return res.json({ 
          message: "Admin user created", 
          username: 'admin',
          password: 'admin123'
        });
      }
      
      // The admin user should have ALL rights without exception
      const allAdminRights = [
        "admin", "manager", "teamleader", "audit", "ata", "reports", 
        "dashboard", "buildForm", "userManage", "createLowerUsers", 
        "masterAuditor", "debug", "deleteForm", "editForm", "createForm",
        "superAdmin"
      ];

      // Reset admin password and ensure ALL rights
      const updatedAdmin = await storage.updateUser(adminUser.id, {
        password: await hashPassword('admin123'),
        isInactive: false,
        rights: allAdminRights  // Always give admin ALL rights
      });
      
      // Update localStorage - remove ALL admin entries and create a single clean one
      const existingUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
      
      // First, filter out all admin users
      const nonAdminUsers = existingUsers.filter((u: any) => u.username !== 'admin');
      
      // Then add a single clean admin entry with ALL rights
      nonAdminUsers.push({
        id: adminUser.id,
        username: 'admin',
        password: 'admin123',
        rights: allAdminRights, // Always use the full admin rights list
        isInactive: false
      });
      
      // Save the cleaned list
      storage.getLocalStorage().setItem('qa-users', JSON.stringify(nonAdminUsers));
      console.log("Removed all duplicate admin entries, created a single clean entry");
      
      res.json({ 
        message: "Admin password reset", 
        username: 'admin',
        password: 'admin123'
      });
    } catch (error) {
      console.error("Error resetting admin:", error);
      res.status(500).json({ error: "Failed to reset admin user" });
    }
  });
  
  // Update localStorage admin password to match admin123
  app.post('/api/debug/sync-admin-password', async (req: Request, res: Response) => {
    try {
      // Get admin user from storage
      const adminUser = await storage.getUserByUsername('admin');
      if (!adminUser) {
        return res.status(404).json({ error: "Admin user not found in database" });
      }
      
      // Get localStorage users
      const existingUsers = JSON.parse(storage.getLocalStorage().getItem('qa-users') || '[]');
      
      // Filter out all admin users
      const filteredUsers = existingUsers.filter((u: any) => u.username !== 'admin');
      
      // The admin user should have ALL rights without exception
      const allAdminRights = [
        "admin", "manager", "teamleader", "audit", "ata", "reports", 
        "dashboard", "buildForm", "userManage", "createLowerUsers", 
        "masterAuditor", "debug", "deleteForm", "editForm", "createForm",
        "superAdmin"
      ];
      
      // Also update admin in storage with ALL rights
      await storage.updateUser(adminUser.id, { 
        rights: allAdminRights,
        isInactive: false
      });
      
      // Add back a single clean admin entry with ALL rights
      filteredUsers.push({
        id: adminUser.id,
        username: 'admin',
        password: 'admin123',  // Set to default password
        rights: allAdminRights,  // Always use all admin rights
        isInactive: false  // Never allow admin to be inactive
      });
      
      // Save the cleaned list
      storage.getLocalStorage().setItem('qa-users', JSON.stringify(filteredUsers));
      console.log("Removed all duplicate admin entries, created a single clean entry");
      
      res.json({ 
        message: "Admin password synchronized to admin123", 
        username: 'admin',
        password: 'admin123'
      });
    } catch (error) {
      console.error('Error syncing admin password:', error);
      res.status(500).json({ error: "Failed to sync admin password" });
    }
  });

  // Get all sessions (admin only) - shows both active and offline users
  app.get('/api/sessions', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Make sure user has admin rights
      const currentUser = req.user as any;
      if (!currentUser.rights || !Array.isArray(currentUser.rights) || !currentUser.rights.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      // Get all sessions from the store
      const store = req.sessionStore as any;
      
      if (!store || typeof store.all !== 'function') {
        return res.status(500).json({ 
          error: 'Session store not properly initialized',
          message: 'The session store is not available or does not support listing sessions'
        });
      }

      // First get all users from the database
      const allUsers = await storage.getAllUsers();
      
      // Filter out the admin user from session display
      const filteredUsers = allUsers.filter(user => user.username !== 'admin');
      
      // Check for any user login timestamps stored outside of sessions
      // This will help us track offline users' last login time
      const localStorage = storage.getLocalStorage();
      const lastLoginTimestamps = localStorage.getItem('userLoginTimestamps') 
        ? JSON.parse(localStorage.getItem('userLoginTimestamps')) 
        : {};
      
      // Create a map to track which users have active sessions
      const userSessionMap = new Map();
      
      // Get all sessions
      store.all((err: Error | null, sessions: Record<string, any>) => {
        if (err) {
          console.error('Error retrieving sessions:', err);
          return res.status(500).json({ error: 'Failed to retrieve sessions' });
        }
        
        // Process active sessions
        Object.entries(sessions || {}).forEach(([id, session]) => {
          const user = session?.passport?.user;
          const userObj = user ? { id: user } : null;
          
          // Get the actual user from storage if available
          if (userObj?.id) {
            try {
              const storedUser = allUsers.find(u => u.id === userObj.id);
              if (storedUser) {
                // Calculate if the session is active based on activity timestamp
                const lastActiveTime = new Date(session.lastActivity || session.cookie?.expires || Date.now());
                const isActive = (Date.now() - lastActiveTime.getTime()) < 15 * 60 * 1000; // Consider active if activity within 15 minutes
                
                // Store this session info for the user
                userSessionMap.set(userObj.id, {
                  id: id,
                  userId: userObj.id,
                  username: storedUser.username,
                  lastActive: lastActiveTime.toISOString(),
                  userAgent: session.userAgent || 'Unknown',
                  ip: session.ip || 'Unknown',
                  isCurrentSession: id === req.sessionID,
                  status: isActive ? 'online' : 'offline'
                });
              }
            } catch (e) {
              console.error('Error getting user details for session:', e);
            }
          }
        });
        
        // Create result array with filtered users (both online and offline)
        // Using filteredUsers instead of allUsers to hide admin user
        const processedSessions = filteredUsers.map(user => {
          // If user has an active session, return that data
          if (userSessionMap.has(user.id)) {
            return userSessionMap.get(user.id);
          }
          
          // Otherwise, return user with offline status
          // Check for last login timestamp from localStorage
          const lastLoginTime = lastLoginTimestamps[user.id]
            ? new Date(lastLoginTimestamps[user.id]).toISOString()
            : null;
          
          return {
            id: `offline-${user.id}`,  // Special ID for offline users
            userId: user.id,
            username: user.username,
            lastActive: lastLoginTime,  // Use stored last login timestamp if available
            userAgent: 'N/A',
            ip: 'N/A',
            isCurrentSession: false,
            status: 'offline'
          };
        });
        
        // Sort by status (online first) then by username
        processedSessions.sort((a, b) => {
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (a.status !== 'online' && b.status === 'online') return 1;
          return a.username.localeCompare(b.username);
        });
        
        res.json(processedSessions);
      });
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch session data' });
    }
  });
  
  // Remove a specific session (admin only or own session)
  app.delete('/api/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const sessionId = req.params.sessionId;
      const currentUser = req.user as any;
      const isAdmin = currentUser.rights && Array.isArray(currentUser.rights) && currentUser.rights.includes('admin');
      
      // Get the session to check if it belongs to the current user
      const store = req.sessionStore as any;
      
      if (!store || typeof store.get !== 'function' || typeof store.destroy !== 'function') {
        return res.status(500).json({ error: 'Session store not properly initialized' });
      }
      
      store.get(sessionId, (err: Error | null, session: any) => {
        if (err) {
          console.error('Error retrieving session:', err);
          return res.status(500).json({ error: 'Failed to retrieve session' });
        }
        
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
        
        const sessionUserId = session?.passport?.user;
        
        // Only allow admins or the session owner to delete a session
        if (!isAdmin && sessionUserId !== currentUser.id) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'You can only manage your own sessions unless you are an admin' 
          });
        }
        
        // If this is the current user's session, don't allow deletion as it would log them out
        if (sessionId === req.sessionID) {
          return res.status(400).json({ 
            error: 'Cannot delete current session', 
            message: 'You cannot delete your current active session. Use logout instead.'
          });
        }
        
        // Delete the session
        store.destroy(sessionId, (destroyErr: Error | null) => {
          if (destroyErr) {
            console.error('Error destroying session:', destroyErr);
            return res.status(500).json({ error: 'Failed to destroy session' });
          }
          
          // Log the event
          console.log(`Session ${sessionId} deleted by user ${currentUser.username} (${currentUser.id})`);
          
          res.status(200).json({ 
            message: 'Session removed successfully',
            sessionId
          });
          
          // Broadcast session deleted event
          broadcast({
            type: 'session_deleted',
            data: { 
              sessionId,
              deletedBy: currentUser.id
            }
          });
        });
      });
    } catch (error) {
      console.error('Error removing session:', error);
      res.status(500).json({ error: 'Failed to remove session' });
    }
  });
  
  // Remove all other sessions for a user (admin only or own sessions)
  app.delete('/api/sessions/user/:userId', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const targetUserId = parseInt(req.params.userId, 10);
      const currentUser = req.user as any;
      const isAdmin = currentUser.rights && Array.isArray(currentUser.rights) && currentUser.rights.includes('admin');
      
      // Only allow admins or the user themselves to delete their sessions
      if (!isAdmin && targetUserId !== currentUser.id) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only manage your own sessions unless you are an admin' 
        });
      }
      
      // Get the store
      const store = req.sessionStore as any;
      
      if (!store || typeof store.all !== 'function' || typeof store.destroy !== 'function') {
        return res.status(500).json({ error: 'Session store not properly initialized' });
      }
      
      // Get all sessions
      store.all((err: Error | null, sessions: Record<string, any>) => {
        if (err) {
          console.error('Error retrieving sessions:', err);
          return res.status(500).json({ error: 'Failed to retrieve sessions' });
        }
        
        const sessionsToDelete: string[] = [];
        const currentSessionId = req.sessionID;
        
        // Find sessions for the target user
        Object.entries(sessions || {}).forEach(([id, session]) => {
          const sessionUserId = session?.passport?.user;
          
          // Only include sessions for the target user and exclude current session
          if (sessionUserId === targetUserId && id !== currentSessionId) {
            sessionsToDelete.push(id);
          }
        });
        
        if (sessionsToDelete.length === 0) {
          return res.json({ 
            message: 'No other sessions found for this user',
            sessionsDeleted: 0 
          });
        }
        
        // Track how many sessions we've processed
        let processed = 0;
        let errors = 0;
        
        // Delete each session
        sessionsToDelete.forEach(sessionId => {
          store.destroy(sessionId, (destroyErr: Error | null) => {
            processed++;
            
            if (destroyErr) {
              console.error(`Error destroying session ${sessionId}:`, destroyErr);
              errors++;
            }
            
            // When all sessions have been processed, return the result
            if (processed === sessionsToDelete.length) {
              const message = errors > 0 
                ? `Removed ${processed - errors} sessions with ${errors} errors`
                : `All ${processed} sessions removed successfully`;
              
              res.json({ 
                message,
                sessionsDeleted: processed - errors,
                errors
              });
              
              // Log the event
              console.log(`${processed - errors} sessions deleted for user ID ${targetUserId} by ${currentUser.username} (${currentUser.id})`);
              
              // Broadcast sessions deleted event
              broadcast({
                type: 'sessions_batch_deleted',
                data: { 
                  userId: targetUserId,
                  count: processed - errors,
                  deletedBy: currentUser.id
                }
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Error removing user sessions:', error);
      res.status(500).json({ error: 'Failed to remove user sessions' });
    }
  });

  app.get('/api/database/status', async (req: Request, res: Response) => {
    try {
      // Try to query the database to check connection
      const users = await storage.getAllUsers();
      
      res.json({
        status: 'connected',
        timestamp: new Date().toISOString(),
        tables: {
          users: true,
          auditForms: true,
          auditReports: true,
          ataReviews: true,
          deletedAudits: true,
          skippedSamples: true
        }
      });
    } catch (error) {
      console.error('Database connection error:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Database connection error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AUDIT SAMPLES ROUTES
  
  // Delete all audit samples (admin only)
  app.delete('/api/audit-samples', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin can delete all samples
      const isAdmin = req.user.rights && Array.isArray(req.user.rights) && req.user.rights.includes('admin');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Not authorized to delete all samples' });
      }
      
      // Reset to empty arrays
      const localStorage = storage.getLocalStorage();
      localStorage.setItem('qa-audit-samples', JSON.stringify([]));
      localStorage.setItem('qa-assigned-samples', JSON.stringify([]));
      localStorage.setItem('qa-in-progress-audits', JSON.stringify([]));
      localStorage.setItem('qa-completed-audits', JSON.stringify([]));
      localStorage.setItem('qa-submitted-audits', JSON.stringify([]));
      localStorage.setItem('qa-reports', JSON.stringify([]));
      
      // No need to reset memory objects as they'll be reloaded from localStorage
      // on the next API call
      
      res.status(200).json({ message: 'All audit samples deleted successfully' });
    } catch (error) {
      console.error('Error deleting all audit samples:', error);
      res.status(500).json({ error: 'Failed to delete all audit samples' });
    }
  });
  
  // Get all audit samples
  app.get('/api/audit-samples', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const samples = await storage.getAllAuditSamples();
      res.json(samples);
    } catch (error) {
      console.error('Error fetching audit samples:', error);
      res.status(500).json({ error: 'Failed to fetch audit samples' });
    }
  });
  
  // Get audit samples by status
  app.get('/api/audit-samples/status/:status', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const status = req.params.status as "available" | "assigned" | "inProgress" | "completed";
      
      // Validate the status parameter
      if (!['available', 'assigned', 'inProgress', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status parameter. Must be one of: available, assigned, inProgress, completed' });
      }
      
      const samples = await storage.getAuditSamplesByStatus(status);
      res.json(samples);
    } catch (error) {
      console.error('Error fetching audit samples by status:', error);
      res.status(500).json({ error: 'Failed to fetch audit samples' });
    }
  });
  
  // Get audit samples assigned to a specific auditor
  app.get('/api/audit-samples/auditor/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const auditorId = parseInt(req.params.id, 10);
      const samples = await storage.getAuditSamplesByAuditor(auditorId);
      res.json(samples);
    } catch (error) {
      console.error('Error fetching audit samples by auditor:', error);
      res.status(500).json({ error: 'Failed to fetch audit samples' });
    }
  });
  
  // Get a specific audit sample
  app.get('/api/audit-samples/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const id = parseInt(req.params.id, 10);
      const sample = await storage.getAuditSample(id);
      
      if (!sample) {
        return res.status(404).json({ error: 'Audit sample not found' });
      }
      
      res.json(sample);
    } catch (error) {
      console.error('Error fetching audit sample:', error);
      res.status(500).json({ error: 'Failed to fetch audit sample' });
    }
  });
  
  // Create a new audit sample
  app.post('/api/audit-samples', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin/manager/teamleader can create samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Set the uploader
      req.body.uploadedBy = req.user.id;
      
      const sample = await storage.createAuditSample(req.body);
      res.status(201).json(sample);
    } catch (error) {
      console.error('Error creating audit sample:', error);
      res.status(500).json({ error: 'Failed to create audit sample' });
    }
  });
  
  // Create multiple audit samples
  app.post('/api/audit-samples/bulk', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin/manager/teamleader can create samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Validate the request body
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Request body must be an array of samples' });
      }
      
      // Set the uploader for each sample
      const samples = req.body.map(sample => ({
        ...sample,
        uploadedBy: req.user.id
      }));
      
      const createdSamples = await storage.createBulkAuditSamples(samples);
      res.status(201).json(createdSamples);
    } catch (error) {
      console.error('Error creating bulk audit samples:', error);
      res.status(500).json({ error: 'Failed to create bulk audit samples' });
    }
  });
  
  // Update an audit sample
  app.patch('/api/audit-samples/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const id = parseInt(req.params.id, 10);
      const sample = await storage.getAuditSample(id);
      
      if (!sample) {
        return res.status(404).json({ error: 'Audit sample not found' });
      }
      
      // Only admin/manager/teamleader or the assigned auditor can update
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      const isAssignedAuditor = sample.assignedTo === req.user.id;
      
      if (!(isAdmin || isManager || isTeamLeader || isAssignedAuditor)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const updatedSample = await storage.updateAuditSample(id, req.body);
      res.json(updatedSample);
    } catch (error) {
      console.error('Error updating audit sample:', error);
      res.status(500).json({ error: 'Failed to update audit sample' });
    }
  });
  
  // Delete an audit sample
  app.delete('/api/audit-samples/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin/manager/teamleader can delete samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const sampleId = req.params.id;
      
      // Log the sample ID for debugging
      console.log(`Attempting to delete sample with ID: ${sampleId}`);
      
      // First, try to find the sample in the audit samples
      const samples = JSON.parse(storage.getLocalStorage().getItem('qa-audit-samples') || '[]');
      let sample = samples.find((s: any) => s.id === sampleId);
      
      // If not found, try other collections before returning 404
      if (!sample) {
        // Log this for debugging
        console.log(`Sample not found in main audit samples collection. Checking other collections...`);
        
        // Check other collections to find the sample
        for (const key of ['qa-assigned-samples', 'qa-in-progress-audits', 'qa-completed-audits', 'qa-skipped-samples']) {
          const collection = JSON.parse(storage.getLocalStorage().getItem(key) || '[]');
          const foundSample = collection.find((s: any) => s.id === sampleId);
          if (foundSample) {
            sample = foundSample;
            console.log(`Found sample in collection: ${key}`);
            break;
          }
        }
        
        // If still not found, return 404
        if (!sample) {
          return res.status(404).json({ error: 'Audit sample not found in any collection' });
        }
      }
      
      // Remove from main localStorage collection
      const updatedSamples = samples.filter((s: any) => s.id !== sampleId);
      storage.getLocalStorage().setItem('qa-audit-samples', JSON.stringify(updatedSamples));
      
      // Also check and update other collections
      ['qa-assigned-samples', 'qa-in-progress-audits', 'qa-completed-audits', 'qa-skipped-samples'].forEach(key => {
        try {
          const items = JSON.parse(storage.getLocalStorage().getItem(key) || '[]');
          const updatedItems = items.filter((s: any) => s.id !== sampleId);
          storage.getLocalStorage().setItem(key, JSON.stringify(updatedItems));
        } catch (err) {
          console.error(`Error cleaning up ${key}:`, err);
        }
      });
      
      // Return success
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting audit sample:', error);
      res.status(500).json({ error: 'Failed to delete audit sample' });
    }
  });
  
  // Assign audit sample to an auditor
  app.post('/api/audit-samples/:id/assign/:auditorId', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin/manager/teamleader can assign samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const sampleId = parseInt(req.params.id, 10);
      const auditorId = parseInt(req.params.auditorId, 10);
      
      const assignedSample = await storage.assignAuditSampleToAuditor(sampleId, auditorId);
      
      if (!assignedSample) {
        return res.status(400).json({ error: 'Failed to assign sample' });
      }
      
      res.json(assignedSample);
    } catch (error) {
      console.error('Error assigning audit sample:', error);
      res.status(500).json({ error: 'Failed to assign audit sample' });
    }
  });
  
  // Bulk assign audit samples to auditors using fair distribution algorithm
  app.post('/api/audit-samples/bulk-assign', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin/manager/teamleader can assign samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Validate the request body
      if (!req.body.sampleIds || !Array.isArray(req.body.sampleIds) || !req.body.sampleIds.length) {
        return res.status(400).json({ error: 'sampleIds array is required' });
      }
      
      if (!req.body.auditorIds || !Array.isArray(req.body.auditorIds) || !req.body.auditorIds.length) {
        return res.status(400).json({ error: 'auditorIds array is required' });
      }
      
      // Execute the enhanced random assignment algorithm
      const result = await storage.bulkAssignSamplesToAuditors(
        req.body.sampleIds,
        req.body.auditorIds
      );
      
      // Add metadata about the assignment process for transparency
      const enhancedResult = {
        ...result,
        details: {
          timestamp: new Date().toISOString(),
          distributionMode: new Date().getTime() % 3,
          sampleCount: req.body.sampleIds.length,
          auditorCount: req.body.auditorIds.length,
          assignmentStrategy: 'enhanced-fisher-yates',
          randomStartPoint: true,
          message: 'Using enhanced random distribution algorithm with multiple patterns for truly fair assignment'
        }
      };
      
      res.json(enhancedResult);
    } catch (error) {
      console.error('Error bulk assigning audit samples:', error);
      res.status(500).json({ error: 'Failed to bulk assign audit samples' });
    }
  });
  
  // SKIPPED SAMPLES ROUTES
  
  // Get all skipped samples
  app.get('/api/skipped-samples', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Only admin/manager/teamleader can view skipped samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (isAdmin || isManager || isTeamLeader) {
        const samples = await storage.getAllSkippedSamples();
        return res.json(samples);
      } 
      // Regular auditors cannot view skipped samples
      else {
        return res.status(403).json({ error: 'Access denied' });
      }
    } catch (error) {
      console.error('Error fetching skipped samples:', error);
      res.status(500).json({ error: 'Failed to fetch skipped samples' });
    }
  });
  
  // Get skipped samples by auditor
  app.get('/api/skipped-samples/auditor/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin/manager/teamleader can view skipped samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const auditorId = parseInt(req.params.id, 10);
      const samples = await storage.getSkippedSamplesByAuditor(auditorId);
      res.json(samples);
    } catch (error) {
      console.error('Error fetching skipped samples by auditor:', error);
      res.status(500).json({ error: 'Failed to fetch skipped samples' });
    }
  });
  
  // Get skipped sample by ID
  app.get('/api/skipped-samples/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Only admin/manager/teamleader can view skipped samples
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const sampleId = parseInt(req.params.id, 10);
      const sample = await storage.getSkippedSample(sampleId);
      
      if (!sample) {
        return res.status(404).json({ error: 'Skipped sample not found' });
      }
      
      res.json(sample);
    } catch (error) {
      console.error('Error fetching skipped sample:', error);
      res.status(500).json({ error: 'Failed to fetch skipped sample' });
    }
  });
  
  // Create new skipped sample
  app.post('/api/skipped-samples', async (req: Request, res: Response) => {
    try {
      const sampleInput = insertSkippedSampleSchema.parse(req.body);
      const newSample = await storage.createSkippedSample(sampleInput);
      res.status(201).json(newSample);
      
      // Broadcast sample created event
      broadcast({
        type: 'skipped_sample_created',
        data: { 
          id: newSample.id,
          auditId: newSample.auditId,
          agent: newSample.agent,
          reason: newSample.reason
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid skipped sample data',
          details: error.errors
        });
      }
      
      console.error('Error creating skipped sample:', error);
      res.status(500).json({ error: 'Failed to create skipped sample' });
    }
  });
  
  // Update skipped sample
  app.patch('/api/skipped-samples/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const sampleId = parseInt(req.params.id, 10);
      const sampleData = req.body;
      
      // First check if sample exists
      const existingSample = await storage.getSkippedSample(sampleId);
      if (!existingSample) {
        return res.status(404).json({ error: 'Skipped sample not found' });
      }
      
      // Check if user has permission to update this sample
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      // Only allow update if user is admin/manager/teamleader
      if (!(isAdmin || isManager || isTeamLeader)) {
        return res.status(403).json({ error: 'You do not have permission to update this sample' });
      }
      
      const updatedSample = await storage.updateSkippedSample(sampleId, sampleData);
      res.json(updatedSample);
      
      // Broadcast sample updated event
      broadcast({
        type: 'skipped_sample_updated',
        data: { 
          id: updatedSample!.id,
          reason: updatedSample!.reason
        }
      });
    } catch (error) {
      console.error('Error updating skipped sample:', error);
      res.status(500).json({ error: 'Failed to update skipped sample' });
    }
  });
  
  // Delete skipped sample
  app.delete('/api/skipped-samples/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const sampleId = parseInt(req.params.id, 10);
      
      // First check if sample exists
      const existingSample = await storage.getSkippedSample(sampleId);
      if (!existingSample) {
        return res.status(404).json({ error: 'Skipped sample not found' });
      }
      
      // Check if user has permission to delete this sample
      const isAdmin = req.user.rights.includes('admin');
      const isManager = req.user.rights.includes('manager');
      const isTeamLeader = req.user.rights.includes('teamleader');
      
      // Only allow delete if user is admin/manager/teamleader OR if the user is the auditor who created it
      if (!(isAdmin || isManager || isTeamLeader) && existingSample.auditor !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to delete this sample' });
      }
      
      const result = await storage.deleteSkippedSample(sampleId);
      
      if (result) {
        res.status(204).send();
        
        // Broadcast sample deleted event
        broadcast({
          type: 'skipped_sample_deleted',
          data: { 
            id: sampleId,
            auditId: existingSample.auditId
          }
        });
      } else {
        res.status(500).json({ error: 'Failed to delete skipped sample' });
      }
    } catch (error) {
      console.error('Error deleting skipped sample:', error);
      res.status(500).json({ error: 'Failed to delete skipped sample' });
    }
  });

  return httpServer;
}
