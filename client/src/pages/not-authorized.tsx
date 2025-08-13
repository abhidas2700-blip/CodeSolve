import React from 'react';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle } from 'lucide-react';

interface NotAuthorizedProps {
  message?: string;
}

/**
 * A page that displays when a user tries to access a page they're not authorized to view
 */
const NotAuthorized: React.FC<NotAuthorizedProps> = ({ 
  message = "You don't have permission to access this page."
}) => {
  // Function to navigate back to dashboard or previous page
  const goBack = () => {
    window.history.back();
  };

  // Function to navigate to dashboard
  const goToDashboard = () => {
    // Dispatch a custom event to change the view
    const event = new CustomEvent('change-view', { 
      detail: { view: 'dashboard' } 
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="bg-amber-50 rounded-full p-6 mb-6">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
      </div>
      
      <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
      
      <p className="text-gray-600 text-center max-w-md mb-8">
        {message}
      </p>
      
      <div className="flex space-x-4">
        <Button 
          variant="outline" 
          onClick={goBack}
          className="flex items-center space-x-2"
        >
          <span>Go Back</span>
        </Button>
        
        <Button 
          onClick={goToDashboard}
          className="flex items-center space-x-2"
        >
          <Shield className="h-4 w-4 mr-2" />
          <span>Go to Dashboard</span>
        </Button>
      </div>
    </div>
  );
};

export default NotAuthorized;