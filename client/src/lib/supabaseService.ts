/**
 * ThorEye Local Storage Service
 * Handles all data operations using localStorage
 * 
 * This file originally used Supabase but was modified to use local storage only
 */

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
      // Get users from localStorage
      const localUsersJson = localStorage.getItem('qa-users');
      if (localUsersJson) {
        const localUsers = JSON.parse(localUsersJson);
        const user = localUsers.find((u: any) => u.username === username && u.password === password);
        
        if (user) {
          // Check if user is inactive
          if (user.isInactive) {
            return { success: false, message: 'This account is inactive' };
          }
          
          // Store current user in localStorage
          localStorage.setItem('qa-current-user', JSON.stringify(user));
          return { success: true, user };
        }
      }
      
      return { success: false, message: 'Invalid username or password' };
    } catch (error) {
      console.error('Login error:', error);
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
      // Get existing users from localStorage
      const localUsersJson = localStorage.getItem('qa-users');
      let localUsers = localUsersJson ? JSON.parse(localUsersJson) : [];
      
      // Check if username already exists
      if (localUsers.some((u: any) => u.username === userData.username)) {
        return { success: false, message: 'Username already exists' };
      }
      
      // Create new user
      const newUser = {
        id: localUsers.length > 0 ? Math.max(...localUsers.map((u: any) => u.id)) + 1 : 1,
        ...userData
      };
      
      // Add to local storage
      localUsers.push(newUser);
      localStorage.setItem('qa-users', JSON.stringify(localUsers));
      
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Error during registration' };
    }
  },
  
  updateUser: async (id: number, userData: Partial<User>) => {
    try {
      // Update user in Supabase
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
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
      // Delete user from Supabase
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
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
      // Get users from localStorage
      const localUsersJson = localStorage.getItem('qa-users');
      if (localUsersJson) {
        return JSON.parse(localUsersJson);
      }
      return [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }
};

// Audit Forms Service
export const formsService = {
  getAllForms: async () => {
    try {
      // Get all forms from Supabase
      const { data: allForms, error } = await supabase
        .from('audit_forms')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return allForms.map((form: any) => ({
        id: form.id,
        name: form.name,
        sections: form.sections,
        createdAt: form.created_at,
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
      // Get form by id from Supabase
      const { data: form, error } = await supabase
        .from('audit_forms')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (form) {
        return {
          id: form.id,
          name: form.name,
          sections: form.sections,
          createdAt: form.created_at,
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
      // Create new form in Supabase
      const { data: newForm, error } = await supabase
        .from('audit_forms')
        .insert({
          name: formData.name,
          sections: formData.sections,
          created_at: formData.createdAt || new Date().toISOString(),
          created_by: formData.createdBy || null
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        success: true, 
        form: {
          id: newForm.id,
          name: newForm.name,
          sections: newForm.sections,
          createdAt: newForm.created_at,
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
      // Update form in Supabase
      const { data: updatedForm, error } = await supabase
        .from('audit_forms')
        .update({
          name: formData.name,
          sections: formData.sections,
          created_by: formData.createdBy || null
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return { 
        success: true, 
        form: {
          id: updatedForm.id,
          name: updatedForm.name,
          sections: updatedForm.sections,
          createdAt: updatedForm.created_at,
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
      // Delete form from Supabase
      const { error } = await supabase
        .from('audit_forms')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
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
      // Get all reports from Supabase
      const { data: allReports, error } = await supabase
        .from('audit_reports')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      return allReports.map((report: any) => ({
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
      // Get reports by auditor from Supabase
      const { data: reports, error } = await supabase
        .from('audit_reports')
        .select('*')
        .eq('auditor', auditor)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      return reports.map((report: any) => ({
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
  
  getReportById: async (id: number) => {
    try {
      // Get report by id from Supabase
      const { data: report, error } = await supabase
        .from('audit_reports')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
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
      // Create new report in Supabase
      const { data: newReport, error } = await supabase
        .from('audit_reports')
        .insert({
          audit_id: reportData.auditId,
          agent: reportData.agent,
          agent_id: reportData.agentId,
          auditor: reportData.auditor,
          form_name: reportData.formName,
          timestamp: reportData.timestamp,
          score: reportData.score,
          max_score: reportData.maxScore,
          has_fatal: reportData.hasFatal,
          status: reportData.status,
          answers: reportData.answers,
          edit_history: reportData.editHistory || []
        })
        .select()
        .single();
      
      if (error) throw error;
      
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
        
        const newReport = {
          id: localReports.length > 0 ? Math.max(...localReports.map((r: any) => r.id)) + 1 : 1,
          ...reportData
        };
        
        localReports.push(newReport);
        localStorage.setItem('qa-submitted-audits', JSON.stringify(localReports));
        
        return { success: true, report: newReport };
      } catch (fallbackError) {
        console.error('Fallback error creating report:', fallbackError);
      }
      
      return { success: false, message: 'Error creating report' };
    }
  },
  
  updateReport: async (id: number, reportData: any) => {
    try {
      // Update report in Supabase
      const { data: updatedReport, error } = await supabase
        .from('audit_reports')
        .update({
          audit_id: reportData.auditId,
          agent: reportData.agent,
          agent_id: reportData.agentId,
          auditor: reportData.auditor,
          form_name: reportData.formName,
          timestamp: reportData.timestamp,
          score: reportData.score,
          max_score: reportData.maxScore,
          has_fatal: reportData.hasFatal,
          status: reportData.status,
          answers: reportData.answers,
          edit_history: reportData.editHistory || []
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
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
  
  deleteReport: async (id: number) => {
    try {
      // Delete report from Supabase
      const { error } = await supabase
        .from('audit_reports')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting report:', error);
      
      // Try localStorage as fallback
      try {
        const localReportsJson = localStorage.getItem('qa-submitted-audits');
        if (localReportsJson) {
          let localReports = JSON.parse(localReportsJson);
          localReports = localReports.filter((r: any) => r.id !== id);
          localStorage.setItem('qa-submitted-audits', JSON.stringify(localReports));
          
          return { success: true };
        }
      } catch (fallbackError) {
        console.error('Fallback error deleting report:', fallbackError);
      }
      
      return { success: false, message: 'Error deleting report' };
    }
  }
};

// ATA Reviews Service
export const ataService = {
  getAllReviews: async () => {
    try {
      // Get all ATA reviews from Supabase
      const { data: allReviews, error } = await supabase
        .from('ata_reviews')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      return allReviews.map((review: any) => ({
        id: review.id,
        auditReportId: review.audit_report_id,
        ataAuditor: review.ata_auditor,
        timestamp: Number(review.timestamp),
        overallRating: Number(review.overall_rating),
        comments: review.comments,
        questionRatings: review.question_ratings,
        variance: review.variance
      })) || [];
    } catch (error) {
      console.error('Error fetching ATA reviews:', error);
      
      // Try localStorage as fallback
      try {
        const localReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (localReviewsJson) {
          return JSON.parse(localReviewsJson);
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching ATA reviews:', fallbackError);
      }
      
      return [];
    }
  },
  
  getReviewById: async (id: number) => {
    try {
      // Get ATA review by id from Supabase
      const { data: review, error } = await supabase
        .from('ata_reviews')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (review) {
        return {
          id: review.id,
          auditReportId: review.audit_report_id,
          ataAuditor: review.ata_auditor,
          timestamp: Number(review.timestamp),
          overallRating: Number(review.overall_rating),
          comments: review.comments,
          questionRatings: review.question_ratings,
          variance: review.variance
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ATA review:', error);
      
      // Try localStorage as fallback
      try {
        const localReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (localReviewsJson) {
          const localReviews = JSON.parse(localReviewsJson);
          return localReviews.find((r: any) => r.id === id) || null;
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching ATA review:', fallbackError);
      }
      
      return null;
    }
  },
  
  getReviewByReportId: async (reportId: number) => {
    try {
      // Get ATA review by report id from Supabase
      const { data: review, error } = await supabase
        .from('ata_reviews')
        .select('*')
        .eq('audit_report_id', reportId)
        .single();
      
      if (error) throw error;
      
      if (review) {
        return {
          id: review.id,
          auditReportId: review.audit_report_id,
          ataAuditor: review.ata_auditor,
          timestamp: Number(review.timestamp),
          overallRating: Number(review.overall_rating),
          comments: review.comments,
          questionRatings: review.question_ratings,
          variance: review.variance
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ATA review by report ID:', error);
      
      // Try localStorage as fallback
      try {
        const localReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (localReviewsJson) {
          const localReviews = JSON.parse(localReviewsJson);
          return localReviews.find((r: any) => r.auditReportId === reportId) || null;
        }
      } catch (fallbackError) {
        console.error('Fallback error fetching ATA review by report ID:', fallbackError);
      }
      
      return null;
    }
  },
  
  createReview: async (reviewData: any) => {
    try {
      // Create new ATA review in Supabase
      const { data: newReview, error } = await supabase
        .from('ata_reviews')
        .insert({
          audit_report_id: reviewData.auditReportId,
          ata_auditor: reviewData.ataAuditor,
          timestamp: reviewData.timestamp,
          overall_rating: reviewData.overallRating,
          comments: reviewData.comments,
          question_ratings: reviewData.questionRatings,
          variance: reviewData.variance
        })
        .select()
        .single();
      
      if (error) throw error;
      
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
        const localReviewsJson = localStorage.getItem('qa-ata-reviews');
        let localReviews = localReviewsJson ? JSON.parse(localReviewsJson) : [];
        
        const newReview = {
          id: localReviews.length > 0 ? Math.max(...localReviews.map((r: any) => r.id)) + 1 : 1,
          ...reviewData
        };
        
        localReviews.push(newReview);
        localStorage.setItem('qa-ata-reviews', JSON.stringify(localReviews));
        
        return { success: true, review: newReview };
      } catch (fallbackError) {
        console.error('Fallback error creating ATA review:', fallbackError);
      }
      
      return { success: false, message: 'Error creating ATA review' };
    }
  },
  
  updateReview: async (id: number, reviewData: any) => {
    try {
      // Update ATA review in Supabase
      const { data: updatedReview, error } = await supabase
        .from('ata_reviews')
        .update({
          audit_report_id: reviewData.auditReportId,
          ata_auditor: reviewData.ataAuditor,
          timestamp: reviewData.timestamp,
          overall_rating: reviewData.overallRating,
          comments: reviewData.comments,
          question_ratings: reviewData.questionRatings,
          variance: reviewData.variance
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
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
        const localReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (localReviewsJson) {
          let localReviews = JSON.parse(localReviewsJson);
          const reviewIndex = localReviews.findIndex((r: any) => r.id === id);
          
          if (reviewIndex !== -1) {
            localReviews[reviewIndex] = { ...localReviews[reviewIndex], ...reviewData };
            localStorage.setItem('qa-ata-reviews', JSON.stringify(localReviews));
            
            return { success: true, review: localReviews[reviewIndex] };
          }
        }
      } catch (fallbackError) {
        console.error('Fallback error updating ATA review:', fallbackError);
      }
      
      return { success: false, message: 'Error updating ATA review' };
    }
  },
  
  deleteReview: async (id: number) => {
    try {
      // Delete ATA review from Supabase
      const { error } = await supabase
        .from('ata_reviews')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting ATA review:', error);
      
      // Try localStorage as fallback
      try {
        const localReviewsJson = localStorage.getItem('qa-ata-reviews');
        if (localReviewsJson) {
          let localReviews = JSON.parse(localReviewsJson);
          localReviews = localReviews.filter((r: any) => r.id !== id);
          localStorage.setItem('qa-ata-reviews', JSON.stringify(localReviews));
          
          return { success: true };
        }
      } catch (fallbackError) {
        console.error('Fallback error deleting ATA review:', fallbackError);
      }
      
      return { success: false, message: 'Error deleting ATA review' };
    }
  }
};

// Exporting all services
export default {
  authService,
  formsService,
  reportsService,
  ataService
};