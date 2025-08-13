/**
 * Local Storage Setup Functions
 * 
 * These functions are used to check and verify local storage data.
 * No database is used in this version, all data is stored in localStorage.
 */

/**
 * Check if localStorage is available and contains the required data
 */
export async function checkLocalStorage() {
  console.log('Checking localStorage...');
  
  try {
    // Check if localStorage is available
    if (!localStorage) {
      return {
        success: false, 
        message: 'localStorage is not available in this browser or is disabled.'
      };
    }
    
    // Check existing data
    const usersJson = localStorage.getItem('qa-users');
    const formsJson = localStorage.getItem('qa-audit-forms');
    const reportsJson = localStorage.getItem('qa-submitted-audits');
    const ataReviewsJson = localStorage.getItem('qa-ata-reviews');
    const deletedAuditsJson = localStorage.getItem('qa-deleted-audits');
    
    const users = usersJson ? JSON.parse(usersJson) : [];
    const forms = formsJson ? JSON.parse(formsJson) : [];
    const reports = reportsJson ? JSON.parse(reportsJson) : [];
    const ataReviews = ataReviewsJson ? JSON.parse(ataReviewsJson) : [];
    const deletedAudits = deletedAuditsJson ? JSON.parse(deletedAuditsJson) : [];
    
    console.log(`Found ${users.length} users in localStorage`);
    console.log(`Found ${forms.length} forms in localStorage`);
    console.log(`Found ${reports.length} reports in localStorage`);
    console.log(`Found ${ataReviews.length} ATA reviews in localStorage`);
    console.log(`Found ${deletedAudits.length} deleted audits in localStorage`);
    
    // Create admin user if no users exist
    if (users.length === 0) {
      console.log('No users found, creating default admin user...');
      
      const adminUser = {
        id: 1,
        username: 'admin',
        password: 'admin123',
        rights: ['admin', 'manager', 'team_leader', 'auditor', 'ma'],
        isInactive: false
      };
      
      localStorage.setItem('qa-users', JSON.stringify([adminUser]));
      console.log('✅ Created default admin user (username: admin, password: admin123)');
      
      // Also create a test auditor account
      const auditorUser = {
        id: 2,
        username: 'auditor',
        password: 'password',
        rights: ['auditor'],
        isInactive: false
      };
      
      localStorage.setItem('qa-users', JSON.stringify([adminUser, auditorUser]));
      console.log('✅ Created test auditor user (username: auditor, password: password)');
    }
    
    return { 
      success: true,
      message: 'localStorage is available and initialized',
      data: {
        users: users.length,
        forms: forms.length,
        reports: reports.length,
        ataReviews: ataReviews.length,
        deletedAudits: deletedAudits.length
      }
    };
  } catch (error) {
    console.error('Error checking localStorage:', error);
    return { 
      success: false, 
      message: 'Error checking localStorage: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Initialize localStorage with demo data if needed
 */
export async function initializeLocalStorage() {
  console.log('Initializing localStorage with demo data...');
  
  try {
    // Check if users already exist
    const usersJson = localStorage.getItem('qa-users');
    const users = usersJson ? JSON.parse(usersJson) : [];
    
    if (users.length === 0) {
      // Create admin user
      const adminUser = {
        id: 1,
        username: 'admin',
        password: 'admin123',
        rights: ['admin', 'manager', 'team_leader', 'auditor', 'ma'],
        isInactive: false
      };
      
      // Create auditor user
      const auditorUser = {
        id: 2,
        username: 'auditor',
        password: 'password',
        rights: ['auditor'],
        isInactive: false
      };
      
      localStorage.setItem('qa-users', JSON.stringify([adminUser, auditorUser]));
      console.log('✅ Created demo users');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error initializing localStorage:', error);
    return { 
      success: false, 
      message: 'Error initializing localStorage: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Export all localStorage data to a JSON object
 */
export function exportLocalStorageData() {
  try {
    const usersJson = localStorage.getItem('qa-users') || '[]';
    const formsJson = localStorage.getItem('qa-audit-forms') || '[]';
    const reportsJson = localStorage.getItem('qa-submitted-audits') || '[]';
    const ataReviewsJson = localStorage.getItem('qa-ata-reviews') || '[]';
    const deletedAuditsJson = localStorage.getItem('qa-deleted-audits') || '[]';
    
    return {
      users: JSON.parse(usersJson),
      forms: JSON.parse(formsJson),
      reports: JSON.parse(reportsJson),
      ataReviews: JSON.parse(ataReviewsJson),
      deletedAudits: JSON.parse(deletedAuditsJson)
    };
  } catch (error) {
    console.error('Error exporting localStorage data:', error);
    throw error;
  }
}

/**
 * Import data into localStorage
 */
export function importLocalStorageData(data: any) {
  try {
    if (data.users) localStorage.setItem('qa-users', JSON.stringify(data.users));
    if (data.forms) localStorage.setItem('qa-audit-forms', JSON.stringify(data.forms));
    if (data.reports) localStorage.setItem('qa-submitted-audits', JSON.stringify(data.reports));
    if (data.ataReviews) localStorage.setItem('qa-ata-reviews', JSON.stringify(data.ataReviews));
    if (data.deletedAudits) localStorage.setItem('qa-deleted-audits', JSON.stringify(data.deletedAudits));
    
    return { success: true };
  } catch (error) {
    console.error('Error importing localStorage data:', error);
    return { 
      success: false, 
      message: 'Error importing data: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}