/**
 * Utility to completely reset all application data
 * This will clear all localStorage items except for critical system settings
 */

export function resetAllData(): boolean {
  try {
    // Confirm with the user before proceeding
    if (!confirm('WARNING: This will delete ALL audits, reports, forms, and samples. This cannot be undone. Are you sure you want to proceed?')) {
      return false;
    }
    
    if (!confirm('FINAL WARNING: All user data will be lost. Only the default admin account will remain. Continue?')) {
      return false;
    }
    
    // Get a list of all localStorage keys
    const keysToKeep = [
      'localStorage-synced', // System flag
      'qa-admin-protected', // Admin protection flag
      'qa-auth-method'      // Authentication method setting
    ];
    
    // Remove all keys except those in keysToKeep
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    }
    
    // Create default admin user
    localStorage.setItem('qa-users', JSON.stringify([{
      id: 1,
      username: 'admin',
      password: 'admin123', // Default password
      rights: ['admin', 'manageUsers', 'dashboard', 'reports', 'audit', 'buildForm', 'masterAuditor', 'userManage', 'createLowerUsers'],
      isInactive: false
    }]));
    
    // Set protected admin flag
    localStorage.setItem('qa-admin-protected', 'true');
    
    console.log('Application data has been reset to factory defaults');
    alert('All data has been reset. The application will now reload.');
    
    // Reload the page to apply changes
    window.location.reload();
    return true;
  } catch (error) {
    console.error('Error resetting application data:', error);
    alert('There was an error resetting the application data. Please try again.');
    return false;
  }
}
