// IMPORTANT: This is a comment to indicate the changes made to this file
// Fixed issues with "Open Sample" values being replaced in reports
// Always preserve original data exactly as entered during audits

// Main fix to prevent "Open Sample" from being replaced with dummy values
const fixReportsFileData = `
  // This function is used to format audit data to display in reports
  const formatAuditToSections = (audit: any): Section[] => {
    try {
      console.log("Formatting audit:", audit);
      
      // Check if audit already has answers in the correct format
      if (audit.answers && Array.isArray(audit.answers)) {
        console.log("Audit already has answers in correct format, returning directly");
        return audit.answers;
      }
      
      // SPECIAL CASE: Handle data from Form Builder audits
      // If we have the formName property matching any Form Builder form, apply special processing
      // Removed the customerName check to ensure we properly process audits that have "Open Sample" values 
      if (audit.formName && !audit.auditId?.includes('DEMO-')) {
        console.log("Detected custom form from Form Builder:", audit.formName);
        
        // Try to load the form definition - this might have question text
        const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
        const formDef = savedForms.find((f: any) => f.name === audit.formName);
        let questionMap: Record<string, any> = {};
        
        // Build a map of question IDs to question objects
        if (formDef && formDef.sections) {
          console.log("Found form definition with sections:", formDef.sections.length);
          formDef.sections.forEach((section: any) => {
            if (section.questions) {
              section.questions.forEach((q: any) => {
                if (q.id) {
                  questionMap[q.id] = {
                    ...q,
                    section: section.name // Add section information to each question
                  };
                }
              });
            }
          });
          
          console.log("Built question map with", Object.keys(questionMap).length, "questions");
        }
        
        // First check for ratings in any format
        let ratingsMap: Record<string, any> = {};
        
        // Extract ratings from audit.ratings
        if (audit.ratings && typeof audit.ratings === 'object') {
          Object.entries(audit.ratings).forEach(([id, rating]) => {
            ratingsMap[id] = { rating };
          });
          console.log("Extracted ratings from audit.ratings:", Object.keys(ratingsMap).length);
        }
      }
    }
  }
`;