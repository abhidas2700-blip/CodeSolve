import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Database, Upload, AlertTriangle } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

export default function MigrationPage() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [initResult, setInitResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInitializeDatabase = async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const response = await apiRequest('POST', '/api/init-db');
      const result = await response.json();
      setInitResult(result);
    } catch (error: any) {
      setError(`Database initialization failed: ${error.message}`);
      console.error('Init error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleMigrateData = async () => {
    setIsMigrating(true);
    setError(null);
    
    try {
      // Collect all localStorage data
      const localStorageData: any = {};

      // Collect forms
      const formsData = localStorage.getItem('qa-audit-forms');
      if (formsData) {
        localStorageData.forms = JSON.parse(formsData);
      }

      // Collect reports from multiple sources
      const reportsData: any[] = [];
      
      const submittedAudits = localStorage.getItem('qa-submitted-audits');
      if (submittedAudits) {
        const audits = JSON.parse(submittedAudits);
        if (Array.isArray(audits)) {
          reportsData.push(...audits);
        }
      }

      const completedAudits = localStorage.getItem('qa-completed-audits');
      if (completedAudits) {
        const audits = JSON.parse(completedAudits);
        if (Array.isArray(audits)) {
          reportsData.push(...audits);
        }
      }

      const reports = localStorage.getItem('qa-reports');
      if (reports) {
        const reportsArray = JSON.parse(reports);
        if (Array.isArray(reportsArray)) {
          reportsData.push(...reportsArray);
        }
      }

      localStorageData.reports = reportsData;

      // Collect ATA reviews
      const ataData = localStorage.getItem('qa-ata-reviews');
      if (ataData) {
        localStorageData.ataReviews = JSON.parse(ataData);
      }

      console.log('Migrating data:', localStorageData);

      const response = await apiRequest('POST', '/api/migrate', { data: localStorageData });
      const result = await response.json();
      setMigrationResult(result);
    } catch (error: any) {
      setError(`Migration failed: ${error.message}`);
      console.error('Migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  const getLocalStorageStats = () => {
    const stats = {
      forms: 0,
      reports: 0,
      ataReviews: 0,
      users: 0
    };

    try {
      const forms = localStorage.getItem('qa-audit-forms');
      if (forms) {
        const formsArray = JSON.parse(forms);
        stats.forms = Array.isArray(formsArray) ? formsArray.length : 0;
      }

      // Count reports from all sources
      let totalReports = 0;
      
      const submitted = localStorage.getItem('qa-submitted-audits');
      if (submitted) {
        const submittedArray = JSON.parse(submitted);
        totalReports += Array.isArray(submittedArray) ? submittedArray.length : 0;
      }

      const completed = localStorage.getItem('qa-completed-audits');
      if (completed) {
        const completedArray = JSON.parse(completed);
        totalReports += Array.isArray(completedArray) ? completedArray.length : 0;
      }

      const reportsData = localStorage.getItem('qa-reports');
      if (reportsData) {
        const reportsArray = JSON.parse(reportsData);
        totalReports += Array.isArray(reportsArray) ? reportsArray.length : 0;
      }

      stats.reports = totalReports;

      const ata = localStorage.getItem('qa-ata-reviews');
      if (ata) {
        const ataArray = JSON.parse(ata);
        stats.ataReviews = Array.isArray(ataArray) ? ataArray.length : 0;
      }

      const users = localStorage.getItem('qa-users');
      if (users) {
        const usersArray = JSON.parse(users);
        stats.users = Array.isArray(usersArray) ? usersArray.length : 0;
      }
    } catch (error) {
      console.error('Error reading localStorage stats:', error);
    }

    return stats;
  };

  const stats = getLocalStorageStats();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Database Migration</h1>
        <p className="text-muted-foreground">
          Migrate your localStorage data to the PostgreSQL database for better performance and reliability.
        </p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Current Data Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Current localStorage Data
            </CardTitle>
            <CardDescription>
              Data currently stored in your browser's localStorage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Audit Forms:</span>
                <Badge variant={stats.forms > 0 ? "default" : "secondary"}>
                  {stats.forms}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Audit Reports:</span>
                <Badge variant={stats.reports > 0 ? "default" : "secondary"}>
                  {stats.reports}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>ATA Reviews:</span>
                <Badge variant={stats.ataReviews > 0 ? "default" : "secondary"}>
                  {stats.ataReviews}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Users:</span>
                <Badge variant={stats.users > 0 ? "default" : "secondary"}>
                  {stats.users}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Migration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Migration Status
            </CardTitle>
            <CardDescription>
              Status of data migration to database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {migrationResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Migration completed successfully!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Migrated {migrationResult.migratedCount} items to database
                </p>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <p>Click "Initialize Database" first, then "Migrate Data" to start the migration.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Initialize Database</CardTitle>
            <CardDescription>
              Set up the database tables and create default users (admin, Abhishek)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleInitializeDatabase}
              disabled={isInitializing}
              className="w-full md:w-auto"
            >
              {isInitializing ? 'Initializing...' : 'Initialize Database'}
            </Button>
            
            {initResult && (
              <Alert className="mt-4 border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  {initResult.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Migrate Data</CardTitle>
            <CardDescription>
              Transfer all your localStorage data to the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleMigrateData}
              disabled={isMigrating || (!initResult && !migrationResult)}
              className="w-full md:w-auto"
              variant={stats.forms + stats.reports + stats.ataReviews > 0 ? "default" : "secondary"}
            >
              {isMigrating ? 'Migrating...' : 'Migrate Data to Database'}
            </Button>

            {migrationResult && (
              <Alert className="mt-4 border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Successfully migrated {migrationResult.migratedCount} items to the database!
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Next Steps */}
      {migrationResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-green-600">Migration Complete!</CardTitle>
            <CardDescription>
              Your data has been successfully migrated to the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>✅ All data is now stored in PostgreSQL database</p>
              <p>✅ Better performance and reliability</p>
              <p>✅ Data persistence across sessions</p>
              <p>✅ Multi-user support enabled</p>
              <p className="pt-2 text-muted-foreground">
                You can now use all features of the SolveXtra audit system with database backing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}