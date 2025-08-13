import type { Express } from "express";
import { databaseService } from "../services/database-service";
import { migrationService } from "../services/migration-service";

export function registerDatabaseRoutes(app: Express) {
  // Health check endpoint for database
  app.get('/api/health', async (req, res) => {
    try {
      const health = await databaseService.healthCheck();
      res.status(health.status === 'healthy' ? 200 : 500).json(health);
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        error: String(error),
        timestamp: new Date().toISOString() 
      });
    }
  });

  // Migration endpoint (protected)
  app.post('/api/migrate', async (req, res) => {
    try {
      if (!req.user || !(req.user as any).rights.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      await migrationService.migrateFromLocalStorage();
      res.json({ message: 'Migration completed successfully' });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ error: 'Migration failed', details: String(error) });
    }
  });

  // Database statistics endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const stats = await databaseService.getAuditStatistics();
      res.json(stats);
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });
}