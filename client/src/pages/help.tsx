import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

export default function Help() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Help Center</h1>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Find answers to common questions about using ThorEye
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I create a new audit form?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-2">
                      To create a new audit form:
                    </p>
                    <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                      <li>Navigate to the Forms tab in the main navigation</li>
                      <li>Click the "Create New Form" button</li>
                      <li>Fill in the form details and add sections as needed</li>
                      <li>Add questions to each section with appropriate weightage</li>
                      <li>Save the form when complete</li>
                    </ol>
                    <p className="text-muted-foreground mt-2">
                      Note: You must have "Form Builder" rights to create or edit forms.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2">
                  <AccordionTrigger>How do I conduct an audit?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-2">
                      To conduct an audit:
                    </p>
                    <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                      <li>Navigate to the Audits tab in the main navigation</li>
                      <li>Click "Start New Audit"</li>
                      <li>Select the appropriate audit form</li>
                      <li>Enter the agent/employee details</li>
                      <li>Complete all the questions in each section</li>
                      <li>Review your answers before submission</li>
                      <li>Click "Submit" to finalize the audit</li>
                    </ol>
                    <p className="text-muted-foreground mt-2">
                      You can save drafts of incomplete audits and return to them later.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger>What is the ATA (Authority to Audit) feature?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      The Authority to Audit (ATA) feature is designed for master auditors to review and validate the work of other auditors. It ensures consistency and quality in the auditing process. Master auditors can review completed audits, provide ratings, identify critical and non-critical errors, and offer feedback to improve auditing accuracy.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I generate reports?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-2">
                      To generate reports:
                    </p>
                    <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                      <li>Navigate to the Reports tab in the main navigation</li>
                      <li>Use the filters to select the date range, agents, forms, or other criteria</li>
                      <li>Click "Generate Report" to view the results</li>
                      <li>Use the export options to download the report in your preferred format (CSV, Excel, PDF)</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-5">
                  <AccordionTrigger>How is the audit score calculated?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      Audit scores are calculated based on the weightage assigned to each question in the audit form. Each question contributes to the overall score based on its importance. Questions marked as "Fatal" can automatically fail an audit regardless of other scores. The platform also supports "Grazing Logic" where certain answers can reduce scores by a percentage rather than a fixed amount. The final score is presented as a percentage of the maximum possible points.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Need More Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium text-lg">Contact Support</h3>
                <p className="text-muted-foreground mt-2">
                  Our support team is available Monday-Friday, 9:00 AM to 5:00 PM EST.
                </p>
                <Button className="w-full mt-4">Email Support</Button>
              </div>
              
              <div className="pt-4">
                <h3 className="font-medium text-lg">Documentation</h3>
                <p className="text-muted-foreground mt-2">
                  Visit our comprehensive documentation for detailed guides and tutorials.
                </p>
                <Button variant="outline" className="w-full mt-4">View Documentation</Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Training Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-md p-4">
                  <h3 className="font-medium">Getting Started Guide</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    A comprehensive guide for new users
                  </p>
                  <Button variant="link" className="px-0 mt-2">Download PDF</Button>
                </div>
                
                <div className="border rounded-md p-4">
                  <h3 className="font-medium">Video Tutorials</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Watch step-by-step video guides
                  </p>
                  <Button variant="link" className="px-0 mt-2">Watch Now</Button>
                </div>
                
                <div className="border rounded-md p-4">
                  <h3 className="font-medium">Admin Manual</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Advanced configuration and administration
                  </p>
                  <Button variant="link" className="px-0 mt-2">View Manual</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}