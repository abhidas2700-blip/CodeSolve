// Backup current data
const backup = {
  reports: JSON.parse(localStorage.getItem('qa-reports') || '[]'),
  completedAudits: JSON.parse(localStorage.getItem('qa-completed-audits') || '[]'),
  submittedAudits: JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]'),
  deletedAudits: JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]'),
  deletedReports: JSON.parse(localStorage.getItem('qa-deleted-reports') || '[]'),
  auditSamples: JSON.parse(localStorage.getItem('qa-audit-samples') || '[]')
};

// Save backup to console for potential recovery
console.log('BACKUP DATA:', JSON.stringify(backup, null, 2));

// Clear all audit reports
localStorage.removeItem('qa-reports');
localStorage.removeItem('qa-completed-audits');
localStorage.removeItem('qa-submitted-audits'); 
localStorage.removeItem('qa-deleted-audits');
localStorage.removeItem('qa-deleted-reports');
localStorage.removeItem('qa-audit-samples');

// Trigger reports update event
window.dispatchEvent(new Event('reportsUpdated'));

// Log completion
console.log('All audit reports cleared successfully. A fresh start is ready!');
