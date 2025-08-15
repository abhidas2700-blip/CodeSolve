import { apiRequest } from "./queryClient";

// User Management
export const userService = {
  getAllUsers: async () => {
    const response = await apiRequest("GET", "/api/users");
    return await response.json();
  },

  getUserById: async (id: number) => {
    const response = await apiRequest("GET", `/api/users/${id}`);
    return await response.json();
  },

  createUser: async (userData: any) => {
    const response = await apiRequest("POST", "/api/users", userData);
    return await response.json();
  },

  updateUser: async (id: number, userData: any) => {
    const response = await apiRequest("PUT", `/api/users/${id}`, userData);
    return await response.json();
  },

  deleteUser: async (id: number) => {
    await apiRequest("DELETE", `/api/users/${id}`);
  }
};

// Audit Forms Management  
export const formsService = {
  getAllForms: async () => {
    const response = await apiRequest("GET", "/api/forms");
    return await response.json();
  },

  getFormById: async (id: number) => {
    const response = await apiRequest("GET", `/api/forms/${id}`);
    return await response.json();
  },

  createForm: async (formData: any) => {
    const response = await apiRequest("POST", "/api/forms", formData);
    return await response.json();
  },

  updateForm: async (id: number, formData: any) => {
    const response = await apiRequest("PUT", `/api/forms/${id}`, formData);
    return await response.json();
  },

  deleteForm: async (id: number) => {
    await apiRequest("DELETE", `/api/forms/${id}`);
  }
};

// Audit Reports Management
export const reportsService = {
  getAllReports: async () => {
    const response = await apiRequest("GET", "/api/reports");
    return await response.json();
  },

  getReportById: async (id: number) => {
    const response = await apiRequest("GET", `/api/reports/${id}`);
    return await response.json();
  },

  createReport: async (reportData: any) => {
    const response = await apiRequest("POST", "/api/reports", reportData);
    return await response.json();
  },

  updateReport: async (id: number, reportData: any) => {
    const response = await apiRequest("PUT", `/api/reports/${id}`, reportData);
    return await response.json();
  },

  deleteReport: async (id: number) => {
    await apiRequest("DELETE", `/api/reports/${id}`);
  }
};

// Skipped Samples Management
export const skippedSamplesService = {
  getAllSkippedSamples: async () => {
    const response = await apiRequest("GET", "/api/skipped-samples");
    return await response.json();
  },

  createSkippedSample: async (sampleData: any) => {
    const response = await apiRequest("POST", "/api/skipped-samples", sampleData);
    return await response.json();
  },

  deleteSkippedSample: async (id: number) => {
    await apiRequest("DELETE", `/api/skipped-samples/${id}`);
  }
};

// Deleted Audits Management
export const deletedAuditsService = {
  getAllDeletedAudits: async () => {
    const response = await apiRequest("GET", "/api/deleted-audits");
    return await response.json();
  },

  createDeletedAudit: async (auditData: any) => {
    const response = await apiRequest("POST", "/api/deleted-audits", auditData);
    return await response.json();
  }
};

// ATA Reviews Management
export const ataReviewsService = {
  getAllAtaReviews: async () => {
    const response = await apiRequest("GET", "/api/ata-reviews");
    return await response.json();
  },

  createAtaReview: async (reviewData: any) => {
    const response = await apiRequest("POST", "/api/ata-reviews", reviewData);
    return await response.json();
  },

  updateAtaReview: async (id: number, reviewData: any) => {
    const response = await apiRequest("PUT", `/api/ata-reviews/${id}`, reviewData);
    return await response.json();
  }
};

// Audit Samples Management
export const auditSamplesService = {
  getAllAuditSamples: async () => {
    const response = await apiRequest("GET", "/api/audit-samples");
    return await response.json();
  },

  createAuditSample: async (sampleData: any) => {
    const response = await apiRequest("POST", "/api/audit-samples", sampleData);
    return await response.json();
  },

  deleteAuditSample: async (auditId: string) => {
    await apiRequest("DELETE", `/api/audit-samples/${auditId}`);
  },

  deleteReport: async (id: number) => {
    await apiRequest("DELETE", `/api/reports/${id}`);
  }
};

// ATA Reviews Management
export const ataService = {
  getAllReviews: async () => {
    const response = await apiRequest("GET", "/api/ata-reviews");
    return await response.json();
  },

  getReviewById: async (id: number) => {
    const response = await apiRequest("GET", `/api/ata-reviews/${id}`);
    return await response.json();
  },

  createReview: async (reviewData: any) => {
    const response = await apiRequest("POST", "/api/ata-reviews", reviewData);
    return await response.json();
  },

  updateReview: async (id: number, reviewData: any) => {
    const response = await apiRequest("PUT", `/api/ata-reviews/${id}`, reviewData);
    return await response.json();
  },

  deleteReview: async (id: number) => {
    await apiRequest("DELETE", `/api/ata-reviews/${id}`);
  }
};

// Data Migration
export const migrationService = {
  migrateLocalStorageToDatabase: async () => {
    try {
      // Collect all localStorage data
      const localStorageData: any = {};

      // Collect forms
      const formsData = localStorage.getItem('qa-audit-forms');
      if (formsData) {
        try {
          localStorageData.forms = JSON.parse(formsData);
        } catch (e) {
          console.error('Error parsing forms data:', e);
        }
      }

      // Collect reports from multiple sources
      const reportsData: any[] = [];
      
      // From qa-submitted-audits
      const submittedAudits = localStorage.getItem('qa-submitted-audits');
      if (submittedAudits) {
        try {
          const audits = JSON.parse(submittedAudits);
          if (Array.isArray(audits)) {
            reportsData.push(...audits);
          }
        } catch (e) {
          console.error('Error parsing submitted audits:', e);
        }
      }

      // From qa-completed-audits
      const completedAudits = localStorage.getItem('qa-completed-audits');
      if (completedAudits) {
        try {
          const audits = JSON.parse(completedAudits);
          if (Array.isArray(audits)) {
            reportsData.push(...audits);
          }
        } catch (e) {
          console.error('Error parsing completed audits:', e);
        }
      }

      // From qa-reports
      const reports = localStorage.getItem('qa-reports');
      if (reports) {
        try {
          const reportsArray = JSON.parse(reports);
          if (Array.isArray(reportsArray)) {
            reportsData.push(...reportsArray);
          }
        } catch (e) {
          console.error('Error parsing reports:', e);
        }
      }

      localStorageData.reports = reportsData;

      // Collect ATA reviews
      const ataData = localStorage.getItem('qa-ata-reviews');
      if (ataData) {
        try {
          localStorageData.ataReviews = JSON.parse(ataData);
        } catch (e) {
          console.error('Error parsing ATA reviews:', e);
        }
      }

      console.log('Migrating localStorage data:', localStorageData);

      const response = await apiRequest("POST", "/api/migrate", { data: localStorageData });
      return await response.json();
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }
};