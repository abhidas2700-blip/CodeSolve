import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Info, Database, Upload, Download, Save, ArrowRight, Loader2 } from 'lucide-react';
import DataMigrationModal from '@/components/DataMigrationModal';

// Interface for localStorage data stats
interface LocalStorageStats {
  users: number;
  forms: number;
  reports: number;
  ataReviews: number;
  deletedAudits: number;
}

const DatabaseSetupPage = () => {
  const [storageStats, setStorageStats] = useState<LocalStorageStats>({
    users: 0,
    forms: 0,
    reports: 0,
    ataReviews: 0,
    deletedAudits: 0
  });
  const [isChecking, setIsChecking] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [exportData, setExportData] = useState<string | null>(null);

  // Check localStorage data on load
  useEffect(() => {
    checkLocalStorageData();
  }, []);

  // Function to check local storage data
  const checkLocalStorageData = () => {
    setIsChecking(true);
    
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
      setStorageStats({
        users: users.length,
        forms: forms.length,
        reports: reports.length,
        ataReviews: ataReviews.length,
        deletedAudits: deletedAudits.length
      });
    } catch (error) {
      console.error('Error checking localStorage data:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Function to export local storage data
  const handleExportData = () => {
    try {
      const exportObject = {
        users: JSON.parse(localStorage.getItem('qa-users') || '[]'),
        forms: JSON.parse(localStorage.getItem('qa-audit-forms') || '[]'),
        reports: JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]'),
        ataReviews: JSON.parse(localStorage.getItem('qa-ata-reviews') || '[]'),
        deletedAudits: JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]')
      };
      
      const jsonData = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `solvextra-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  // Function to handle file import
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const importedData = JSON.parse(result);
        
        // Check if the imported data has expected structure
        if (importedData.users && importedData.forms && importedData.reports) {
          // Store in localStorage
          localStorage.setItem('qa-users', JSON.stringify(importedData.users));
          localStorage.setItem('qa-audit-forms', JSON.stringify(importedData.forms));
          localStorage.setItem('qa-submitted-audits', JSON.stringify(importedData.reports));
          
          if (importedData.ataReviews) {
            localStorage.setItem('qa-ata-reviews', JSON.stringify(importedData.ataReviews));
          }
          
          if (importedData.deletedAudits) {
            localStorage.setItem('qa-deleted-audits', JSON.stringify(importedData.deletedAudits));
          }
          
          // Refresh stats
          checkLocalStorageData();
          
          alert('Data imported successfully. Please refresh the page to see the imported data.');
        } else {
          alert('Invalid import file format. Expected users, forms, and reports properties.');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="container py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <Database className="mr-2 h-8 w-8" />
        SolveXtra Local Storage
      </h1>
      
      <div className="grid gap-6">
        {/* Local Storage Card */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Local Storage Status</CardTitle>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                <CheckCircle className="h-4 w-4 mr-1" />
                Available
              </Badge>
            </div>
            <CardDescription>
              SolveXtra is configured to use browser's local storage for data persistence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">Users</span>
                <Badge variant="outline">
                  {storageStats.users} entries
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">Audit Forms</span>
                <Badge variant="outline">
                  {storageStats.forms} entries
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">Audit Reports</span>
                <Badge variant="outline">
                  {storageStats.reports} entries
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">ATA Reviews</span>
                <Badge variant="outline">
                  {storageStats.ataReviews} entries
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">Deleted Audits</span>
                <Badge variant="outline">
                  {storageStats.deletedAudits} entries
                </Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={checkLocalStorageData} 
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Refresh Status'
              )}
            </Button>
            
            <Button 
              onClick={() => setShowMigrationModal(true)}
              variant="outline"
            >
              <Info className="h-4 w-4 mr-2" />
              Storage Details
            </Button>
          </CardFooter>
        </Card>
        
        {/* Export/Import Card */}
        <Card>
          <CardHeader>
            <CardTitle>Import / Export Data</CardTitle>
            <CardDescription>
              Backup your data or import from another SolveXtra instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Local Storage Only</AlertTitle>
              <AlertDescription>
                Data is stored in your browser's local storage and will be lost if you clear your browser data.
                We recommend regularly exporting your data as a backup.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Export Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download all data as a JSON file that can be imported later.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleExportData} 
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export to File
                  </Button>
                </CardFooter>
              </Card>
              
              <Card className="border border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Import Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a previously exported SolveXtra JSON file.
                  </p>
                  <input
                    type="file"
                    id="file-import"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => document.getElementById('file-import')?.click()}
                    className="w-full"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import from File
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </CardContent>
        </Card>
        
        {/* Reset Data Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Reset Local Storage</CardTitle>
            <CardDescription>
              Clear all local storage data (use with caution)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action will permanently delete all data stored in your browser's local storage.
                Export your data first if you want to keep a backup.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all local storage data? This action cannot be undone.')) {
                  localStorage.removeItem('qa-users');
                  localStorage.removeItem('qa-audit-forms');
                  localStorage.removeItem('qa-submitted-audits');
                  localStorage.removeItem('qa-ata-reviews');
                  localStorage.removeItem('qa-deleted-audits');
                  checkLocalStorageData();
                  alert('All data has been cleared from local storage. Please refresh the page.');
                }
              }}
              className="w-full"
            >
              Reset All Local Storage Data
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Check Storage Modal */}
      {showMigrationModal && (
        <DataMigrationModal onClose={() => setShowMigrationModal(false)} />
      )}
    </div>
  );
};

export default DatabaseSetupPage;