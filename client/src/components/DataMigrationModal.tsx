import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Check, Info, AlertCircle, Database, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  simulateMigration,
  type MigrationProgress, 
  type MigrationResult 
} from '@/lib/dataMigration';

interface DataMigrationModalProps {
  onClose: () => void;
}

const DataMigrationModal = ({ onClose }: DataMigrationModalProps) => {
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress>({
    status: 'pending',
  });
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [localStorageStats, setLocalStorageStats] = useState({
    users: 0,
    forms: 0,
    reports: 0,
    ataReviews: 0,
    deletedAudits: 0
  });
  
  // Check localStorage data on load
  useEffect(() => {
    checkLocalStorage();
    startStorageCheck();
  }, []);
  
  const checkLocalStorage = () => {
    try {
      // Get data from localStorage
      const usersJson = localStorage.getItem('qa-users') || '[]';
      const formsJson = localStorage.getItem('qa-audit-forms') || '[]';
      const reportsJson = localStorage.getItem('qa-submitted-audits') || '[]';
      const ataReviewsJson = localStorage.getItem('qa-ata-reviews') || '[]';
      const deletedAuditsJson = localStorage.getItem('qa-deleted-audits') || '[]';
      
      // Parse the data
      const users = JSON.parse(usersJson);
      const forms = JSON.parse(formsJson);
      const reports = JSON.parse(reportsJson);
      const ataReviews = JSON.parse(ataReviewsJson);
      const deletedAudits = JSON.parse(deletedAuditsJson);
      
      // Update stats
      setLocalStorageStats({
        users: users.length,
        forms: forms.length,
        reports: reports.length,
        ataReviews: ataReviews.length,
        deletedAudits: deletedAudits.length
      });
    } catch (error) {
      console.error('Error checking localStorage:', error);
    }
  };
  
  const startStorageCheck = async () => {
    setMigrationProgress({ status: 'in_progress', progress: 0, totalSteps: 4 });
    setResult(null);
    
    try {
      const checkResult = await simulateMigration(setMigrationProgress);
      setResult(checkResult);
    } catch (error) {
      console.error('Error during storage check:', error);
      setMigrationProgress({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error checking storage'
      });
      
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error checking storage'
      });
    }
  };
  
  const renderProgressBar = () => {
    if (migrationProgress.status !== 'in_progress') return null;
    
    const progress = migrationProgress.progress || 0;
    const totalSteps = migrationProgress.totalSteps || 1;
    const percentage = Math.floor((progress / totalSteps) * 100);
    
    return (
      <div className="my-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span>{migrationProgress.currentStep}</span>
          <span>{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    );
  };
  
  const renderResults = () => {
    if (!result) return null;
    
    if (result.success) {
      return (
        <div className="my-6 space-y-4">
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Local Storage Check Complete</AlertTitle>
            <AlertDescription className="text-green-700">
              {result.message}
            </AlertDescription>
          </Alert>
          
          {result.details && (
            <div className="border rounded-md p-4 bg-gray-50 space-y-3">
              <h4 className="font-medium">Local Storage Contents</h4>
              <ul className="space-y-2 text-sm">
                {result.details.users && (
                  <li className="flex justify-between">
                    <span>Users:</span>
                    <span className="font-medium">{result.details.users.total}</span>
                  </li>
                )}
                {result.details.forms && (
                  <li className="flex justify-between">
                    <span>Forms:</span>
                    <span className="font-medium">{result.details.forms.total}</span>
                  </li>
                )}
                {result.details.reports && (
                  <li className="flex justify-between">
                    <span>Reports:</span>
                    <span className="font-medium">{result.details.reports.total}</span>
                  </li>
                )}
                {result.details.ataReviews && (
                  <li className="flex justify-between">
                    <span>ATA Reviews:</span>
                    <span className="font-medium">{result.details.ataReviews.total}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <Alert variant="destructive" className="my-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Storage Check Failed</AlertTitle>
          <AlertDescription>
            {result.message}
          </AlertDescription>
        </Alert>
      );
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Local Storage Details</DialogTitle>
          <DialogDescription>
            Information about data stored in your browser's local storage
          </DialogDescription>
        </DialogHeader>
        
        {migrationProgress.status === 'pending' && (
          <div className="py-6 space-y-6">
            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertTitle>Local Storage Information</AlertTitle>
              <AlertDescription>
                ThorEye is currently using your browser's local storage to save all data.
                This means your data is stored only on this device and will be lost if you clear your browser data.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        {renderProgressBar()}
        {renderResults()}
        
        <DialogFooter className="flex justify-end">
          <Button onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DataMigrationModal;