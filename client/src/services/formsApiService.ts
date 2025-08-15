// API service for managing audit forms with database persistence

export class FormsApiService {
  
  // Get all forms from database
  static async getAllForms() {
    try {
      const response = await fetch('/api/forms', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch forms: ${response.status}`);
      }
      
      const forms = await response.json();
      console.log(`✅ Fetched ${forms.length} forms from database`);
      return forms;
    } catch (error) {
      console.error('❌ Error fetching forms:', error);
      return [];
    }
  }

  // Create new form in database
  static async createForm(formData: any) {
    try {
      console.log('📝 Creating form in database:', formData.name);
      
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          sections: formData.sections || [],
          settings: formData.settings || {}
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Form creation failed:', response.status, errorData);
        throw new Error(`Failed to create form: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      const newForm = await response.json();
      console.log(`✅ Created form "${newForm.name}" in database (ID: ${newForm.id})`);
      
      // Also save to localStorage for immediate UI update
      const localForms = JSON.parse(localStorage.getItem('qa-form-definitions') || '[]');
      localForms.push(newForm);
      localStorage.setItem('qa-form-definitions', JSON.stringify(localForms));
      
      return newForm;
    } catch (error) {
      console.error('❌ Error creating form:', error);
      throw error;
    }
  }

  // Update existing form
  static async updateForm(formId: number, formData: any) {
    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update form: ${response.status}`);
      }
      
      const updatedForm = await response.json();
      console.log(`✅ Updated form "${updatedForm.name}" in database`);
      return updatedForm;
    } catch (error) {
      console.error('❌ Error updating form:', error);
      throw error;
    }
  }

  // Delete form  
  static async deleteForm(formId: number) {
    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete form: ${response.status}`);
      }
      
      console.log(`✅ Deleted form ${formId} from database`);
      return await response.json();
    } catch (error) {
      console.error('❌ Error deleting form:', error);
      throw error;
    }
  }

  // Force sync localStorage forms to database
  static async syncLocalFormsToDatabase() {
    try {
      console.log('🔄 Syncing localStorage forms to database...');
      
      const localForms = JSON.parse(localStorage.getItem('qa-form-definitions') || '[]');
      console.log(`Found ${localForms.length} forms in localStorage to sync`);
      
      let synced = 0;
      for (const form of localForms) {
        try {
          await this.createForm(form);
          synced++;
        } catch (error) {
          console.log(`⚠️ Failed to sync form "${form.name}":`, error.message);
        }
      }
      
      console.log(`✅ Synced ${synced}/${localForms.length} forms to database`);
      return synced;
    } catch (error) {
      console.error('❌ Error syncing forms:', error);
      return 0;
    }
  }
}