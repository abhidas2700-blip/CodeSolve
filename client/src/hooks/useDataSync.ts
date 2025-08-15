import { useEffect, useCallback } from 'react';

// Hook to automatically sync localStorage data to database
export const useDataSync = () => {
  
  const syncToDatabase = useCallback(async () => {
    try {
      console.log('🔄 Starting automatic data sync to database...');
      
      // Get list of deleted audit IDs to exclude from reports sync
      const deletedAudits = JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]');
      const deletedAuditIds = new Set(deletedAudits.map(d => d.auditId || d.id));
      
      // Sync audit reports (excluding deleted ones)
      const reports = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
      const activeReports = reports.filter(report => !deletedAuditIds.has(report.id || report.auditId));
      console.log(`Found ${activeReports.length} active reports to sync (${reports.length - activeReports.length} excluded as deleted)`);
      
      for (const report of activeReports) {
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
            console.log(`✅ Synced report ${report.id || report.auditId}`);
          }
        } catch (error) {
          console.log(`❌ Failed to sync report ${report.id || report.auditId}:`, error);
        }
      }
      
      // Sync deleted audits and mark reports as deleted in database
      console.log(`Found ${deletedAudits.length} deleted audits to sync`);
      
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
              sectionAnswers: deleted.sectionAnswers || {},
              score: deleted.score || 0,
              maxScore: deleted.maxScore || 100,
              hasFatal: deleted.hasFatal || false,
              deletedByName: deleted.deletedByName || 'Unknown User',
              reason: deleted.reason || 'No reason provided'
            })
          });
          
          if (response.ok) {
            console.log(`✅ Synced deleted audit ${deleted.auditId || deleted.id}`);
            
            // Also mark the original report as deleted in the database
            try {
              await fetch(`/api/reports/${deleted.auditId || deleted.id}/delete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
              });
              console.log(`✅ Marked report ${deleted.auditId || deleted.id} as deleted in database`);
            } catch (error) {
              console.log(`❌ Failed to mark report as deleted: ${error}`);
            }
          }
        } catch (error) {
          console.log(`❌ Failed to sync deleted audit:`, error);
        }
      }
      
      // Sync ATA reviews
      const ataReviews = JSON.parse(localStorage.getItem('qa-ata-reviews') || '[]');
      console.log(`Found ${ataReviews.length} ATA reviews to sync`);
      
      for (const review of ataReviews) {
        try {
          const response = await fetch('/api/ata-reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              auditId: review.auditId,
              reviewerName: review.reviewerName || review.masterAuditor || 'Unknown Reviewer',
              feedback: review.remarks || review.comments || review.actionTaken || 'No feedback provided',
              rating: review.ataScore || review.rating || 5
            })
          });
          
          if (response.ok) {
            console.log(`✅ Synced ATA review ${review.id}`);
          }
        } catch (error) {
          console.log(`❌ Failed to sync ATA review:`, error);
        }
      }
      
      console.log('✅ Database sync completed');
      
    } catch (error) {
      console.error('❌ Database sync failed:', error);
    }
  }, []);

  // Auto-sync on component mount and periodically
  useEffect(() => {
    // Initial sync
    syncToDatabase();
    
    // Set up periodic sync every 30 seconds
    const interval = setInterval(syncToDatabase, 30000);
    
    return () => clearInterval(interval);
  }, [syncToDatabase]);

  return { syncToDatabase };
};