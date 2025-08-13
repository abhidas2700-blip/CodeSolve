import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function ClearDataButton() {
  const { toast } = useToast();

  const clearAllExceptAdmin = () => {
    try {
      // Get current users
      const users = JSON.parse(localStorage.getItem('qa-users') || '[]');
      
      // Keep only the admin user
      const adminUser = users.find((user: any) => user.username === 'admin');
      
      if (adminUser) {
        // Save only the admin user
        localStorage.setItem('qa-users', JSON.stringify([adminUser]));
        
        // Remove all audit samples
        localStorage.removeItem('qa-audit-samples');
        localStorage.removeItem('qa-in-progress-audits');
        localStorage.removeItem('qa-completed-audits');
        localStorage.removeItem('qa-assigned-samples');
        localStorage.removeItem('qa-submitted-audits');
        localStorage.removeItem('qa-reports');
        
        toast({
          title: "Data Cleared",
          description: "All users except admin have been removed and all audit samples have been cleared.",
        });
        
        // Reload the page
        window.location.reload();
      } else {
        toast({
          title: "Error",
          description: "Admin user not found!",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Error",
        description: "Failed to clear data. See console for details.",
        variant: "destructive"
      });
    }
  };

  return (
    <Button 
      variant="destructive" 
      onClick={clearAllExceptAdmin}
      className="flex items-center gap-2"
    >
      Reset Data
    </Button>
  );
}
