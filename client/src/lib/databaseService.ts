import { db, pool } from '@server/db';
import { users, auditForms, auditReports, ataReviews } from '@shared/schema';
import { eq, asc, desc } from 'drizzle-orm';

// User Types
interface User {
  id: number;
  username: string;
  password: string;
  rights: string[];
  is_inactive?: boolean;
}

// Auth Services
export const authService = {
  // Get current logged in user
  getCurrentUser: async () => {
    try {
      // Try to get from localStorage (for backward compatibility)
      const localUser = localStorage.getItem('qa-current-user');
      if (localUser) {
        return JSON.parse(localUser);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },
  
  login: async (username: string, password: string) => {
    try {
      // Get the user from the database
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      // Check if user exists and password matches
      if (user && user.password === password) {
        // Check if user is inactive
        if (user.is_inactive) {
          return { success: false, message: 'This account is inactive' };
        }
        
        // Store in localStorage for backward compatibility
        localStorage.setItem('qa-current-user', JSON.stringify({
          id: user.id,
          username: user.username,
          password: user.password,
          rights: user.rights,
          is_inactive: user.is_inactive
        }));
        
        return { success: true, user };
      }
      
      return { success: false, message: 'Invalid username or password' };
    } catch (error) {
      console.error('Login error:', error);
      
      // Try localStorage as fallback
      try {
        const localUsersJson = localStorage.getItem('qa-users');
        if (localUsersJson) {
          const localUsers = JSON.parse(localUsersJson);
          const user = localUsers.find((u: any) => u.username === username && u.password === password);
          
          if (user) {
            if (user.isInactive) {
              return { success: false, message: 'This account is inactive' };
            }
            
            localStorage.setItem('qa-current-user', JSON.stringify(user));
            return { success: true, user };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback login error:', fallbackError);
      }
      
      return { success: false, message: 'Error during login' };
    }
  },
  
  logout: async () => {
    try {
      // Clear localStorage
      localStorage.removeItem('qa-current-user');
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, message: 'Error during logout' };
    }
  },
  
  register: async (userData: Omit<User, 'id'>) => {
    try {
      // Create new user in database
      const [newUser] = await db.insert(users).values(userData).returning();
      
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      
      // Try localStorage as fallback
      try {
        const localUsersJson = localStorage.getItem('qa-users');
        let localUsers = localUsersJson ? JSON.parse(localUsersJson) : [];
        
        // Check if username already exists
        if (localUsers.some((u: any) => u.username === userData.username)) {
          return { success: false, message: 'Username already exists' };
        }
        
        const newUser = {
          id: localUsers.length > 0 ? Math.max(...localUsers.map((u: any) => u.id)) + 1 : 1,
          ...userData
        };
        
        localUsers.push(newUser);
        localStorage.setItem('qa-users', JSON.stringify(localUsers));
        
        return { success: true, user: newUser };
      } catch (fallbackError) {
        console.error('Fallback registration error:', fallbackError);
      }
      
      return { success: false, message: 'Error during registration' };
    }
  },
  
  updateUser: async (id: number, userData: Partial<User>) => {
    try {
      // Update user in database
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      
      // Update localStorage if this is the current user
      const currentUser = localStorage.getItem('qa-current-user');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        if (user.id === id) {
          localStorage.setItem('qa-current-user', JSON.stringify({
            ...user,
            ...userData
          }));
        }
      }
      
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('User update error:', error);
      
      // Try localStorage as fallback
      try {
        const localUsersJson = localStorage.getItem('qa-users');
        if (localUsersJson) {
          let localUsers = JSON.parse(localUsersJson);
          const userIndex = localUsers.findIndex((u: any) => u.id === id);
          
          if (userIndex !== -1) {
            localUsers[userIndex] = { ...localUsers[userIndex], ...userData };
            localStorage.setItem('qa-users', JSON.stringify(localUsers));
            
            // Update current user if needed
            const currentUser = localStorage.getItem('qa-current-user');
            if (currentUser) {
              const user = JSON.parse(currentUser);
              if (user.id === id) {
                localStorage.setItem('qa-current-user', JSON.stringify({
                  ...user,
                  ...userData
                }));
              }
            }
            
            return { success: true, user: localUsers[userIndex] };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback user update error:', fallbackError);
      }
      
      return { success: false, message: 'Error updating user' };
    }
  },
  
  deleteUser: async (id: number) => {
    try {
      // Delete user from database
      await db.delete(users).where(eq(users.id, id));
      
      return { success: true };
    } catch (error) {
      console.error('User deletion error:', error);
      
      // Try localStorage as fallback
      try {
        const localUsersJson = localStorage.getItem('qa-users');
        if (localUsersJson) {
          let localUsers = JSON.parse(localUsersJson);
          localUsers = localUsers.filter((u: any) => u.id !== id);
          localStorage.setItem('qa-users', JSON.stringify(localUsers));
          
          return { success: true };
        }
      } catch (fallbackError) {
        console.error('Fallback user deletion error:', fallbackError);
      }
      
      return { success: false, message: 'Error deleting user' };
    }
  },
  
  getAllUsers: async () => {
    try {
      // Get all users from database
      const allUsers = await db.select().from(users).orderBy(users.id);
      
      return allUsers || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      
      // Try localStorage as fallback
      try {
        const localUsersJson = localStorage.getItem('qa-users');
        if (localUsersJson) {
          return JSON.parse(localUsersJson);
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching users:', fallbackError);
      }
      
      return [];
    }
  }
};

// Audit Forms Service
export const formsService = {
  getAllForms: async () => {
    try {
      // Get all forms from database
      const allForms = await db
        .select()
        .from(auditForms)
        .orderBy(auditForms.created_at, { direction: 'desc' });
      
      return allForms.map(form => ({
        id: form.id,
        name: form.name,
        sections: form.sections,
        createdAt: form.created_at?.toISOString(),
        createdBy: form.created_by
      })) || [];
    } catch (error) {
      console.error('Error fetching forms:', error);
      
      // Try localStorage as fallback
      try {
        const localFormsJson = localStorage.getItem('qa-audit-forms');
        if (localFormsJson) {
          return JSON.parse(localFormsJson);
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching forms:', fallbackError);
      }
      
      return [];
    }
  },
  
  getFormById: async (id: number) => {
    try {
      // Get form by id from database
      const [form] = await db
        .select()
        .from(auditForms)
        .where(eq(auditForms.id, id));
      
      if (form) {
        return {
          id: form.id,
          name: form.name,
          sections: form.sections,
          createdAt: form.created_at?.toISOString(),
          createdBy: form.created_by
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching form:', error);
      
      // Try localStorage as fallback
      try {
        const localFormsJson = localStorage.getItem('qa-audit-forms');
        if (localFormsJson) {
          const localForms = JSON.parse(localFormsJson);
          return localForms.find((f: any) => f.id === id) || null;
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching form:', fallbackError);
      }
      
      return null;
    }
  },
  
  createForm: async (formData: any) => {
    try {
      // Create new form in database
      const [newForm] = await db
        .insert(auditForms)
        .values({
          name: formData.name,
          sections: formData.sections,
          created_at: formData.createdAt ? new Date(formData.createdAt) : new Date(),
          created_by: formData.createdBy || null
        })
        .returning();
      
      return { 
        success: true, 
        form: {
          id: newForm.id,
          name: newForm.name,
          sections: newForm.sections,
          createdAt: newForm.created_at?.toISOString(),
          createdBy: newForm.created_by
        } 
      };
    } catch (error) {
      console.error('Error creating form:', error);
      
      // Try localStorage as fallback
      try {
        const localFormsJson = localStorage.getItem('qa-audit-forms');
        let localForms = localFormsJson ? JSON.parse(localFormsJson) : [];
        
        const newForm = {
          id: localForms.length > 0 ? Math.max(...localForms.map((f: any) => f.id)) + 1 : 1,
          ...formData,
          createdAt: formData.createdAt || new Date().toISOString()
        };
        
        localForms.push(newForm);
        localStorage.setItem('qa-audit-forms', JSON.stringify(localForms));
        
        return { success: true, form: newForm };
      } catch (fallbackError) {
        console.error('Fallback error creating form:', fallbackError);
      }
      
      return { success: false, message: 'Error creating form' };
    }
  },
  
  updateForm: async (id: number, formData: any) => {
    try {
      // Update form in database
      const [updatedForm] = await db
        .update(auditForms)
        .set({
          name: formData.name,
          sections: formData.sections,
          created_by: formData.createdBy || null
        })
        .where(eq(auditForms.id, id))
        .returning();
      
      return { 
        success: true, 
        form: {
          id: updatedForm.id,
          name: updatedForm.name,
          sections: updatedForm.sections,
          createdAt: updatedForm.created_at?.toISOString(),
          createdBy: updatedForm.created_by
        } 
      };
    } catch (error) {
      console.error('Error updating form:', error);
      
      // Try localStorage as fallback
      try {
        const localFormsJson = localStorage.getItem('qa-audit-forms');
        if (localFormsJson) {
          let localForms = JSON.parse(localFormsJson);
          const formIndex = localForms.findIndex((f: any) => f.id === id);
          
          if (formIndex !== -1) {
            localForms[formIndex] = { ...localForms[formIndex], ...formData };
            localStorage.setItem('qa-audit-forms', JSON.stringify(localForms));
            
            return { success: true, form: localForms[formIndex] };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback error updating form:', fallbackError);
      }
      
      return { success: false, message: 'Error updating form' };
    }
  },
  
  deleteForm: async (id: number) => {
    try {
      // Delete form from database
      await db.delete(auditForms).where(eq(auditForms.id, id));
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting form:', error);
      
      // Try localStorage as fallback
      try {
        const localFormsJson = localStorage.getItem('qa-audit-forms');
        if (localFormsJson) {
          let localForms = JSON.parse(localFormsJson);
          localForms = localForms.filter((f: any) => f.id !== id);
          localStorage.setItem('qa-audit-forms', JSON.stringify(localForms));
          
          return { success: true };
        }
      } catch (fallbackError) {
        console.error('Fallback error deleting form:', fallbackError);
      }
      
      return { success: false, message: 'Error deleting form' };
    }
  }
};

// Audit Reports Service
export const reportsService = {
  getAllReports: async () => {
    try {
      // Get all reports from database
      const allReports = await db
        .select()
        .from(auditReports)
        .orderBy(auditReports.timestamp, { direction: 'desc' });
      
      return allReports.map(report => ({
        id: report.id,
        auditId: report.audit_id,
        agent: report.agent,
        agentId: report.agent_id,
        auditor: report.auditor,
        formName: report.form_name,
        timestamp: Number(report.timestamp),
        score: Number(report.score),
        maxScore: Number(report.max_score),
        hasFatal: report.has_fatal,
        status: report.status,
        answers: report.answers,
        editHistory: report.edit_history
      })) || [];
    } catch (error) {
      console.error('Error fetching reports:', error);
      
      // Try localStorage as fallback
      try {
        const localReportsJson = localStorage.getItem('qa-submitted-audits');
        if (localReportsJson) {
          return JSON.parse(localReportsJson);
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching reports:', fallbackError);
      }
      
      return [];
    }
  },
  
  getReportsByAuditor: async (auditor: string) => {
    try {
      // Get reports by auditor from database
      const reports = await db
        .select()
        .from(auditReports)
        .where(eq(auditReports.auditor, auditor))
        .orderBy(auditReports.timestamp, { direction: 'desc' });
      
      return reports.map(report => ({
        id: report.id,
        auditId: report.audit_id,
        agent: report.agent,
        agentId: report.agent_id,
        auditor: report.auditor,
        formName: report.form_name,
        timestamp: Number(report.timestamp),
        score: Number(report.score),
        maxScore: Number(report.max_score),
        hasFatal: report.has_fatal,
        status: report.status,
        answers: report.answers,
        editHistory: report.edit_history
      })) || [];
    } catch (error) {
      console.error('Error fetching reports by auditor:', error);
      
      // Try localStorage as fallback
      try {
        const localReportsJson = localStorage.getItem('qa-submitted-audits');
        if (localReportsJson) {
          const localReports = JSON.parse(localReportsJson);
          return localReports.filter((r: any) => r.auditor === auditor) || [];
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching reports by auditor:', fallbackError);
      }
      
      return [];
    }
  },
  
  getReportById: async (id: string) => {
    try {
      // Get report by id from database
      const [report] = await db
        .select()
        .from(auditReports)
        .where(eq(auditReports.id, id));
      
      if (report) {
        return {
          id: report.id,
          auditId: report.audit_id,
          agent: report.agent,
          agentId: report.agent_id,
          auditor: report.auditor,
          formName: report.form_name,
          timestamp: Number(report.timestamp),
          score: Number(report.score),
          maxScore: Number(report.max_score),
          hasFatal: report.has_fatal,
          status: report.status,
          answers: report.answers,
          editHistory: report.edit_history
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching report:', error);
      
      // Try localStorage as fallback
      try {
        const localReportsJson = localStorage.getItem('qa-submitted-audits');
        if (localReportsJson) {
          const localReports = JSON.parse(localReportsJson);
          return localReports.find((r: any) => r.id === id) || null;
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching report:', fallbackError);
      }
      
      return null;
    }
  },
  
  createReport: async (reportData: any) => {
    try {
      // Create new report in database
      const [newReport] = await db
        .insert(auditReports)
        .values({
          id: reportData.id,
          audit_id: reportData.auditId || reportData.id,
          agent: reportData.agent,
          agent_id: reportData.agentId || '',
          auditor: reportData.auditor || '',
          form_name: reportData.formName,
          timestamp: BigInt(reportData.timestamp),
          score: reportData.score,
          max_score: reportData.maxScore || 100,
          has_fatal: reportData.hasFatal || false,
          status: reportData.status || 'completed',
          answers: reportData.sectionAnswers || reportData.answers || [],
          edit_history: reportData.editHistory || null
        })
        .returning();
      
      return { 
        success: true, 
        report: {
          id: newReport.id,
          auditId: newReport.audit_id,
          agent: newReport.agent,
          agentId: newReport.agent_id,
          auditor: newReport.auditor,
          formName: newReport.form_name,
          timestamp: Number(newReport.timestamp),
          score: Number(newReport.score),
          maxScore: Number(newReport.max_score),
          hasFatal: newReport.has_fatal,
          status: newReport.status,
          answers: newReport.answers,
          editHistory: newReport.edit_history
        } 
      };
    } catch (error) {
      console.error('Error creating report:', error);
      
      // Try localStorage as fallback
      try {
        const localReportsJson = localStorage.getItem('qa-submitted-audits');
        let localReports = localReportsJson ? JSON.parse(localReportsJson) : [];
        
        localReports.push(reportData);
        localStorage.setItem('qa-submitted-audits', JSON.stringify(localReports));
        
        return { success: true, report: reportData };
      } catch (fallbackError) {
        console.error('Fallback error creating report:', fallbackError);
      }
      
      return { success: false, message: 'Error creating report' };
    }
  },
  
  updateReport: async (id: string, reportData: any) => {
    try {
      // Update report in database
      const [updatedReport] = await db
        .update(auditReports)
        .set({
          audit_id: reportData.auditId || reportData.id,
          agent: reportData.agent,
          agent_id: reportData.agentId || '',
          auditor: reportData.auditor || '',
          form_name: reportData.formName,
          score: reportData.score,
          max_score: reportData.maxScore || 100,
          has_fatal: reportData.hasFatal || false,
          status: reportData.status || 'completed',
          answers: reportData.sectionAnswers || reportData.answers || [],
          edit_history: reportData.editHistory || null
        })
        .where(eq(auditReports.id, id))
        .returning();
      
      return { 
        success: true, 
        report: {
          id: updatedReport.id,
          auditId: updatedReport.audit_id,
          agent: updatedReport.agent,
          agentId: updatedReport.agent_id,
          auditor: updatedReport.auditor,
          formName: updatedReport.form_name,
          timestamp: Number(updatedReport.timestamp),
          score: Number(updatedReport.score),
          maxScore: Number(updatedReport.max_score),
          hasFatal: updatedReport.has_fatal,
          status: updatedReport.status,
          answers: updatedReport.answers,
          editHistory: updatedReport.edit_history
        }
      };
    } catch (error) {
      console.error('Error updating report:', error);
      
      // Try localStorage as fallback
      try {
        const localReportsJson = localStorage.getItem('qa-submitted-audits');
        if (localReportsJson) {
          let localReports = JSON.parse(localReportsJson);
          const reportIndex = localReports.findIndex((r: any) => r.id === id);
          
          if (reportIndex !== -1) {
            localReports[reportIndex] = { ...localReports[reportIndex], ...reportData };
            localStorage.setItem('qa-submitted-audits', JSON.stringify(localReports));
            
            return { success: true, report: localReports[reportIndex] };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback error updating report:', fallbackError);
      }
      
      return { success: false, message: 'Error updating report' };
    }
  },
  
  deleteReport: async (id: string, deletedBy: string) => {
    try {
      // First get the report to save to deleted_audits
      const [report] = await db
        .select()
        .from(auditReports)
        .where(eq(auditReports.id, id));
      
      if (report) {
        // Save to deleted_audits
        await db
          .insert(deletedAudits)
          .values({
            original_id: report.id,
            audit_id: report.audit_id,
            agent: report.agent,
            form_name: report.form_name,
            timestamp: report.timestamp,
            score: report.score,
            deleted_by: deletedBy,
            deleted_at: BigInt(Date.now()),
            edit_history: report.edit_history
          });
      }
      
      // Delete the report
      await db.delete(auditReports).where(eq(auditReports.id, id));
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting report:', error);
      
      // Try localStorage as fallback
      try {
        const localReportsJson = localStorage.getItem('qa-submitted-audits');
        if (localReportsJson) {
          let localReports = JSON.parse(localReportsJson);
          const reportToDelete = localReports.find((r: any) => r.id === id);
          
          if (reportToDelete) {
            // Save to deleted reports
            const deletedReportsJson = localStorage.getItem('qa-deleted-audits');
            let deletedReports = deletedReportsJson ? JSON.parse(deletedReportsJson) : [];
            
            deletedReports.push({
              id: reportToDelete.id,
              auditId: reportToDelete.auditId || reportToDelete.id,
              agent: reportToDelete.agent,
              formName: reportToDelete.formName,
              timestamp: reportToDelete.timestamp,
              score: reportToDelete.score,
              deletedBy: deletedBy,
              deletedAt: Date.now(),
              editHistory: reportToDelete.editHistory || null
            });
            
            localStorage.setItem('qa-deleted-audits', JSON.stringify(deletedReports));
            
            // Remove from reports
            localReports = localReports.filter((r: any) => r.id !== id);
            localStorage.setItem('qa-submitted-audits', JSON.stringify(localReports));
          }
          
          return { success: true };
        }
      } catch (fallbackError) {
        console.error('Fallback error deleting report:', fallbackError);
      }
      
      return { success: false, message: 'Error deleting report' };
    }
  },
  
  getDeletedReports: async () => {
    try {
      // Get all deleted reports from database
      const deletedReports = await db
        .select()
        .from(deletedAudits)
        .orderBy(deletedAudits.deleted_at, { direction: 'desc' });
      
      return deletedReports.map(report => ({
        id: report.id,
        originalId: report.original_id,
        auditId: report.audit_id,
        agent: report.agent,
        formName: report.form_name,
        timestamp: Number(report.timestamp),
        score: Number(report.score),
        deletedBy: report.deleted_by,
        deletedAt: Number(report.deleted_at),
        editHistory: report.edit_history
      })) || [];
    } catch (error) {
      console.error('Error fetching deleted reports:', error);
      
      // Try localStorage as fallback
      try {
        const deletedReportsJson = localStorage.getItem('qa-deleted-audits');
        if (deletedReportsJson) {
          return JSON.parse(deletedReportsJson);
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching deleted reports:', fallbackError);
      }
      
      return [];
    }
  }
};

// ATA Reviews Service
export const ataService = {
  getAllATAReviews: async () => {
    try {
      // Get all ATA reviews from database with their related audit reports
      const ataReviewsList = await db
        .select()
        .from(ataReviews)
        .orderBy(ataReviews.timestamp, { direction: 'desc' });
      
      const reviews = [];
      for (const review of ataReviewsList) {
        // Get the related audit report
        const [auditReport] = await db
          .select()
          .from(auditReports)
          .where(eq(auditReports.id, review.audit_report_id));
        
        reviews.push({
          id: review.id,
          auditReportId: review.audit_report_id,
          ataAuditor: review.ata_auditor,
          timestamp: Number(review.timestamp),
          overallRating: Number(review.overall_rating),
          comments: review.comments,
          questionRatings: review.question_ratings,
          variance: review.variance,
          auditReport: auditReport ? {
            id: auditReport.id,
            auditId: auditReport.audit_id,
            agent: auditReport.agent,
            agentId: auditReport.agent_id,
            auditor: auditReport.auditor,
            formName: auditReport.form_name,
            timestamp: Number(auditReport.timestamp),
            score: Number(auditReport.score),
            maxScore: Number(auditReport.max_score),
            hasFatal: auditReport.has_fatal,
            status: auditReport.status,
            answers: auditReport.answers,
            editHistory: auditReport.edit_history
          } : null
        });
      }
      
      return reviews || [];
    } catch (error) {
      console.error('Error fetching ATA reviews:', error);
      
      // Try localStorage as fallback
      try {
        const ataReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (ataReviewsJson) {
          return JSON.parse(ataReviewsJson);
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching ATA reviews:', fallbackError);
      }
      
      return [];
    }
  },
  
  getATAReviewById: async (id: number) => {
    try {
      // Get ATA review by id from database
      const [review] = await db
        .select()
        .from(ataReviews)
        .where(eq(ataReviews.id, id));
      
      if (review) {
        // Get the related audit report
        const [auditReport] = await db
          .select()
          .from(auditReports)
          .where(eq(auditReports.id, review.audit_report_id));
        
        return {
          id: review.id,
          auditReportId: review.audit_report_id,
          ataAuditor: review.ata_auditor,
          timestamp: Number(review.timestamp),
          overallRating: Number(review.overall_rating),
          comments: review.comments,
          questionRatings: review.question_ratings,
          variance: review.variance,
          auditReport: auditReport ? {
            id: auditReport.id,
            auditId: auditReport.audit_id,
            agent: auditReport.agent,
            agentId: auditReport.agent_id,
            auditor: auditReport.auditor,
            formName: auditReport.form_name,
            timestamp: Number(auditReport.timestamp),
            score: Number(auditReport.score),
            maxScore: Number(auditReport.max_score),
            hasFatal: auditReport.has_fatal,
            status: auditReport.status,
            answers: auditReport.answers,
            editHistory: auditReport.edit_history
          } : null
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ATA review:', error);
      
      // Try localStorage as fallback
      try {
        const ataReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (ataReviewsJson) {
          const ataReviews = JSON.parse(ataReviewsJson);
          return ataReviews.find((r: any) => r.id === id) || null;
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching ATA review:', fallbackError);
      }
      
      return null;
    }
  },
  
  getATAReviewByAuditId: async (auditReportId: string) => {
    try {
      // Get ATA review by audit report id from database
      const [review] = await db
        .select()
        .from(ataReviews)
        .where(eq(ataReviews.audit_report_id, auditReportId));
      
      if (review) {
        // Get the related audit report
        const [auditReport] = await db
          .select()
          .from(auditReports)
          .where(eq(auditReports.id, review.audit_report_id));
        
        return {
          id: review.id,
          auditReportId: review.audit_report_id,
          ataAuditor: review.ata_auditor,
          timestamp: Number(review.timestamp),
          overallRating: Number(review.overall_rating),
          comments: review.comments,
          questionRatings: review.question_ratings,
          variance: review.variance,
          auditReport: auditReport ? {
            id: auditReport.id,
            auditId: auditReport.audit_id,
            agent: auditReport.agent,
            agentId: auditReport.agent_id,
            auditor: auditReport.auditor,
            formName: auditReport.form_name,
            timestamp: Number(auditReport.timestamp),
            score: Number(auditReport.score),
            maxScore: Number(auditReport.max_score),
            hasFatal: auditReport.has_fatal,
            status: auditReport.status,
            answers: auditReport.answers,
            editHistory: auditReport.edit_history
          } : null
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ATA review by audit ID:', error);
      
      // Try localStorage as fallback
      try {
        const ataReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (ataReviewsJson) {
          const ataReviews = JSON.parse(ataReviewsJson);
          return ataReviews.find((r: any) => r.auditReportId === auditReportId) || null;
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching ATA review by audit ID:', fallbackError);
      }
      
      return null;
    }
  },
  
  createATAReview: async (reviewData: any) => {
    try {
      // Create new ATA review in database
      const [newReview] = await db
        .insert(ataReviews)
        .values({
          audit_report_id: reviewData.auditReportId,
          ata_auditor: reviewData.ataAuditor,
          timestamp: BigInt(reviewData.timestamp),
          overall_rating: reviewData.overallRating,
          comments: reviewData.comments,
          question_ratings: reviewData.questionRatings,
          variance: reviewData.variance
        })
        .returning();
      
      return { 
        success: true, 
        review: {
          id: newReview.id,
          auditReportId: newReview.audit_report_id,
          ataAuditor: newReview.ata_auditor,
          timestamp: Number(newReview.timestamp),
          overallRating: Number(newReview.overall_rating),
          comments: newReview.comments,
          questionRatings: newReview.question_ratings,
          variance: newReview.variance
        } 
      };
    } catch (error) {
      console.error('Error creating ATA review:', error);
      
      // Try localStorage as fallback
      try {
        const ataReviewsJson = localStorage.getItem('qa-ata-reviews');
        let ataReviews = ataReviewsJson ? JSON.parse(ataReviewsJson) : [];
        
        const newReview = {
          id: ataReviews.length > 0 ? Math.max(...ataReviews.map((r: any) => r.id)) + 1 : 1,
          ...reviewData
        };
        
        ataReviews.push(newReview);
        localStorage.setItem('qa-ata-reviews', JSON.stringify(ataReviews));
        
        return { success: true, review: newReview };
      } catch (fallbackError) {
        console.error('Fallback error creating ATA review:', fallbackError);
      }
      
      return { success: false, message: 'Error creating ATA review' };
    }
  },
  
  updateATAReview: async (id: number, reviewData: any) => {
    try {
      // Update ATA review in database
      const [updatedReview] = await db
        .update(ataReviews)
        .set({
          audit_report_id: reviewData.auditReportId,
          ata_auditor: reviewData.ataAuditor,
          overall_rating: reviewData.overallRating,
          comments: reviewData.comments,
          question_ratings: reviewData.questionRatings,
          variance: reviewData.variance
        })
        .where(eq(ataReviews.id, id))
        .returning();
      
      return { 
        success: true, 
        review: {
          id: updatedReview.id,
          auditReportId: updatedReview.audit_report_id,
          ataAuditor: updatedReview.ata_auditor,
          timestamp: Number(updatedReview.timestamp),
          overallRating: Number(updatedReview.overall_rating),
          comments: updatedReview.comments,
          questionRatings: updatedReview.question_ratings,
          variance: updatedReview.variance
        } 
      };
    } catch (error) {
      console.error('Error updating ATA review:', error);
      
      // Try localStorage as fallback
      try {
        const ataReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (ataReviewsJson) {
          let ataReviews = JSON.parse(ataReviewsJson);
          const reviewIndex = ataReviews.findIndex((r: any) => r.id === id);
          
          if (reviewIndex !== -1) {
            ataReviews[reviewIndex] = { ...ataReviews[reviewIndex], ...reviewData };
            localStorage.setItem('qa-ata-reviews', JSON.stringify(ataReviews));
            
            return { success: true, review: ataReviews[reviewIndex] };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback error updating ATA review:', fallbackError);
      }
      
      return { success: false, message: 'Error updating ATA review' };
    }
  },
  
  deleteATAReview: async (id: number) => {
    try {
      // Delete ATA review from database
      await db.delete(ataReviews).where(eq(ataReviews.id, id));
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting ATA review:', error);
      
      // Try localStorage as fallback
      try {
        const ataReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (ataReviewsJson) {
          let ataReviews = JSON.parse(ataReviewsJson);
          ataReviews = ataReviews.filter((r: any) => r.id !== id);
          localStorage.setItem('qa-ata-reviews', JSON.stringify(ataReviews));
          
          return { success: true };
        }
      } catch (fallbackError) {
        console.error('Fallback error deleting ATA review:', fallbackError);
      }
      
      return { success: false, message: 'Error deleting ATA review' };
    }
  }
};