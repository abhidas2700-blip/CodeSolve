/**
 * LocalStorage Service (No Supabase)
 * 
 * This file replaces the Supabase client with a local storage implementation.
 * The application now uses browser localStorage exclusively with no external dependencies.
 */

console.log('SolveXtra is using local storage only - no database connection');

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  USERS: 'qa-users',
  CURRENT_USER: 'qa-current-user',
  FORMS: 'qa-audit-forms',
  REPORTS: 'qa-submitted-audits',
  ATA_REVIEWS: 'qa-ata-reviews',
  DELETED_AUDITS: 'qa-deleted-audits'
};

/**
 * Initialize local storage with default data if it doesn't exist yet
 */
export function initializeLocalStorage() {
  // Check if users exist, if not create default admin user
  const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!usersJson || JSON.parse(usersJson).length === 0) {
    const adminUser = {
      id: 1,
      username: 'admin',
      password: 'admin123',
      rights: ['admin', 'manager', 'team_leader', 'auditor', 'ma'],
      isInactive: false
    };
    
    const auditorUser = {
      id: 2,
      username: 'auditor',
      password: 'password',
      rights: ['auditor'],
      isInactive: false
    };
    
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([adminUser, auditorUser]));
    console.log('Created default users: admin/admin123 and auditor/password');
  }
  
  // Initialize empty collections if they don't exist
  if (!localStorage.getItem(STORAGE_KEYS.FORMS)) {
    localStorage.setItem(STORAGE_KEYS.FORMS, '[]');
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.REPORTS)) {
    localStorage.setItem(STORAGE_KEYS.REPORTS, '[]');
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.ATA_REVIEWS)) {
    localStorage.setItem(STORAGE_KEYS.ATA_REVIEWS, '[]');
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.DELETED_AUDITS)) {
    localStorage.setItem(STORAGE_KEYS.DELETED_AUDITS, '[]');
  }
}

// Initialize localStorage on load
initializeLocalStorage();
