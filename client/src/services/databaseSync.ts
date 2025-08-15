// Database synchronization service for all audit management data
export class DatabaseSyncService {
  private static instance: DatabaseSyncService;
  private syncInProgress = false;

  static getInstance(): DatabaseSyncService {
    if (!DatabaseSyncService.instance) {
      DatabaseSyncService.instance = new DatabaseSyncService();
    }
    return DatabaseSyncService.instance;
  }

  // Sync all data types to database
  async syncAllToDatabase(): Promise<void> {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    console.log('Starting comprehensive database sync...');

    try {
      await Promise.all([
        this.syncFormsToDatabase(),
        this.syncReportsToDatabase(),
        this.syncSkippedSamplesToDatabase(),
        this.syncDeletedAuditsToDatabase(),
        this.syncAtaReviewsToDatabase(),
        this.syncAuditSamplesToDatabase()
      ]);
      console.log('Comprehensive database sync completed successfully');
    } catch (error) {
      console.error('Database sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync forms to database
  async syncFormsToDatabase(): Promise<void> {
    try {
      const forms = JSON.parse(localStorage.getItem('qa-forms') || '[]');
      console.log(`Syncing ${forms.length} forms to database...`);

      for (const form of forms) {
        try {
          const response = await fetch('/api/forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: form.name,
              sections: form.sections || []
            })
          });

          if (response.ok) {
            console.log(`Synced form "${form.name}" to database`);
          } else {
            console.log(`Failed to sync form "${form.name}": ${response.status}`);
          }
        } catch (error) {
          console.error(`Error syncing form "${form.name}":`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncFormsToDatabase:', error);
    }
  }

  // Sync audit reports to database
  async syncReportsToDatabase(): Promise<void> {
    try {
      const reports = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
      console.log(`Syncing ${reports.length} audit reports to database...`);

      for (const report of reports) {
        try {
          const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              auditId: report.id || report.auditId,
              formName: report.formName || 'Unknown Form',
              agent: report.agent || 'Unknown Agent',
              agentId: report.agentId || 'UNKNOWN',
              auditorName: report.auditorName || 'Unknown Auditor',
              sectionAnswers: report.sectionAnswers || {},
              score: report.score || 0,
              maxScore: report.maxScore || 100,
              hasFatal: report.hasFatal || false,
              status: report.status || 'completed'
            })
          });

          if (response.ok) {
            console.log(`Synced audit report ${report.id || report.auditId} to database`);
          } else {
            console.log(`Failed to sync audit report ${report.id || report.auditId}: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error syncing audit report ${report.id || report.auditId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncReportsToDatabase:', error);
    }
  }

  // Sync skipped samples to database
  async syncSkippedSamplesToDatabase(): Promise<void> {
    try {
      const skippedSamples = JSON.parse(localStorage.getItem('qa-skipped-samples') || '[]');
      console.log(`Syncing ${skippedSamples.length} skipped samples to database...`);

      for (const skipped of skippedSamples) {
        try {
          const response = await fetch('/api/skipped-samples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              auditId: skipped.auditId || skipped.id,
              formName: skipped.formName || 'Unknown Form',
              agent: skipped.agent || 'Unknown Agent',
              agentId: skipped.agentId || 'UNKNOWN',
              auditorName: skipped.auditorName || 'Unknown Auditor',
              reason: skipped.reason || 'No reason provided'
            })
          });

          if (response.ok) {
            console.log(`Synced skipped sample ${skipped.auditId || skipped.id} to database`);
          } else {
            console.log(`Failed to sync skipped sample ${skipped.auditId || skipped.id}: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error syncing skipped sample ${skipped.auditId || skipped.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncSkippedSamplesToDatabase:', error);
    }
  }

  // Sync deleted audits to database
  async syncDeletedAuditsToDatabase(): Promise<void> {
    try {
      const deletedAudits = JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]');
      console.log(`Syncing ${deletedAudits.length} deleted audits to database...`);

      for (const deleted of deletedAudits) {
        try {
          const response = await fetch('/api/deleted-audits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              auditId: deleted.auditId || deleted.id,
              formName: deleted.formName || 'Unknown Form',
              agent: deleted.agent || 'Unknown Agent',
              agentId: deleted.agentId || 'UNKNOWN',
              auditorName: deleted.auditorName || 'Unknown Auditor',
              reason: deleted.reason || 'No reason provided',
              hasFatal: deleted.hasFatal || false,
              deletedByName: deleted.deletedByName || 'Unknown User'
            })
          });

          if (response.ok) {
            console.log(`Synced deleted audit ${deleted.auditId || deleted.id} to database`);
          } else {
            console.log(`Failed to sync deleted audit ${deleted.auditId || deleted.id}: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error syncing deleted audit ${deleted.auditId || deleted.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncDeletedAuditsToDatabase:', error);
    }
  }

  // Sync ATA reviews to database
  async syncAtaReviewsToDatabase(): Promise<void> {
    try {
      const ataReviews = JSON.parse(localStorage.getItem('qa-ata-reviews') || '[]');
      console.log(`Syncing ${ataReviews.length} ATA reviews to database...`);

      for (const review of ataReviews) {
        try {
          const response = await fetch('/api/ata-reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              reportId: review.reportId,
              auditId: review.auditId || 'UNKNOWN',
              reviewerName: review.reviewerName || 'Unknown Reviewer',
              actionTaken: review.actionTaken || 'No action specified',
              comments: review.comments || ''
            })
          });

          if (response.ok) {
            console.log(`Synced ATA review for ${review.auditId} to database`);
          } else {
            console.log(`Failed to sync ATA review for ${review.auditId}: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error syncing ATA review for ${review.auditId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncAtaReviewsToDatabase:', error);
    }
  }

  // Sync audit samples to database (already working but included for completeness)
  async syncAuditSamplesToDatabase(): Promise<void> {
    try {
      const auditSamples = JSON.parse(localStorage.getItem('qa-audit-samples') || '[]');
      console.log(`Syncing ${auditSamples.length} audit samples to database...`);

      for (const sample of auditSamples) {
        try {
          const response = await fetch('/api/audit-samples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              sampleId: sample.id,
              customerName: sample.customerName,
              ticketId: sample.ticketId,
              formType: sample.formType,
              priority: sample.priority || 'medium',
              status: sample.status || 'available',
              metadata: sample.metadata || {},
              uploadedBy: 1
            })
          });

          if (response.ok) {
            console.log(`Synced audit sample ${sample.id} to database`);
          } else {
            console.log(`Failed to sync audit sample ${sample.id}: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error syncing audit sample ${sample.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncAuditSamplesToDatabase:', error);
    }
  }

  // Create new form and sync to database
  async createForm(formData: any): Promise<void> {
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const newForm = await response.json();
        console.log(`Created form "${newForm.name}" in database`);
        
        // Update localStorage to match database
        const forms = JSON.parse(localStorage.getItem('qa-forms') || '[]');
        forms.push(newForm);
        localStorage.setItem('qa-forms', JSON.stringify(forms));
      } else {
        console.error('Failed to create form in database:', response.status);
      }
    } catch (error) {
      console.error('Error creating form:', error);
    }
  }

  // Create new audit report and sync to database
  async createAuditReport(reportData: any): Promise<void> {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(reportData)
      });

      if (response.ok) {
        const newReport = await response.json();
        console.log(`Created audit report ${newReport.auditId} in database`);
        
        // Update localStorage to match database
        const reports = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
        reports.push(newReport);
        localStorage.setItem('qa-submitted-audits', JSON.stringify(reports));
      } else {
        console.error('Failed to create audit report in database:', response.status);
      }
    } catch (error) {
      console.error('Error creating audit report:', error);
    }
  }

  // Create skipped sample and sync to database
  async createSkippedSample(skippedData: any): Promise<void> {
    try {
      const response = await fetch('/api/skipped-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(skippedData)
      });

      if (response.ok) {
        const newSkipped = await response.json();
        console.log(`Created skipped sample ${newSkipped.auditId} in database`);
        
        // Update localStorage to match database
        const skipped = JSON.parse(localStorage.getItem('qa-skipped-samples') || '[]');
        skipped.push(newSkipped);
        localStorage.setItem('qa-skipped-samples', JSON.stringify(skipped));
      } else {
        console.error('Failed to create skipped sample in database:', response.status);
      }
    } catch (error) {
      console.error('Error creating skipped sample:', error);
    }
  }
}

// Export singleton instance
export const databaseSync = DatabaseSyncService.getInstance();