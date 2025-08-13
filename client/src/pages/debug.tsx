// Debug page has been removed from the production version
// This page was used during development for troubleshooting and debugging

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/context/auth-context';

export default function DebugPage() {
  const { user } = useAuth();

  if (!user?.rights?.includes('admin')) {
    return (
      <div className="container p-8">
        <Alert variant="destructive">
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">System Information</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Administrator Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The debug tools have been removed from the production version.
            Please contact system support if you need assistance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}