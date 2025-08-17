/**
 * Report manager service to handle report deletion and ensure proper synchronization
 * across all storage locations and UI components.
 */

// Get a comprehensive list of all deleted report IDs
export function getAllDeletedReportIds(): Set<string> {
  try {
    // Get all possible sources of deleted reports
    const permanentlyDeletedIds = JSON.parse(localStorage.getItem('qa-permanently-deleted-ids') || '[]');
    const deletedAudits = JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]');
    const deletedReports = JSON.parse(localStorage.getItem('qa-deleted-reports') || '[]');
    
    // Create a new Set to track all deleted IDs
    const deletedIdSet = new Set<string>();
    
    // Add all permanently deleted IDs
    permanentlyDeletedIds.forEach((id: string) => {
      if (id) deletedIdSet.add(String(id));
    });
    
    // Add IDs from deleted audits collection
    deletedAudits.forEach((item: any) => {
      if (item.id) deletedIdSet.add(String(item.id));
      if (item.auditId) deletedIdSet.add(String(item.auditId));
    });
    
    // Add IDs from deleted reports collection
    deletedReports.forEach((item: any) => {
      if (item.id) deletedIdSet.add(String(item.id));
      if (item.auditId) deletedIdSet.add(String(item.auditId));
    });
    
    return deletedIdSet;
  } catch (error) {
    console.error('Error getting deleted report IDs:', error);
    return new Set<string>();
  }
}

// Add a report to the deleted reports tracking
export async function markReportAsDeleted(report: any, deletedBy: string): Promise<boolean> {
  try {
    if (!report || !report.id) {
      console.error('Cannot delete invalid report');
      return false;
    }
    
    // Convert IDs to strings for consistent comparison
    const reportId = String(report.id);
    const auditId = String(report.auditId || reportId);
    const timestamp = Date.now();
    
    // 1. Add to permanently deleted IDs registry
    const permanentlyDeletedIds = JSON.parse(localStorage.getItem('qa-permanently-deleted-ids') || '[]');
    permanentlyDeletedIds.push(reportId);
    permanentlyDeletedIds.push(auditId);
    localStorage.setItem('qa-permanently-deleted-ids', JSON.stringify([...new Set(permanentlyDeletedIds)]));
    
    // 2. Create a deletion record
    const deletionRecord = {
      id: reportId,
      auditId: auditId,
      agent: report.agent || 'Unknown',
      formName: report.formName || 'Unknown Form',
      timestamp: report.timestamp || Date.now(),
      score: report.score || 0,
      deletedBy: deletedBy,
      deletedAt: timestamp
    };
    
    // 3. Add to deleted reports tracking
    const deletedReports = JSON.parse(localStorage.getItem('qa-deleted-reports') || '[]');
    deletedReports.push(deletionRecord);
    localStorage.setItem('qa-deleted-reports', JSON.stringify(deletedReports));
    
    // 4. Remove from main reports collection
    const reports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
    const updatedReports = reports.filter((r: any) => 
      String(r.id) !== reportId && 
      String(r.auditId) !== auditId &&
      String(r.id) !== auditId && 
      String(r.auditId) !== reportId
    );
    localStorage.setItem('qa-reports', JSON.stringify(updatedReports));
    
    // 5. Clean up any related records in other collections
    cleanupRelatedReports(reportId, auditId);
    
    // 6. Save to database via API
    try {
      const dbPayload = {
        originalId: report.id,
        auditId: report.auditId || report.id,
        formName: report.formName || 'Unknown Form',
        agent: report.agent || 'Unknown',
        agentId: report.agentId || report.ticketId || 'Unknown',
        auditor: report.auditor,
        auditorName: report.auditorName || 'Unknown',
        sectionAnswers: report.sectionAnswers || {},
        score: report.score || 0,
        maxScore: report.maxScore || 100,
        hasFatal: report.hasFatal || false,
        timestamp: report.timestamp || new Date(),
        deletedByName: deletedBy
      };
      
      console.log('Saving deleted audit to database:', dbPayload);
      
      const response = await fetch('/api/deleted-audits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(dbPayload)
      });
      
      if (response.ok) {
        console.log('✅ Deleted audit saved to database successfully');
      } else {
        console.error('Failed to save deleted audit to database:', response.status);
      }
    } catch (error) {
      console.error('Error saving deleted audit to database:', error);
      // Don't fail the deletion if database save fails
    }

    // 7. Dispatch event to notify all components of the change
    window.dispatchEvent(new CustomEvent('reportsUpdated'));
    
    return true;
  } catch (error) {
    console.error('Error marking report as deleted:', error);
    return false;
  }
}

// Helper to filter out a report from any collection
function filterReportFromCollection(collection: string, reportId: string, auditId: string): void {
  try {
    const items = JSON.parse(localStorage.getItem(collection) || '[]');
    
    const filteredItems = items.filter((item: any) => {
      const itemId = String(item.id || '');
      const itemAuditId = String(item.auditId || '');
      
      return (
        itemId !== reportId && 
        itemAuditId !== auditId &&
        itemId !== auditId && 
        itemAuditId !== reportId
      );
    });
    
    if (items.length !== filteredItems.length) {
      localStorage.setItem(collection, JSON.stringify(filteredItems));
      console.log(`Removed deleted report from ${collection}`);
    }
  } catch (error) {
    console.error(`Error filtering report from ${collection}:`, error);
  }
}

// Clean up any related report entries from all storage locations
function cleanupRelatedReports(reportId: string, auditId: string): void {
  // List of all collections that might contain the report
  const collections = [
    'qa-completed-audits',
    'qa-submitted-audits',
    'qa-pending-audits',
    'qa-audit-samples',
    'qa-form-builder-audits'
  ];
  
  // Process each collection
  collections.forEach(collection => {
    filterReportFromCollection(collection, reportId, auditId);
  });
}

// Check if a report is deleted based on its ID
export function isReportDeleted(reportId: string, auditId?: string): boolean {
  const deletedIds = getAllDeletedReportIds();
  
  // Convert to string for consistent comparison
  const id = String(reportId);
  const altId = auditId ? String(auditId) : id;
  
  return deletedIds.has(id) || deletedIds.has(altId);
}

// Filter a list of reports to remove deleted ones
export function filterDeletedReports<T extends { id: number | string, auditId?: string | number }>(reports: T[]): T[] {
  const deletedIds = getAllDeletedReportIds();
  
  return reports.filter(report => {
    const reportId = String(report.id);
    const auditId = report.auditId ? String(report.auditId) : reportId;
    
    return !deletedIds.has(reportId) && !deletedIds.has(auditId);
  });
}
