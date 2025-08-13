/**
 * A specialized service for finding and handling problematic reports
 * that keep reappearing after deletion. This service specifically targets
 * reports that have known issues with the delete functionality.
 */

/**
 * Sets up a recurring purge operation that runs at the specified interval
 * @param interval The interval in milliseconds between purge operations
 * @returns A cleanup function that can be called to stop the recurring purge
 */
export function setupRecurringPurge(interval: number = 5000): () => void {
  console.log(`Setting up recurring problematic reports purge every ${interval}ms`);
  
  // Run immediately on setup
  purgeProblematicReports();
  
  // Set up recurring interval
  const intervalId = setInterval(() => {
    purgeProblematicReports();
  }, interval);
  
  // Return a cleanup function
  return () => {
    console.log('Stopping recurring problematic reports purge');
    clearInterval(intervalId);
  };
}

export function purgeProblematicReports(): void {
  try {
    // First, check if we've already purged these reports
    const purgeCompleted = localStorage.getItem('qa-problematic-reports-purged');
    
    // Create the registry of permanently deleted IDs if it doesn't exist
    let permanentlyDeletedIds: string[] = [];
    try {
      permanentlyDeletedIds = JSON.parse(localStorage.getItem('qa-permanently-deleted-ids') || '[]');
    } catch (err) {
      console.error("Error loading permanently deleted IDs:", err);
      permanentlyDeletedIds = [];
    }
    
    // Always include these problematic IDs that need to be permanently deleted
    const problematicIds = [
      'AUD-24341759', 
      'open-sample-1746109044641-3',
      'audit-1746269420-67',
      'audit-1746269420-89',
      'audit-1746270000-12',
      'REVIEW-1746332687-1'
    ];
    
    // Add all problematic IDs to the permanently deleted registry
    problematicIds.forEach(id => {
      if (!permanentlyDeletedIds.includes(id)) {
        permanentlyDeletedIds.push(id);
      }
    });
    
    // Save the updated permanent deletion registry
    localStorage.setItem('qa-permanently-deleted-ids', JSON.stringify([...new Set(permanentlyDeletedIds)]));
    console.log("Added problematic IDs to permanently deleted registry");
    
    // Get all storage keys that might contain reports
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('-audit') || key.includes('reports') || key.includes('sample') || 
                 key.includes('qa-') || key.includes('user-'))) {
        allKeys.push(key);
      }
    }
    
    // Also check these specific keys
    const specificKeys = [
      'qa-reports',
      'qa-completed-audits',
      'qa-submitted-audits',
      'qa-pending-audits',
      'qa-audit-samples',
      'qa-form-builder-audits',
      'qa-deleted-audits',
      'qa-deleted-reports'
    ];
    
    // Combine all keys to check, ensuring no duplicates
    const keysToCheck = [...new Set([...allKeys, ...specificKeys])];
    console.log(`Found ${specificKeys.length} potential localStorage keys to check for problematic reports`);
    console.log(`Checking ${keysToCheck.length} total storage keys for problematic reports`);
    
    // Process each storage key
    keysToCheck.forEach(key => {
      try {
        // Get items from this storage location
        const itemsStr = localStorage.getItem(key);
        if (!itemsStr) return;
        
        const items = JSON.parse(itemsStr);
        
        // Skip if not an array
        if (!Array.isArray(items)) {
          console.log(`Skipping ${key}: not an array`);
          return;
        }
        
        // Filter out problematic items
        const updatedItems = items.filter((item: any) => {
          // Skip if no id property
          if (!item || typeof item !== 'object') return true;
          
          const id = String(item.id || '');
          const auditId = String(item.auditId || '');
          
          // Keep item only if it's not in our problematic ID list
          return !problematicIds.includes(id) && !problematicIds.includes(auditId);
        });
        
        if (updatedItems.length < items.length) {
          console.log(`Purged ${items.length - updatedItems.length} problematic items from ${key}`);
          localStorage.setItem(key, JSON.stringify(updatedItems));
        }
      } catch (err) {
        console.error(`Error processing ${key}:`, err);
      }
    });
    
    // Set a flag indicating we've done this purge
    localStorage.setItem('qa-problematic-reports-purged', 'true');
    console.log('Problematic reports purge completed');
  } catch (error) {
    console.error("Error in purgeProblematicReports:", error);
  }
}
