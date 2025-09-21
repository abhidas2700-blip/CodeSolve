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
  insertRebuttalSchema,
  users,
  auditForms,
  auditReports,
  ataReviews,
  deletedAudits,
  skippedSamples,
  auditSamples,
  rebuttals
} from "@shared/schema";
import { z } from "zod";
import { setupAuth, hashPassword } from "./auth";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { healthCheck } from "./health";

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
      message: 'Connected to SolveXtra server'
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin, manager, or users with createLowerUsers rights can view users list
    if (!user.rights.includes('admin') && 
        !user.rights.includes('manager') && 
        !user.rights.includes('createLowerUsers')) {
      return res.status(403).json({ error: 'Insufficient permissions to view users' });
    }
    
    try {
      const users = await storage.getAllUsers();
      
      // Remove password from response for security
      const sanitizedUsers = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  // Get user by ID
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const currentUser = req.user as any;
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Users can only view their own profile, or need admin/manager/createLowerUsers rights
    if (currentUser.id !== userId && 
        !currentUser.rights.includes('admin') && 
        !currentUser.rights.includes('manager') && 
        !currentUser.rights.includes('createLowerUsers')) {
      return res.status(403).json({ error: 'Insufficient permissions to view this user' });
    }

    try {
      // Use storage layer instead of direct database access
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // Create user
  app.post('/api/users', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const currentUser = req.user as any;
    
    // Only admin, manager, or users with createLowerUsers rights can create users
    if (!currentUser.rights.includes('admin') && 
        !currentUser.rights.includes('manager') && 
        !currentUser.rights.includes('createLowerUsers')) {
      return res.status(403).json({ error: 'Insufficient permissions to create users' });
    }
    
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

      // Remove password from response for security
      const { password: _, ...userWithoutPassword } = newUser;

      broadcast({
        type: 'user_created',
        user: { id: newUser.id, username: newUser.username, rights: newUser.rights }
      });

      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Update user (PATCH)
  app.patch('/api/users/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "You must be logged in to update users" });
      }
      
      const currentUser = req.user as any;
      const userRights = Array.isArray(currentUser.rights) ? currentUser.rights : [];
      
      // Check if current user has permission to update users
      if (!userRights.includes('admin') && 
          !userRights.includes('userManage') && 
          !userRights.includes('createLowerUsers')) {
        return res.status(403).json({ error: "You don't have permission to update users" });
      }
      
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Parse only the fields that are in the schema
      const { email, ...bodyWithoutEmail } = req.body;
      const validatedData = insertUserSchema.partial().parse(bodyWithoutEmail);
      
      // Add email to the validated data if it exists in the request
      const updateData = {
        ...validatedData,
        ...(email !== undefined ? { email: email } : {})
      };
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      // Use storage.updateUser for proper permission updates
      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      broadcast({
        type: 'user_updated',
        user: { id: updatedUser.id, username: updatedUser.username, rights: updatedUser.rights }
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
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
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "You must be logged in to delete users" });
      }
      
      const currentUser = req.user as any;
      const userRights = Array.isArray(currentUser.rights) ? currentUser.rights : [];
      
      // Check if current user has permission to delete users
      if (!userRights.includes('admin') && 
          !userRights.includes('userManage') && 
          !userRights.includes('createLowerUsers')) {
        return res.status(403).json({ error: "You don't have permission to delete users" });
      }
      
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Prevent deletion of the admin user
      if (userId === 1) {
        return res.status(403).json({ error: 'Cannot delete admin user' });
      }

      // Use storage layer for deletion
      const deleted = await storage.deleteUser(userId);

      if (!deleted) {
        return res.status(404).json({ error: 'User not found' });
      }

      broadcast({
        type: 'user_deleted',
        userId: userId
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // AUDIT FORMS ROUTES

  // Get all audit forms
  app.get('/api/forms', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin, buildForm, manager, teamleader, or audit users can view forms
    if (!user.rights.includes('admin') && 
        !user.rights.includes('buildForm') &&
        !user.rights.includes('manager') &&
        !user.rights.includes('teamleader') &&
        !user.rights.includes('audit')) {
      return res.status(403).json({ error: 'Insufficient permissions to view forms' });
    }
    
    try {
      const forms = await db.select().from(auditForms).orderBy(desc(auditForms.createdAt));
      res.json(forms);
    } catch (error) {
      console.error('Error fetching forms:', error);
      res.status(500).json({ error: 'Failed to fetch forms' });
    }
  });

  // Create audit form
  app.post('/api/forms', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin or buildForm users can create forms
    if (!user.rights.includes('admin') && !user.rights.includes('buildForm')) {
      return res.status(403).json({ error: 'Insufficient permissions to create forms' });
    }
    
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin or buildForm users can update forms
    if (!user.rights.includes('admin') && !user.rights.includes('buildForm')) {
      return res.status(403).json({ error: 'Insufficient permissions to update forms' });
    }
    
    try {
      const formId = parseInt(req.params.id);
      const validatedData = insertAuditFormSchema.parse(req.body);
      
      const [updatedForm] = await db.update(auditForms)
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin or buildForm users can delete forms
    if (!user.rights.includes('admin') && !user.rights.includes('buildForm')) {
      return res.status(403).json({ error: 'Insufficient permissions to delete forms' });
    }
    
    try {
      const formId = parseInt(req.params.id);
      
      const [deletedForm] = await db.delete(auditForms)
        .where(eq(auditForms.id, formId))
        .returning();

      if (!deletedForm) {
        return res.status(404).json({ error: 'Form not found' });
      }

      broadcast({
        type: 'form_deleted',
        formId: formId
      });

      res.json({ message: 'Form deleted successfully' });
    } catch (error) {
      console.error('Error deleting form:', error);
      res.status(500).json({ error: 'Failed to delete form' });
    }
  });

  // AUDIT REPORTS ROUTES

  // Get all audit reports
  app.get('/api/reports', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin, manager, teamleader, or audit-related users can view reports
    if (!user.rights.includes('admin') && 
        !user.rights.includes('manager') && 
        !user.rights.includes('teamleader') &&
        !user.rights.includes('audit') &&
        !user.rights.includes('buildForm')) {
      return res.status(403).json({ error: 'Insufficient permissions to view reports' });
    }
    
    try {
      const reports = await db.select().from(auditReports).orderBy(desc(auditReports.timestamp));
      res.json(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  // Alternative endpoint for audit reports (for compatibility)
  app.get('/api/audit-reports', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin, manager, teamleader, or audit-related users can view audit reports
    if (!user.rights.includes('admin') && 
        !user.rights.includes('manager') && 
        !user.rights.includes('teamleader') &&
        !user.rights.includes('audit') &&
        !user.rights.includes('buildForm')) {
      return res.status(403).json({ error: 'Insufficient permissions to view audit reports' });
    }
    
    try {
      const reports = await db.select().from(auditReports).orderBy(desc(auditReports.timestamp));
      res.json(reports);
    } catch (error) {
      console.error('Error fetching audit reports:', error);
      res.status(500).json({ error: 'Failed to fetch audit reports' });
    }
  });

  // Create audit report via /api/audit-reports (compatibility)
  app.post('/api/audit-reports', async (req: Request, res: Response) => {
    try {
      const validatedData = insertAuditReportSchema.parse(req.body);
      
      const [newReport] = await db.insert(auditReports).values({
        auditId: validatedData.auditId,
        formName: validatedData.formName,
        agent: validatedData.agent,
        agentId: validatedData.agentId,
        auditorName: validatedData.auditorName,
        partnerId: validatedData.partnerId,
        partnerName: validatedData.partnerName,
        sectionAnswers: validatedData.sectionAnswers || {},
        score: validatedData.score,
        maxScore: validatedData.maxScore,
        hasFatal: validatedData.hasFatal,
        status: validatedData.status
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
      console.error('Error creating audit report:', error);
      res.status(500).json({ error: 'Failed to create audit report' });
    }
  });

  // Create audit report
  app.post('/api/reports', async (req: Request, res: Response) => {
    try {
      const validatedData = insertAuditReportSchema.parse(req.body);
      
      const [newReport] = await db.insert(auditReports).values({
        auditId: validatedData.auditId,
        formName: validatedData.formName,
        agent: validatedData.agent,
        agentId: validatedData.agentId,
        auditorName: validatedData.auditorName,
        partnerId: validatedData.partnerId,
        partnerName: validatedData.partnerName,
        sectionAnswers: validatedData.sectionAnswers || {},
        score: validatedData.score,
        maxScore: validatedData.maxScore,
        hasFatal: validatedData.hasFatal,
        status: validatedData.status
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

  // Database initialization route
  app.post('/api/init-db', async (req: Request, res: Response) => {
    try {
      // Try database initialization first
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
        return;
      } catch (dbError) {
        console.warn('Database initialization failed, using localStorage fallback:', dbError);
        
        // Fallback to localStorage if database fails
        const localStorage = storage.getLocalStorage();
        const existingUsers = JSON.parse(localStorage.getItem('qa-users') || '[]');
        
        // Check if admin user exists in localStorage
        const adminExists = existingUsers.some((u: any) => u.username === 'admin');
        if (!adminExists) {
          const adminUser = {
            id: Date.now(),
            username: 'admin',
            password: await hashPassword('admin123'),
            rights: ['admin', 'manager', 'team_leader', 'auditor'],
            isInactive: false
          };
          existingUsers.push(adminUser);
        }
        
        // Check if default user exists in localStorage
        const abhishekExists = existingUsers.some((u: any) => u.username === 'Abhishek');
        if (!abhishekExists) {
          const defaultUser = {
            id: Date.now() + 1,
            username: 'Abhishek',
            password: await hashPassword('1234'),
            rights: ['auditor'],
            isInactive: false
          };
          existingUsers.push(defaultUser);
        }
        
        localStorage.setItem('qa-users', JSON.stringify(existingUsers));
        res.json({ success: true, message: 'Users initialized in localStorage (database unavailable)' });
      }
    } catch (error) {
      console.error('Complete initialization error:', error);
      res.status(500).json({ error: 'Failed to initialize database or localStorage' });
    }
  });

  // Database health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ 
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        error: String(error),
        timestamp: new Date().toISOString() 
      });
    }
  });

  // Database statistics endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const totalReports = await db.select({ count: sql`count(*)` })
        .from(auditReports)
        .where(eq(auditReports.deleted, false));

      const averageScore = await db.select({ avg: sql`avg(score)` })
        .from(auditReports)
        .where(eq(auditReports.deleted, false));

      const fatalCount = await db.select({ count: sql`count(*)` })
        .from(auditReports)
        .where(and(eq(auditReports.deleted, false), eq(auditReports.hasFatal, true)));

      res.json({
        totalReports: totalReports[0]?.count || 0,
        averageScore: averageScore[0]?.avg || 0,
        fatalCount: fatalCount[0]?.count || 0,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // SKIPPED SAMPLES ROUTES
  
  // Get all skipped samples
  app.get('/api/skipped-samples', async (req: Request, res: Response) => {
    console.log('GET /api/skipped-samples called');
    if (!req.user) {
      console.log('User not authenticated for skipped samples');
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const allSkippedSamples = await db.select().from(skippedSamples).orderBy(desc(skippedSamples.timestamp));
      res.json(allSkippedSamples);
    } catch (error) {
      console.error('Error fetching skipped samples:', error);
      res.status(500).json({ error: 'Failed to fetch skipped samples' });
    }
  });

  // Create skipped sample
  app.post('/api/skipped-samples', async (req: Request, res: Response) => {
    console.log('POST /api/skipped-samples called');
    if (!req.user) {
      console.log('User not authenticated for creating skipped sample');
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      console.log('Received skipped sample data:', req.body);
      const validatedData = insertSkippedSampleSchema.parse(req.body);
      console.log('Validated skipped sample data:', validatedData);
      
      const [newSkippedSample] = await db.insert(skippedSamples).values({
        ...validatedData,
        auditor: req.user?.id || null
      }).returning();

      console.log('Created skipped sample:', newSkippedSample);

      broadcast({
        type: 'skipped_sample_created',
        sample: newSkippedSample
      });

      res.status(201).json(newSkippedSample);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation errors for skipped sample:', error.errors);
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating skipped sample:', error);
      res.status(500).json({ error: 'Failed to create skipped sample' });
    }
  });

  // Delete skipped sample
  app.delete('/api/skipped-samples/:id', async (req: Request, res: Response) => {
    try {
      const sampleId = parseInt(req.params.id);
      
      const [deletedSample] = await db.delete(skippedSamples)
        .where(eq(skippedSamples.id, sampleId))
        .returning();

      if (!deletedSample) {
        return res.status(404).json({ error: 'Skipped sample not found' });
      }

      broadcast({
        type: 'skipped_sample_deleted',
        sampleId: sampleId
      });

      res.json({ message: 'Skipped sample deleted successfully' });
    } catch (error) {
      console.error('Error deleting skipped sample:', error);
      res.status(500).json({ error: 'Failed to delete skipped sample' });
    }
  });

  // DELETED AUDITS ROUTES
  
  // Get all deleted audits
  app.get('/api/deleted-audits', async (req: Request, res: Response) => {
    try {
      const allDeletedAudits = await db.select().from(deletedAudits).orderBy(desc(deletedAudits.deletedAt));
      res.json(allDeletedAudits);
    } catch (error) {
      console.error('Error fetching deleted audits:', error);
      res.status(500).json({ error: 'Failed to fetch deleted audits' });
    }
  });

  // Create deleted audit record (when audit is deleted)
  app.post('/api/deleted-audits', async (req: Request, res: Response) => {
    try {
      console.log('Received deleted audit data:', req.body);
      const validatedData = insertDeletedAuditSchema.parse(req.body);
      console.log('Validated deleted audit data:', validatedData);
      
      const [newDeletedAudit] = await db.insert(deletedAudits).values({
        originalId: validatedData.originalId || validatedData.auditId,
        auditId: validatedData.auditId,
        formName: validatedData.formName,
        agent: validatedData.agent,
        agentId: validatedData.agentId,
        auditorName: validatedData.auditorName,
        sectionAnswers: validatedData.sectionAnswers || {},
        score: validatedData.score,
        maxScore: validatedData.maxScore,
        hasFatal: validatedData.hasFatal || false,
        timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : new Date(),
        deletedBy: req.user?.id || 1,
        deletedByName: validatedData.deletedByName || req.user?.username || 'Unknown User',
        editHistory: validatedData.editHistory || {}
      }).returning();

      console.log('Created deleted audit:', newDeletedAudit);

      broadcast({
        type: 'audit_deleted',
        audit: newDeletedAudit
      });

      res.status(201).json(newDeletedAudit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation errors for deleted audit:', error.errors);
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating deleted audit record:', error);
      res.status(500).json({ error: 'Failed to create deleted audit record' });
    }
  });

  // ATA REVIEWS ROUTES
  
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
      const validatedData = insertAtaReviewSchema.parse(req.body);
      
      const [updatedReview] = await db.update(ataReviews)
        .set(validatedData)
        .where(eq(ataReviews.id, reviewId))
        .returning();

      if (!updatedReview) {
        return res.status(404).json({ error: 'ATA review not found' });
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

  // AUDIT SAMPLES ROUTES
  
  // Get all audit samples
  app.get('/api/audit-samples', async (req: Request, res: Response) => {
    try {
      const samples = await db.select().from(auditSamples).orderBy(desc(auditSamples.uploadedAt));
      res.json(samples);
    } catch (error) {
      console.error('Error fetching audit samples:', error);
      res.status(500).json({ error: 'Failed to fetch audit samples' });
    }
  });

  // Create audit sample
  app.post('/api/audit-samples', async (req: Request, res: Response) => {
    console.log('POST /api/audit-samples called with data:', req.body);
    if (!req.user) {
      console.log('User not authenticated for creating audit sample');
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const validatedData = insertAuditSampleSchema.parse(req.body);
      console.log('Validated audit sample data:', validatedData);
      
      const [newSample] = await db.insert(auditSamples).values({
        ...validatedData,
        assignedTo: validatedData.assignedTo || null
      }).returning();

      broadcast({
        type: 'audit_sample_created',
        sample: newSample
      });

      res.status(201).json(newSample);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating audit sample:', error);
      res.status(500).json({ error: 'Failed to create audit sample' });
    }
  });

  // Delete audit sample
  app.delete('/api/audit-samples/:auditId', async (req: Request, res: Response) => {
    try {
      const auditId = req.params.auditId;
      
      const [deletedSample] = await db.delete(auditSamples)
        .where(eq(auditSamples.sampleId, auditId))
        .returning();

      if (!deletedSample) {
        return res.status(404).json({ error: 'Audit sample not found' });
      }

      broadcast({
        type: 'audit_sample_deleted',
        auditId: auditId
      });

      res.json({ message: 'Audit sample deleted successfully' });
    } catch (error) {
      console.error('Error deleting audit sample:', error);
      res.status(500).json({ error: 'Failed to delete audit sample' });
    }
  });

  // Partner and Rebuttal Management Routes

  // Get audit reports assigned to current partner
  app.get('/api/partners/reports', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = req.user as any;

    // Only partners can access this endpoint
    if (!user.rights.includes('partner')) {
      return res.status(403).json({ error: 'Only partners can access this endpoint' });
    }

    try {
      const reports = await db.query.auditReports.findMany({
        where: and(
          eq(auditReports.partnerId, user.id),
          eq(auditReports.deleted, false)
        ),
        orderBy: desc(auditReports.timestamp)
      });
      res.json(reports);
    } catch (error) {
      console.error('Error fetching partner reports:', error);
      res.status(500).json({ error: 'Failed to fetch partner reports' });
    }
  });

  // Get rebuttals for current partner with audit report details
  app.get('/api/partners/rebuttals', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = req.user as any;

    // Only partners can access this endpoint
    if (!user.rights.includes('partner')) {
      return res.status(403).json({ error: 'Only partners can access this endpoint' });
    }

    try {
      const rebuttalsList = await db.query.rebuttals.findMany({
        where: eq(rebuttals.partnerId, user.id),
        orderBy: desc(rebuttals.createdAt)
      });
      res.json(rebuttalsList);
    } catch (error) {
      console.error('Error fetching partner rebuttals:', error);
      res.status(500).json({ error: 'Failed to fetch partner rebuttals' });
    }
  });

  // Get all partners (users with partner rights)
  app.get('/api/partners', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Only admin, manager, or team lead can view partners list
    const user = req.user as any;
    if (!user.rights.includes('admin') && 
        !user.rights.includes('manager') && 
        !user.rights.includes('teamleader') &&
        !user.rights.includes('buildForm')) {
      return res.status(403).json({ error: 'Insufficient permissions to view partners' });
    }
    
    try {
      const partners = await db.query.users.findMany({
        where: and(
          eq(users.isInactive, false),
          sql`rights @> '["partner"]'`
        ),
        orderBy: desc(users.id),
        columns: {
          id: true,
          username: true,
          email: true,
          rights: true
        }
      });
      res.json(partners);
    } catch (error) {
      console.error('Error fetching partners:', error);
      res.status(500).json({ error: 'Failed to fetch partners' });
    }
  });

  // Get audit reports by partner ID
  app.get('/api/audit-reports/partner/:partnerId', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    const partnerId = parseInt(req.params.partnerId);
    
    // Partners can only view their own audit reports, others need appropriate permissions
    if (user.rights.includes('partner') && user.id !== partnerId) {
      return res.status(403).json({ error: 'Partners can only view their own audit reports' });
    }
    
    // Non-partners need admin, manager, or teamleader rights
    if (!user.rights.includes('partner') && 
        !user.rights.includes('admin') && 
        !user.rights.includes('manager') && 
        !user.rights.includes('teamleader')) {
      return res.status(403).json({ error: 'Insufficient permissions to view partner audit reports' });
    }
    
    try {
      const reports = await db.query.auditReports.findMany({
        where: and(
          eq(auditReports.partnerId, partnerId),
          eq(auditReports.deleted, false)
        ),
        orderBy: desc(auditReports.timestamp)
      });
      res.json(reports);
    } catch (error) {
      console.error('Error fetching partner audit reports:', error);
      res.status(500).json({ error: 'Failed to fetch partner audit reports' });
    }
  });

  // Create rebuttal and handle rebuttal actions
  app.post('/api/rebuttals', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only partners can create rebuttals
    if (!user.rights.includes('partner')) {
      return res.status(403).json({ error: 'Only partners can create rebuttals' });
    }
    
    try {
      // Validate request body
      const bodySchema = z.object({
        auditReportId: z.number(),
        rebuttalText: z.string().optional(),
        action: z.enum(['accept', 'reject', 'rebuttal', 're_rebuttal', 'bod']),
        handlerResponse: z.string().optional()
      });
      
      const { auditReportId, rebuttalText, action } = bodySchema.parse(req.body);
      
      // Require rebuttalText for rebuttal actions  
      if ((action === 'reject' || action === 'rebuttal' || action === 're_rebuttal') && !rebuttalText?.trim()) {
        return res.status(400).json({ error: 'Rebuttal text is required for reject, rebuttal, and re-rebuttal actions' });
      }
      
      // Verify that the audit report exists, is not deleted, and belongs to this partner
      const auditReport = await db.query.auditReports.findFirst({
        where: and(
          eq(auditReports.id, auditReportId),
          eq(auditReports.partnerId, user.id),
          eq(auditReports.deleted, false)
        )
      });
      
      if (!auditReport) {
        return res.status(403).json({ error: 'Audit report not found or not accessible to this partner' });
      }

      // Handle different actions
      if (action === 'accept') {
        // Partner accepts the audit report
        await db.update(auditReports)
          .set({ status: 'accepted' })
          .where(eq(auditReports.id, auditReportId));

        res.json({ message: 'Report accepted successfully' });
        return;
      }

      if (action === 'reject' || action === 'rebuttal' || action === 're_rebuttal' || action === 'bod') {
        const rebuttalType = action === 're_rebuttal' ? 're_rebuttal' : 'rebuttal';
        const rebuttalData = {
          auditReportId,
          partnerId: user.id,
          partnerName: user.username,
          rebuttalText: rebuttalText || (action === 'bod' ? 'Benefit of Doubt applied' : ''),
          rebuttalType,
          status: action === 'bod' ? 'accepted' : 'pending'
        };

        const validatedRebuttalData = insertRebuttalSchema.parse(rebuttalData);
        const [newRebuttal] = await db.insert(rebuttals).values(validatedRebuttalData).returning();

        // Update audit report status
        let reportStatus = 'under_rebuttal';
        if (action === 'bod') {
          reportStatus = 'bod_applied';
        } else if (rebuttalType === 're_rebuttal') {
          reportStatus = 'under_re_rebuttal';
        }

        await db.update(auditReports)
          .set({ status: reportStatus })
          .where(eq(auditReports.id, auditReportId));

        broadcast({
          type: 'rebuttal_created',
          rebuttal: newRebuttal
        });

        res.json(newRebuttal);
        return;
      }

      res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error processing rebuttal action:', error);
      res.status(500).json({ error: 'Failed to process rebuttal action' });
    }
  });

  // Get rebuttals by partner ID
  app.get('/api/rebuttals/partner/:partnerId', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    const partnerId = parseInt(req.params.partnerId);
    
    // Partners can only view their own rebuttals, others need appropriate permissions
    if (user.rights.includes('partner') && user.id !== partnerId) {
      return res.status(403).json({ error: 'Partners can only view their own rebuttals' });
    }
    
    // Non-partners need admin, manager, or teamleader rights
    if (!user.rights.includes('partner') && 
        !user.rights.includes('admin') && 
        !user.rights.includes('manager') && 
        !user.rights.includes('teamleader')) {
      return res.status(403).json({ error: 'Insufficient permissions to view rebuttals' });
    }
    
    try {
      const rebuttalsList = await db.query.rebuttals.findMany({
        where: eq(rebuttals.partnerId, partnerId),
        orderBy: desc(rebuttals.createdAt)
      });
      res.json(rebuttalsList);
    } catch (error) {
      console.error('Error fetching partner rebuttals:', error);
      res.status(500).json({ error: 'Failed to fetch partner rebuttals' });
    }
  });

  // Get rebuttals by audit report ID
  app.get('/api/rebuttals/audit/:auditReportId', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const auditReportId = parseInt(req.params.auditReportId);
      const rebuttalsList = await db.query.rebuttals.findMany({
        where: eq(rebuttals.auditReportId, auditReportId),
        orderBy: desc(rebuttals.createdAt)
      });
      res.json(rebuttalsList);
    } catch (error) {
      console.error('Error fetching audit rebuttals:', error);
      res.status(500).json({ error: 'Failed to fetch audit rebuttals' });
    }
  });

  // Get all rebuttals (for Admin/Manager/TL)
  app.get('/api/rebuttals', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const rebuttalsList = await db.query.rebuttals.findMany({
        orderBy: desc(rebuttals.createdAt)
      });
      res.json(rebuttalsList);
    } catch (error) {
      console.error('Error fetching rebuttals:', error);
      res.status(500).json({ error: 'Failed to fetch rebuttals' });
    }
  });

  // Update rebuttal status (Accept/Reject)
  app.patch('/api/rebuttals/:rebuttalId', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = req.user as any;
    
    // Only admin, manager, or team lead can handle rebuttals
    if (!user.rights.includes('admin') && 
        !user.rights.includes('manager') && 
        !user.rights.includes('teamleader')) {
      return res.status(403).json({ error: 'Insufficient permissions to handle rebuttals' });
    }
    
    try {
      const rebuttalId = parseInt(req.params.rebuttalId);
      const { status, handledBy, handledByName, handlerResponse } = req.body;

      const updateData: any = {
        status,
        handledBy,
        handledByName,
        handlerResponse,
        handledAt: new Date()
      };

      const [updatedRebuttal] = await db.update(rebuttals)
        .set(updateData)
        .where(eq(rebuttals.id, rebuttalId))
        .returning();

      if (!updatedRebuttal) {
        return res.status(404).json({ error: 'Rebuttal not found' });
      }

      // Update audit report status based on rebuttal decision
      let auditStatus = 'completed';
      if (status === 'accepted') {
        auditStatus = 'rebuttal_accepted';
      } else if (status === 'rejected') {
        auditStatus = 'rebuttal_rejected';
      }

      await db.update(auditReports)
        .set({ status: auditStatus })
        .where(eq(auditReports.id, updatedRebuttal.auditReportId));

      broadcast({
        type: 'rebuttal_updated',
        rebuttal: updatedRebuttal
      });

      res.json(updatedRebuttal);
    } catch (error) {
      console.error('Error updating rebuttal:', error);
      res.status(500).json({ error: 'Failed to update rebuttal' });
    }
  });

  // Add health check endpoint
  app.get('/api/health', healthCheck);

  return httpServer;
}