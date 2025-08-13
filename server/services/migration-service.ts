import { databaseService } from './database-service';
import fs from 'fs';
import path from 'path';

export class MigrationService {
  private localStoragePath = path.join(process.cwd(), 'localStorage.json');

  async migrateFromLocalStorage() {
    console.log('Starting migration from localStorage to PostgreSQL...');
    
    if (!fs.existsSync(this.localStoragePath)) {
      console.log('No localStorage.json file found, skipping migration.');
      return;
    }

    try {
      const localStorageData = JSON.parse(fs.readFileSync(this.localStoragePath, 'utf8'));
      
      // Migrate users first
      await this.migrateUsers(localStorageData);
      
      // Migrate audit forms
      await this.migrateAuditForms(localStorageData);
      
      // Migrate audit reports
      await this.migrateAuditReports(localStorageData);
      
      // Migrate audit samples
      await this.migrateAuditSamples(localStorageData);
      
      // Migrate other data
      await this.migrateOtherData(localStorageData);
      
      console.log('Migration completed successfully!');
      
      // Backup localStorage file
      const backupPath = `${this.localStoragePath}.backup.${Date.now()}`;
      fs.copyFileSync(this.localStoragePath, backupPath);
      console.log(`localStorage.json backed up to ${backupPath}`);
      
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  private async migrateUsers(data: any) {
    const users = data['qa-users'] || [];
    console.log(`Migrating ${users.length} users...`);
    
    for (const user of users) {
      try {
        const existingUser = await databaseService.getUserByUsername(user.username);
        if (!existingUser) {
          await databaseService.createUser({
            username: user.username,
            password: user.password, // Note: Will be hashed in createUser
            rights: user.rights || ['audit'],
            isInactive: user.isInactive || false
          });
          console.log(`Migrated user: ${user.username}`);
        } else {
          console.log(`User ${user.username} already exists, skipping.`);
        }
      } catch (error) {
        console.error(`Failed to migrate user ${user.username}:`, error);
      }
    }
  }

  private async migrateAuditForms(data: any) {
    const forms = data['qa-forms'] || [];
    console.log(`Migrating ${forms.length} audit forms...`);
    
    for (const form of forms) {
      try {
        await databaseService.createAuditForm({
          name: form.name,
          sections: form.sections,
          createdBy: 1 // Default to admin user
        });
        console.log(`Migrated form: ${form.name}`);
      } catch (error) {
        console.error(`Failed to migrate form ${form.name}:`, error);
      }
    }
  }

  private async migrateAuditReports(data: any) {
    const reports = data['qa-reports'] || [];
    console.log(`Migrating ${reports.length} audit reports...`);
    
    for (const report of reports) {
      try {
        await databaseService.createAuditReport({
          auditId: report.auditId,
          formName: report.formName,
          agent: report.agent,
          agentId: report.agentId,
          auditor: 1, // Default to admin user
          auditorName: report.auditorName,
          sectionAnswers: report.sectionAnswers || {},
          score: report.score || 0,
          maxScore: report.maxScore || 100,
          hasFatal: report.hasFatal || false,
          status: report.status || 'completed',
          edited: report.edited || false
        });
        console.log(`Migrated report: ${report.auditId}`);
      } catch (error) {
        console.error(`Failed to migrate report ${report.auditId}:`, error);
      }
    }
  }

  private async migrateAuditSamples(data: any) {
    const samples = data['qa-audit-samples'] || [];
    console.log(`Migrating ${samples.length} audit samples...`);
    
    for (const sample of samples) {
      try {
        await databaseService.createAuditSample({
          id: sample.id,
          agent: sample.agent,
          agentId: sample.agentId,
          status: sample.status || 'pending',
          assignedTo: sample.assignedTo,
          assignedAt: sample.assignedAt ? new Date(sample.assignedAt) : new Date(),
          completedAt: sample.completedAt ? new Date(sample.completedAt) : null,
          formName: sample.formName,
          metadata: sample.metadata || {}
        });
        console.log(`Migrated sample: ${sample.id}`);
      } catch (error) {
        console.error(`Failed to migrate sample ${sample.id}:`, error);
      }
    }
  }

  private async migrateOtherData(data: any) {
    // Migrate any other relevant data structures
    console.log('Migrating additional data...');
    
    // You can add migration for other localStorage keys here
    // such as settings, preferences, etc.
  }
}

export const migrationService = new MigrationService();