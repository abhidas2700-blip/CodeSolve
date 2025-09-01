const fs = require('fs');

// Read the file
const filePath = 'client/src/pages/users.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Define all permission IDs to update
const permissionIds = [
  'review', 'masterAuditor', 'buildForm', 'editForm', 'deleteForm',
  'reports', 'exportReports', 'dashboard', 'alerts', 'userManage',
  'changePassword', 'createLowerUsers'
];

// Process each permission ID
permissionIds.forEach(id => {
  const oldPattern = new RegExp(`<Checkbox id="${id}" checked=\\{editingUser\\?\\.permissions\\.includes\\('${id}'\\)\\}(\\s+disabled=\\{[^}]+\\})?\\s*\\/>`, 'g');
  const newContent = `<Checkbox 
                        id="${id}" 
                        checked={tempPermissions.includes('${id}')}${id === 'masterAuditor' || id === 'userManage' || id === 'changePassword' ? '\n                        disabled={!currentUser?.rights.includes(\'admin\')}' : ''}
                        onCheckedChange={(checked) => handlePermissionChange('${id}', !!checked)}
                      />`;
  
  content = content.replace(oldPattern, newContent);
});

// Write back to the file
fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated all checkbox handlers in users.tsx');
