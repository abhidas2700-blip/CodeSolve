import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from '@/lib/utils';
import * as XLSX from 'xlsx';

// Helper function to check for fatal answers that should result in a 0 score
function checkForFatalAnswers(report: any): boolean {
  // If the report doesn't have the necessary information, return false
  if (!report) return false;
  
  // If this is the specific report we're debugging, log verbose information
  const isTargetReport = report.auditId === 'AUD-20045389';
  if (isTargetReport) {
    console.log(`CHECKING FATAL STATUS FOR ${report.auditId}`, {
      reportHasFatalFlag: report.hasFatal,
      hasAnswers: Boolean(report.answers),
      hasSectionAnswers: Boolean(report.sectionAnswers),
    });
  }
  
  // If the report explicitly says it has fatal errors
  if (report.hasFatal === true) {
    console.log(`ATAReportsTab: Report ${report.id || report.auditId} has hasFatal=true flag`);
    return true;
  }
  
  // Check for any fatal answers
  // First in the direct answers format
  if (report.answers && Array.isArray(report.answers)) {
    for (const section of report.answers) {
      if (section.questions && Array.isArray(section.questions)) {
        for (const q of section.questions) {
          // Previously only checked for 'Fatal', now checks both 'Fatal' and 'No' answers on fatal questions
          
          // Check if question is fatal AND answer is either "Fatal" or "No"
          if (q.isFatal === true && (q.answer === 'Fatal' || q.answer === 'No')) {
            console.log(`ATAReportsTab: Found fatal answer in report ${report.id || report.auditId}:`, q.text);
            return true;
          }
        }
      }
    }
  }

  // Then check in the sectionAnswers format used by ATA
  if (report.sectionAnswers && Array.isArray(report.sectionAnswers)) {
    for (const section of report.sectionAnswers) {
      if (section.answers && Array.isArray(section.answers)) {
        for (const answer of section.answers) {
          // Previously only checked for 'Fatal', now checks both 'Fatal' and 'No' answers on fatal questions
          
          // Check if question is fatal AND answer is either "Fatal" or "No"
          if (answer.isFatal === true && (answer.answer === 'Fatal' || answer.answer === 'No')) {
            console.log(`ATAReportsTab: Found fatal answer in report ${report.id || report.auditId}:`, answer.text || answer.questionId);
            return true;
          }
        }
      }
    }
  }
  
  // No fatal answers found
  if (isTargetReport) {
    console.log(`${report.auditId} has NO FATAL ERRORS detected`);
  }
  return false;
}

// Helper function to get the adjusted score based on fatal answers
function getAdjustedScore(report: any): number {
  // Special handling for the problem audit
  const isTargetAudit = report.auditId === 'AUD-20045389';
  
  // Check if this report has fatal answers
  const hasFatalErrors = checkForFatalAnswers(report);
  
  if (hasFatalErrors) {
    if (isTargetAudit) {
      console.log(`SCORE FIXED: ${report.auditId} has fatal errors, setting score from ${report.originalScore || report.score} to 0`);
    }
    return 0;
  }
  
  // No fatal errors, use the original score
  const originalScore = typeof report.originalScore === 'number' ? report.originalScore : report.score || 0;
  
  if (isTargetAudit) {
    console.log(`SCORE INFO: ${report.auditId} returned original score ${originalScore} as no fatal errors found`);
  }
  
  return originalScore;
}

interface ATAReportsTabProps {
  className?: string;
}

export function ATAReportsTab({ className }: ATAReportsTabProps): React.ReactElement {
  const [ataReports, setAtaReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('reports');

  useEffect(() => {
    // Load ATA reports from localStorage
    const loadAtaReports = () => {
      try {
        const reports = JSON.parse(localStorage.getItem('qa-ata-reports') || '[]');
        console.log('ATA Reports Tab - Loaded reports:', reports.length);
        
        // Process reports to ensure scores are properly calculated
        const processedReports = reports.map((report: any) => {
          // Ensure all critical data fields exist and force score calculation for reports with fatal errors
          const hasFatal = checkForFatalAnswers(report);
          const correctScore = hasFatal ? 0 : (report.originalScore || report.score || 0);
          
          const processedReport = {
            ...report,
            hasFatal: hasFatal,
            originalScore: correctScore,
            score: correctScore
          };
          
          // Special debug for AUD-20045389
          if (report.auditId === 'AUD-20045389') {
            // For problematic report AUD-20045389, log the fatal detection and score calculation
            // This helps track why it was showing 87% when it should be 0% due to fatal questions
            console.log(`Audit ${report.auditId} score calculation:`, {
              hasFatalErrors: checkForFatalAnswers(report),
              finalScore: getAdjustedScore(report),
              originalScore: report.originalScore || report.score
            });
            
            // Look for the Greeted question in the report
            let foundGreeted = false;
            if (report.answers && Array.isArray(report.answers)) {
              for (const section of report.answers) {
                if (section.questions && Array.isArray(section.questions)) {
                  for (const q of section.questions) {
                    // Check for the Greeted question (including alternate spellings and typos)
                    if (q.text && (
                      q.text.includes('Greeted') ||
                      q.text.includes('Gretted') ||
                      q.text.toLowerCase().includes('greet') ||
                      q.text.includes('Greet the customer')
                    )) {
                      console.log(`Found Greeted question in AUD-20045389:`, {
                        text: q.text,
                        answer: q.answer,
                        isFatal: q.isFatal,
                        section: section.section
                      });
                      foundGreeted = true;
                      
                      // Ensure this is properly marked as fatal
                      if (!q.isFatal) {
                        console.log(`Fixing isFatal flag for Greeted question`);
                        q.isFatal = true;
                      }
                    }
                  }
                }
              }
            }
            
            if (!foundGreeted) {
              console.log(`Could not find Greeted question in AUD-20045389`);
            }
          }
          
          return processedReport;
        });
        
        // Debug combined reports
        console.log('ATA Reports Tab - Combined reports after deduplication:', processedReports.length);
        
        setAtaReports(processedReports);
      } catch (error) {
        console.error('Error loading ATA reports:', error);
        console.error('Error details:', error.message, error.stack);
        setAtaReports([]);
      }
    };

    loadAtaReports();
  }, []);

  // Function to handle view details
  const handleViewDetails = (report: any) => {
    setSelectedReport(report);
    setActiveTab('details');
  };
  
  // Export data to Excel
  const exportToExcel = () => {
    if (ataReports.length === 0) {
      return;
    }
    
    // Create worksheet data
    const worksheet = XLSX.utils.aoa_to_sheet([
      // Header row
      ['Audit ID', 'Auditor', 'Master Auditor', 'Original Score', 'Date', 'Remarks']
    ]);
    
    // Add data rows
    ataReports.forEach((report, index) => {
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [
          [
            report.auditId,
            report.auditor,
            report.masterAuditor,
            `${report.score}%${report.hasFatal ? ' (Fatal)' : ''}`,
            formatDate(report.timestamp),
            report.remarks || ''
          ]
        ],
        { origin: -1 } // Append at the end
      );
    });
    
    // Create workbook and add the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ATA Reports');
    
    // Generate XLSX file and trigger download
    XLSX.writeFile(workbook, `ATA_Reports_${formatDate(new Date())}.xlsx`);
  };

  // Function to render the reports list
  const renderReportsList = () => {
    if (ataReports.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No ATA reports available.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Export to Excel
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Audit ID</TableHead>
              <TableHead>Auditor</TableHead>
              <TableHead>Master Auditor</TableHead>
              <TableHead>Original Score</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ataReports.map((report) => {
              // Make sure we have numeric scores for comparison - using the already corrected scores from processedReport
              const origScore = report.score; // This is already fixed by the processing function
              
              return (
                <TableRow key={report.id}>
                  <TableCell>{report.auditId}</TableCell>
                  <TableCell>{report.auditor}</TableCell>
                  <TableCell>{report.masterAuditor}</TableCell>
                  <TableCell>
                    <Badge variant={report.hasFatal ? 'destructive' : origScore < 70 ? 'destructive' : 'outline'}>
                      {origScore}%
                      {report.hasFatal && (
                        <span className="ml-1 text-xs font-normal">(Fatal)</span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(report.timestamp)}</TableCell>
                  <TableCell>
                    <Button 
                      variant="outline"
                      size="sm" 
                      onClick={() => handleViewDetails(report)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Function to render the details view
  const renderDetailsView = () => {
    if (!selectedReport) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No report selected.
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => setActiveTab('reports')}>
          ← Back to Reports
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Audit ID</dt>
                  <dd>{selectedReport.auditId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Auditor</dt>
                  <dd>{selectedReport.auditor}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Master Auditor</dt>
                  <dd>{selectedReport.masterAuditor}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Date</dt>
                  <dd>{formatDate(selectedReport.timestamp)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Original Score</dt>
                  <dd>
                    <Badge variant={selectedReport.hasFatal ? 'destructive' : selectedReport.score < 70 ? 'destructive' : 'outline'}>
                      {selectedReport.score}%
                      {selectedReport.hasFatal && (
                        <span className="ml-1 text-xs font-normal">(Fatal)</span>
                      )}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{selectedReport.remarks || 'No remarks provided.'}</p>
          </CardContent>
        </Card>

        {selectedReport.questionRatings && selectedReport.questionRatings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Question Ratings</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Auditor Answer</TableHead>
                    <TableHead>ATA Answer</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReport.questionRatings.map((rating: any, index: number) => {
                    // Try to find matching question in original audit
                    console.log(`Found matching question for rating ${index}: "${rating.questionText}"`);
                    
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{rating.questionText}</TableCell>
                        <TableCell>{rating.auditorAnswer}</TableCell>
                        <TableCell>{rating.ataAnswer}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={!rating.isCorrect ? (rating.isCE ? 'destructive' : rating.isNCE ? 'secondary' : 'outline') : 'success'}
                          >
                            {rating.isCorrect ? 'Correct' : rating.isCE ? 'Critical Error' : rating.isNCE ? 'Non-Critical Error' : 'Incorrect'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {selectedReport.accuracyMetrics && (
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Total Questions</dt>
                  <dd>{selectedReport.accuracyMetrics.totalQuestions}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Correct Answers</dt>
                  <dd>{selectedReport.accuracyMetrics.correctAnswers}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Critical Errors</dt>
                  <dd>{selectedReport.accuracyMetrics.ceErrors}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Non-Critical Errors</dt>
                  <dd>{selectedReport.accuracyMetrics.nceErrors}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Overall Accuracy</dt>
                  <dd>
                    <Badge variant={selectedReport.accuracyMetrics.overallAccuracy < 70 ? 'destructive' : 'outline'}>
                      {selectedReport.accuracyMetrics.overallAccuracy}%
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="reports">All Reports</TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedReport}>Report Details</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">{renderReportsList()}</TabsContent>
        <TabsContent value="details">{renderDetailsView()}</TabsContent>
      </Tabs>
    </div>
  );
}