// API service for managing audit reports
export class ReportsApiService {
  
  // Get all active reports (excluding deleted ones)
  static async getAllReports() {
    try {
      const response = await fetch('/api/reports', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch reports: ${response.status}`);
      }
      
      const reports = await response.json();
      console.log(`✅ Fetched ${reports.length} active reports from database`);
      return reports;
    } catch (error) {
      console.error('❌ Error fetching reports:', error);
      return [];
    }
  }

  // Get single report by audit ID
  static async getReport(auditId: string) {
    try {
      const response = await fetch(`/api/reports/${auditId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Report not found or has been deleted');
        }
        throw new Error(`Failed to fetch report: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Error fetching report ${auditId}:`, error);
      throw error;
    }
  }

  // Update existing report
  static async updateReport(auditId: string, reportData: any) {
    try {
      const response = await fetch(`/api/reports/${auditId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(reportData)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Report not found or has been deleted');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to update report: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      const updatedReport = await response.json();
      console.log(`✅ Updated report ${auditId} in database`);
      return updatedReport;
    } catch (error) {
      console.error(`❌ Error updating report ${auditId}:`, error);
      throw error;
    }
  }

  // Create new report
  static async createReport(reportData: any) {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(reportData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create report: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      const newReport = await response.json();
      console.log(`✅ Created report ${newReport.auditId} in database`);
      return newReport;
    } catch (error) {
      console.error('❌ Error creating report:', error);
      throw error;
    }
  }

  // Delete report (soft delete)
  static async deleteReport(auditId: string) {
    try {
      const response = await fetch(`/api/reports/${auditId}/delete`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete report: ${response.status}`);
      }
      
      console.log(`✅ Deleted report ${auditId} from database`);
      return await response.json();
    } catch (error) {
      console.error(`❌ Error deleting report ${auditId}:`, error);
      throw error;
    }
  }
}