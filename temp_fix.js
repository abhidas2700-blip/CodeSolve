// Create a temporary patch file to help us modify the audits.tsx file
const fs = require('fs');

// Read the current file
const filePath = './client/src/pages/audits.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Define our replacements - match Badge variant="outline" and replace with AuditorBadge
const oldCode = `{!isAuditor && sample.assignedTo && (
                            <Badge variant="outline">{sample.assignedTo}</Badge>
                          )}`;
const newCode = `{/* Replaced with AuditorBadge component */}`;

// Apply the replacement
content = content.replace(new RegExp(oldCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newCode);

// Add the new code after the ticket ID spans
const ticketIdPattern = /<span className="font-mono">{sample\.ticketId}<\/span>/g;
content = content.replace(ticketIdPattern, match => 
  `${match}\n                        </div>\n                        {!isAuditor && <AuditorBadge assignedTo={sample.assignedTo} />}\n                        <div className="flex text-xs text-muted-foreground gap-3`);

// Fix the extra div tags
content = content.replace(/<div className="flex text-xs text-muted-foreground gap-3<\/div>/g, 
                          '<div className="flex text-xs text-muted-foreground gap-3">');

// Write the modified content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('File updated successfully!');
