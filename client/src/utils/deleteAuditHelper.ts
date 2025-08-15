// Helper function to properly delete an audit from both localStorage and database
export const deleteAuditProperly = async (auditId: string) => {
  try {
    console.log(`🗑️ Properly deleting audit ${auditId}...`);
    
    // 1. Remove from all localStorage arrays
    const storageKeys = [
      'qa-submitted-audits',
      'qa-completed-audits', 
      'qa-reports',
      'qa-audit-results'
    ];
    
    storageKeys.forEach(key => {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = data.filter((item: any) => 
        (item.id !== auditId) && 
        (item.auditId !== auditId) &&
        (item.originalId !== auditId)
      );
      localStorage.setItem(key, JSON.stringify(filtered));
      console.log(`✅ Removed ${auditId} from ${key} (${data.length - filtered.length} items removed)`);
    });
    
    // 2. Add to deleted audits list if not already there
    const deletedAudits = JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]');
    const alreadyDeleted = deletedAudits.some((d: any) => 
      d.auditId === auditId || d.id === auditId
    );
    
    if (!alreadyDeleted) {
      const deletedRecord = {
        auditId,
        timestamp: Date.now(),
        deletedBy: 'User',
        deletedByName: 'Current User',
        reason: 'Manual deletion'
      };
      deletedAudits.push(deletedRecord);
      localStorage.setItem('qa-deleted-audits', JSON.stringify(deletedAudits));
      console.log(`✅ Added ${auditId} to deleted audits list`);
    }
    
    // 3. Mark as deleted in database
    try {
      const response = await fetch(`/api/reports/${auditId}/delete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        console.log(`✅ Marked ${auditId} as deleted in database`);
      } else {
        console.log(`⚠️ Could not mark ${auditId} as deleted in database (may not exist there yet)`);
      }
    } catch (error) {
      console.log(`⚠️ Error marking ${auditId} as deleted in database:`, error);
    }
    
    console.log(`✅ Successfully deleted audit ${auditId} from all locations`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error deleting audit ${auditId}:`, error);
    return false;
  }
};

// Helper to clean up all visibility issues with deleted audits  
export const cleanupDeletedAuditsVisibility = () => {
  console.log('🧹 Cleaning up deleted audit visibility...');
  
  // Get all deleted audit IDs
  const deletedAudits = JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]');
  const deletedIds = new Set(deletedAudits.map((d: any) => d.auditId || d.id));
  
  console.log(`Found ${deletedIds.size} deleted audit IDs:`, Array.from(deletedIds));
  
  // Remove deleted audits from all storage locations
  const storageKeys = [
    'qa-submitted-audits',
    'qa-completed-audits', 
    'qa-reports',
    'qa-audit-results'
  ];
  
  let totalRemoved = 0;
  storageKeys.forEach(key => {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    const beforeCount = data.length;
    
    const filtered = data.filter((item: any) => {
      const itemId = item.id || item.auditId || item.originalId;
      return !deletedIds.has(itemId);
    });
    
    const removedCount = beforeCount - filtered.length;
    totalRemoved += removedCount;
    
    localStorage.setItem(key, JSON.stringify(filtered));
    
    if (removedCount > 0) {
      console.log(`✅ Removed ${removedCount} deleted audits from ${key}`);
    }
  });
  
  console.log(`✅ Cleanup complete: Removed ${totalRemoved} deleted audit entries from localStorage`);
  
  // Force page refresh to update UI
  if (totalRemoved > 0) {
    console.log('🔄 Refreshing page to update UI...');
    window.location.reload();
  }
};