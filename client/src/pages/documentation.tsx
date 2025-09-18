import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function Documentation() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Documentation</h1>
      
      <Tabs defaultValue="getting-started" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
          <TabsTrigger value="user-guide">User Guide</TabsTrigger>
          <TabsTrigger value="admin-guide">Admin Guide</TabsTrigger>
          <TabsTrigger value="api">API Reference</TabsTrigger>
        </TabsList>
        
        <TabsContent value="getting-started">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started with SolveXtra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium text-lg">Welcome to SolveXtra</h3>
                <p className="text-muted-foreground">
                  SolveXtra is a comprehensive quality auditing platform designed to help organizations manage and improve their quality control processes.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-lg">Key Features</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Create customizable audit forms with various question types</li>
                  <li>Conduct audits on agents/employees</li>
                  <li>View and manage audit reports</li>
                  <li>Export data for offline analysis</li>
                  <li>Master auditor system to ensure consistency among auditors</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-lg">First Steps</h3>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Log in with your credentials</li>
                  <li>Navigate to the Dashboard to see an overview of your auditing activity</li>
                  <li>Use the Forms tab to create or edit audit forms</li>
                  <li>Use the Audits tab to start conducting audits</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="user-guide">
          <Card>
            <CardHeader>
              <CardTitle>User Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                This section contains detailed information for regular users of the SolveXtra platform.
              </p>
              <p className="text-muted-foreground">
                Detailed user guide content will be added here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="admin-guide">
          <Card>
            <CardHeader>
              <CardTitle>Administrator Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                This section contains administrative documentation for managing SolveXtra.
              </p>
              <p className="text-muted-foreground">
                Detailed administrator guide content will be added here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                API documentation for developers integrating with SolveXtra.
              </p>
              <p className="text-muted-foreground">
                Detailed API reference content will be added here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}