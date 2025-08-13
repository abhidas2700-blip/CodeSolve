import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface ATAReport {
  id: string;
  auditId: string;
  auditor: string;
  masterAuditor: string;
  originalScore: number;
  ataScore: number;
  variance: number; // Simple percentage difference
  timestamp: number;
  remarks: string;
  formName?: string; // Form name for filtering
  form?: string; // Alternative form name field
  questionRatings?: {
    questionId?: string;
    questionText: string;
    auditorAnswer: string;
    ataAnswer: string;
    isCorrect: boolean;
    isCE?: boolean; // Critical Error
    isNCE?: boolean; // Non-Critical Error
    comments?: string;
  }[];
  accuracyMetrics?: {
    totalQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    ceErrors: number;
    nceErrors: number;
    overallAccuracy: number;
  };
}

interface ATAReportTabProps {
  dateFrom?: Date;
  dateTo?: Date;
  isDateFilterActive?: boolean;
}

export default function ATAReportTab({ 
  dateFrom,
  dateTo,
  isDateFilterActive = false
}: ATAReportTabProps = {}) {
  const [ataReports, setAtaReports] = useState<ATAReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredReports, setFilteredReports] = useState<ATAReport[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [formFilter, setFormFilter] = useState<string>("all");
  const [availableForms, setAvailableForms] = useState<string[]>([]);
  const { user } = useAuth();

  // User has ATA access if they are admin, manager, or have explicit ATA rights
  const hasATAAccess = user?.rights?.includes('admin') || 
                       user?.rights?.includes('manager') || 
                       user?.rights?.includes('ata');

  useEffect(() => {
    // Load ATA Reports from both localStorage sources
    const savedReports = JSON.parse(localStorage.getItem('qa-ata-reports') || '[]');
    const mainReports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
    
    console.log('ATA Reports Tab - Loading from qa-ata-reports:', savedReports.length);
    console.log('ATA Reports Tab - Loading from qa-reports:', mainReports.length);
    console.log('Sample ATA report structure:', savedReports.length > 0 ? JSON.stringify(savedReports[0], null, 2) : 'No reports');
    console.log('Sample main report structure:', mainReports.length > 0 ? JSON.stringify(mainReports[0], null, 2) : 'No reports');
    
    // Create a map for all reports with ATA reviews from main reports
    const ataReportsFromMain = mainReports
      .filter((report: any) => report.ataReview)
      .map((report: any) => {
        // First, try to enhance the questionRatings with the actual question text and IDs
        let enhancedQuestionRatings = report.ataReview.questionRatings || [];
        
        console.log(`Processing report ${report.id} with ${report.answers?.length || 0} sections`);
        console.log(`Report has ${enhancedQuestionRatings.length} question ratings`);
        
        // If we have answers in the original report, use them to enhance the question ratings
        if (report.answers && report.answers.length > 0) {
          // Flatten all questions from all sections
          const allQuestions: any[] = [];
          
          for (const section of report.answers) {
            if (section.questions && section.questions.length > 0) {
              allQuestions.push(...section.questions);
            }
          }
          
          console.log(`Found ${allQuestions.length} questions in the report`);
          
          // Now enhance each question rating with the actual question text if possible
          enhancedQuestionRatings = enhancedQuestionRatings.map((rating: any, idx: any) => {
            // Try to find the matching question by index or ID
            const question = idx < allQuestions.length ? allQuestions[idx] : null;
            
            return {
              ...rating,
              questionText: rating.questionText || (question ? question.text : `Question ${idx + 1}`),
              questionId: rating.questionId || (question ? question.id : null)
            };
          });
        }
        
        // Extract form name from the original report if available
        const formName = report.formName || report.form || 
                        (report.formId ? `Form ${report.formId}` : null) || 
                        (report.id.includes('-') ? report.id.split('-')[0] : null);
                        
        // Now create the full ATA report from the report's ataReview
        return {
          id: report.ataReview.id || `ata-${report.id}`,
          auditId: report.id,
          auditor: report.auditor,
          masterAuditor: report.ataReview.masterAuditor,
          originalScore: report.score,
          ataScore: report.ataReview.score,
          variance: report.ataReview.variance,
          timestamp: report.ataReview.timestamp || report.timestamp,
          remarks: report.ataReview.remarks || '',
          formName: formName,  // Add form name for filtering
          form: formName,      // Alternative field for backward compatibility
          questionRatings: enhancedQuestionRatings,
          accuracyMetrics: report.ataReview.accuracyMetrics
        };
      });
    
    // Combine both sources of ATA reports
    let combinedReports = [...savedReports, ...ataReportsFromMain];
    
    // De-duplicate by id
    const uniqueReportIds = new Set();
    combinedReports = combinedReports.filter(report => {
      if (uniqueReportIds.has(report.id)) {
        return false;
      }
      uniqueReportIds.add(report.id);
      return true;
    });
    
    console.log(`ATA Reports Tab - Total combined unique reports: ${combinedReports.length}`);
    
    let accessibleReports = [];
    
    // Filter based on user rights
    if (hasATAAccess) {
      // Admin, managers, and ATA users can see all reports
      accessibleReports = combinedReports;
    } else {
      // Regular users can only see their own reports
      accessibleReports = combinedReports.filter((r: ATAReport) => r.auditor === user?.username);
    }
    
    // Apply date filtering if active
    if (isDateFilterActive && (dateFrom || dateTo)) {
      accessibleReports = accessibleReports.filter(report => {
        const reportDate = new Date(report.timestamp);
        
        if (dateFrom && dateTo) {
          return reportDate >= dateFrom && reportDate <= dateTo;
        } else if (dateFrom) {
          return reportDate >= dateFrom;
        } else if (dateTo) {
          return reportDate <= dateTo;
        }
        
        return true;
      });
    }
    
    // Sort by timestamp descending (newest first)
    accessibleReports.sort((a, b) => b.timestamp - a.timestamp);
    
    setAtaReports(accessibleReports);
    setFilteredReports(accessibleReports);
  }, [hasATAAccess, user?.username, dateFrom, dateTo, isDateFilterActive]);
  
  // Extract form names from reports
  useEffect(() => {
    if (ataReports.length > 0) {
      // Extract form names from the reports
      const formNames = ataReports
        .map(report => report.formName || report.form)
        .filter((formName): formName is string => !!formName) // Filter out undefined/null values
        .filter((value, index, self) => self.indexOf(value) === index) // Get unique values
        .sort(); // Sort alphabetically
      
      setAvailableForms(formNames);
      console.log(`Extracted ${formNames.length} form names from ATA reports`);
    }
  }, [ataReports]);

  // Search/filter function
  useEffect(() => {
    // Start with all reports
    let filtered = [...ataReports];
    
    // Apply form filter if not 'all'
    if (formFilter !== "all") {
      filtered = filtered.filter(report => 
        (report.formName === formFilter) || (report.form === formFilter)
      );
      console.log(`Form filter applied: ${filtered.length} ATA reports matching form "${formFilter}"`);
    }
    
    // Then apply search term filter
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(report => {
        return (
          report.id.toLowerCase().includes(lowerSearchTerm) ||
          report.auditId.toLowerCase().includes(lowerSearchTerm) ||
          report.auditor.toLowerCase().includes(lowerSearchTerm) ||
          report.masterAuditor.toLowerCase().includes(lowerSearchTerm)
        );
      });
    }
    
    setFilteredReports(filtered);
  }, [searchTerm, ataReports, formFilter]);
  
  const toggleReportDetails = (reportId: string) => {
    if (expandedReportId === reportId) {
      setExpandedReportId(null);
    } else {
      setExpandedReportId(reportId);
    }
  };
  
  // Helper function to display variance in a more readable format
  const getVarianceBadge = (variance: number) => {
    // For variance, use different colors based on the magnitude
    let bgColor = "";
    let textColor = "";
    
    if (variance <= 5) {
      bgColor = "bg-green-100";
      textColor = "text-green-800";
    } else if (variance <= 10) {
      bgColor = "bg-blue-100";
      textColor = "text-blue-800";
    } else if (variance <= 20) {
      bgColor = "bg-yellow-100";
      textColor = "text-yellow-800";
    } else {
      bgColor = "bg-red-100";
      textColor = "text-red-800";
    }
    
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        {variance}%
      </span>
    );
  };

  // Helper function to get question text from ATA report
  const getQuestionText = (ataReport: ATAReport, questionIndex: number): string | null => {
    if (!ataReport.questionRatings || questionIndex >= ataReport.questionRatings.length) {
      return null;
    }
    
    const rating = ataReport.questionRatings[questionIndex];
    return rating.questionText || `Question ${questionIndex + 1}`;
  };
  
  // If user doesn't have access, show a message
  if (!hasATAAccess) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Access Restricted</h3>
            <p className="text-gray-500 mt-2">
              You do not have permission to view ATA reports. Please contact an administrator if you need access.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // If there are no reports at all, show a message
  if (ataReports.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold">No ATA Reports Available</h3>
            <p className="text-gray-500 mt-2">
              There are no ATA (Audit Team Assessment) reports available at this time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
    
    return null;
  };

  // Create a sample report for testing
  const createSampleATAReport = () => {
    // Timestamp and ID for consistency between reports
    const timestamp = Date.now();
    const auditId = "AUD-" + Math.floor(Math.random() * 10000000);
    
    // For easier testing, create question IDs that will be consistent between reports
    const questionIds = {
      question1: "question_" + Math.random().toString(36).substring(2, 10),
      question2: "question_" + Math.random().toString(36).substring(2, 10),
      question3: "question_" + Math.random().toString(36).substring(2, 10),
      question4: "question_" + Math.random().toString(36).substring(2, 10),
      question5: "question_" + Math.random().toString(36).substring(2, 10),
    };
    
    // Create the ATA report
    const sampleReport = {
      id: "ata-test-" + timestamp + "-" + auditId,
      auditId: auditId,
      auditor: "John Smith",
      masterAuditor: "Jane Doe",
      originalScore: 85,
      ataScore: 75,
      variance: 10,
      timestamp: timestamp,
      remarks: "This is a sample ATA review for testing export functionality",
      formName: "Customer Service", // Adding form name for filter testing
      questionRatings: [
        {
          questionId: questionIds.question1,
          questionText: "Did the agent greet the customer properly?",
          auditorAnswer: "Yes",
          ataAnswer: "No",
          isCorrect: false,
          isCE: false,
          isNCE: true,
          comments: "Agent used an informal greeting"
        },
        {
          questionId: questionIds.question2,
          questionText: "Did the agent verify customer information?",
          auditorAnswer: "Yes",
          ataAnswer: "Yes",
          isCorrect: true,
          comments: ""
        },
        {
          questionId: questionIds.question3,
          questionText: "Did the agent resolve the customer issue?",
          auditorAnswer: "No",
          ataAnswer: "No",
          isCorrect: true,
          comments: ""
        },
        {
          questionId: questionIds.question4,
          questionText: "Did the agent follow security protocols?",
          auditorAnswer: "Yes",
          ataAnswer: "No",
          isCorrect: false,
          isCE: true,
          isNCE: false,
          comments: "Agent did not verify security questions properly"
        },
        {
          questionId: questionIds.question5,
          questionText: "Did the agent provide accurate information?",
          auditorAnswer: "Yes",
          ataAnswer: "Yes",
          isCorrect: true,
          comments: ""
        }
      ],
      accuracyMetrics: {
        totalQuestions: 5,
        correctAnswers: 3,
        incorrectAnswers: 2,
        ceErrors: 1,
        nceErrors: 1,
        overallAccuracy: 60
      }
    };
    
    // Save the ATA report to localStorage
    const existingReports = JSON.parse(localStorage.getItem('qa-ata-reports') || '[]');
    existingReports.push(sampleReport);
    localStorage.setItem('qa-ata-reports', JSON.stringify(existingReports));
    
    // Now create a matching base report that will be used for Excel export
    const sampleBaseReport = {
      id: auditId,
      auditId: auditId,
      agent: "Test Agent",
      auditor: "John Smith",
      formName: "Customer Service",
      timestamp: timestamp,
      score: 85,
      answers: [
        {
          section: "Section A",
          questions: [
            {
              text: "Did the agent greet the customer properly?",
              answer: "Yes",
              remarks: "Customer greeting was done",
              questionType: "dropdown",
              isFatal: false,
              weightage: 10,
              questionId: questionIds.question1,
              options: "Yes,No,NA"
            },
            {
              text: "Did the agent verify customer information?",
              answer: "Yes",
              remarks: "Verification complete",
              questionType: "dropdown",
              isFatal: false,
              weightage: 15,
              questionId: questionIds.question2,
              options: "Yes,No,NA"
            }
          ]
        },
        {
          section: "Section B",
          questions: [
            {
              text: "Did the agent resolve the customer issue?",
              answer: "No",
              remarks: "Issue remains unresolved",
              questionType: "dropdown",
              isFatal: false,
              weightage: 20,
              questionId: questionIds.question3,
              options: "Yes,No,NA"
            },
            {
              text: "Did the agent follow security protocols?",
              answer: "Yes",
              remarks: "All protocols followed",
              questionType: "dropdown",
              isFatal: true,
              weightage: 30,
              questionId: questionIds.question4,
              options: "Yes,No,NA"
            }
          ]
        },
        {
          section: "Section C",
          questions: [
            {
              text: "Did the agent provide accurate information?",
              answer: "Yes",
              remarks: "Information was accurate",
              questionType: "dropdown",
              isFatal: false,
              weightage: 25,
              questionId: questionIds.question5,
              options: "Yes,No,NA"
            }
          ]
        }
      ]
    };
    
    // Save the base report to localStorage
    const existingBaseReports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
    existingBaseReports.push(sampleBaseReport);
    localStorage.setItem('qa-reports', JSON.stringify(existingBaseReports));
    
    // Log information about the sample reports
    console.log('Created sample ATA report:', sampleReport.id);
    console.log('Created matching base report:', sampleBaseReport.id);
    console.log('Question IDs for matching:', questionIds);
    
    // Refresh the reports list
    setAtaReports([...ataReports, sampleReport]);
    setFilteredReports([...filteredReports, sampleReport]);
    
    alert('Sample ATA report created successfully. You should see it in the table now. A matching base report was also created for Excel export testing.');
  };
  
  // Enhanced export functionality with detailed comparison of auditor and master auditor answers
  const exportToExcel = () => {
    if (filteredReports.length === 0) {
      alert('No reports available to export.');
      return;
    }
    
    try {
      // Import XLSX library
      const XLSX = require('xlsx');
      
      // First, get all original reports to extract actual question text and details
      const originalReports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
      console.log(`Loaded ${originalReports.length} original reports to find question text`);
      
      // Create a workbook to hold all the data
      const workbook = XLSX.utils.book_new();
        
      // 1. Create a summary worksheet first with basic report information
      const summaryData = [
        // Header row for summary
        [
          'Audit ID', 
          'Form Name',
          'Auditor', 
          'Master Auditor', 
          'Original Score (%)', 
          'ATA Score (%)', 
          'Variance (%)',
          'Review Date',
          'Remarks'
        ]
      ];
      
      // Add each report to the summary worksheet
      filteredReports.forEach(report => {
        const timestamp = new Date(report.timestamp).toLocaleString();
        // Use formName from report if available, otherwise extract from auditId
        const formName = report.formName || report.form || report.auditId.split('-')[0] || 'Unknown';
        
        summaryData.push([
          report.auditId,
          formName,
          report.auditor,
          report.masterAuditor,
          String(report.originalScore),
          String(report.ataScore),
          String(report.variance),
          timestamp,
          report.remarks || ''
        ]);
      });
      
      // Add the summary worksheet to the workbook
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWs, 'Summary');
      
      // Create detailed worksheets for each report
      filteredReports.forEach((report, index) => {
        // Find original report for this ATA review to get section information
        const originalReport = originalReports.find((r: any) => 
          r.id === report.auditId || r.auditId === report.auditId
        );
        
        console.log(`Exporting details for report: ${report.auditId}`);
        console.log(`Found original report:`, originalReport ? 'Yes' : 'No');
        
        // Get question ratings (answers from auditor and master auditor)
        const questionRatings = report.questionRatings || [];
        console.log(`Report ${report.auditId} has ${questionRatings.length} question ratings`);
        
        // For debugging, output a few question ratings to examine their structure
        if (questionRatings.length > 0) {
          console.log(`Sample question rating:`, questionRatings[0]);
        }
        
        // Skip if no question ratings
        if (questionRatings.length === 0) {
          console.log(`No question ratings for report ${report.auditId}, skipping detailed worksheet`);
          return;
        }
        
        // Gather section info from original report if available
        let sectionMap = new Map();
        let questionMap = new Map();
        
        if (originalReport && originalReport.answers) {
          console.log(`Original report for ${report.auditId} has ${originalReport.answers.length} sections`);
          
          originalReport.answers.forEach((section: any, sectionIndex: number) => {
            const sectionName = section.section || section.sectionName || 'Unknown Section';
            console.log(`Processing section ${sectionIndex+1}: ${sectionName}`);
            
            // Map questions to their sections and gather detailed information
            if (section.questions && section.questions.length > 0) {
              console.log(`Section ${sectionName} has ${section.questions.length} questions`);
              
              section.questions.forEach((q: any, qIndex: number) => {
                const qId = q.questionId || q.id;
                if (qId) {
                  sectionMap.set(qId, sectionName);
                  questionMap.set(qId, {
                    ...q,
                    sectionName
                  });
                  console.log(`Mapped question ${qIndex+1} with ID ${qId} to section ${sectionName}`);
                } else {
                  console.log(`Warning: Question ${qIndex+1} in section ${sectionName} has no ID`);
                }
              });
            } else {
              console.log(`Section ${sectionName} has no questions or invalid questions array`);
            }
          });
          
          console.log(`Created mappings for ${sectionMap.size} questions across sections`);
        } else {
          console.log(`No original report or no answers in original report for ${report.auditId}`);
        }
      
        // Prepare detailed comparison data for the worksheet
        const detailedData = [
          // Header row with clear comparison format
          ['Section', 'Question Text', 'Question Type', 'Auditor Name', 'Auditor Answer', 'Master Auditor Name', 'Master Auditor Answer', 'Match?', 'Error Type', 'Comments']
        ];
        
        // Add each question with comparison
        questionRatings.forEach(rating => {
          const questionId = rating.questionId || '';
          const sectionName = sectionMap.get(questionId) || 'Unknown Section';
          const originalQuestion = questionMap.get(questionId) || {};
          const questionType = originalQuestion.questionType || 'Unknown';
          
          detailedData.push([
            sectionName,
            rating.questionText || 'Unknown Question',
            questionType,
            report.auditor || 'Unknown',
            rating.auditorAnswer || '',
            report.masterAuditor || 'Unknown',
            rating.ataAnswer || '',
            rating.isCorrect ? 'Yes' : 'No',
            rating.isCE ? 'Critical Error' : (rating.isNCE ? 'Non-Critical Error' : 'None'),
            rating.comments || ''
          ]);
        });
        
        // Create a unique worksheet name that's safe for Excel
        const sheetName = `Audit_${report.auditId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15)}`;
        const detailedWs = XLSX.utils.aoa_to_sheet(detailedData);
        
        // Set column widths for better readability
        const wscols = [
          {wch: 15},  // Section
          {wch: 40},  // Question Text
          {wch: 15},  // Question Type
          {wch: 15},  // Auditor Name
          {wch: 15},  // Auditor Answer
          {wch: 15},  // Master Auditor Name
          {wch: 15},  // Master Auditor Answer
          {wch: 8},   // Match?
          {wch: 15},  // Error Type
          {wch: 25}   // Comments
        ];
        detailedWs['!cols'] = wscols;
        
        // Add to workbook
        XLSX.utils.book_append_sheet(workbook, detailedWs, sheetName);
        
        // Add a detailed worksheet with full information if available
        if (originalReport && originalReport.answers) {
          // Create an even more detailed worksheet with all information
          const fullDetailData = [
            // Comprehensive header with everything
            ['Section', 'Question Text', 'Type', 'Weightage', 'Fatal?', 'Auditor Name', 'Auditor Answer', 
             'Auditor Remarks', 'Master Auditor Name', 'Master Auditor Answer', 'Match?', 'Error Type', 'Comments']
          ];
          
          // Add each question with full details
          questionRatings.forEach(rating => {
            const questionId = rating.questionId || '';
            const originalQuestion = questionMap.get(questionId) || {};
            const sectionName = originalQuestion.sectionName || sectionMap.get(questionId) || 'Unknown Section';
            
            fullDetailData.push([
              sectionName,
              rating.questionText || originalQuestion.text || 'Unknown Question',
              originalQuestion.questionType || 'Unknown',
              originalQuestion.weightage || 0,
              originalQuestion.isFatal ? 'Yes' : 'No',
              report.auditor || 'Unknown',
              rating.auditorAnswer || '',
              originalQuestion.remarks || '',
              report.masterAuditor || 'Unknown',
              rating.ataAnswer || '',
              rating.isCorrect ? 'Yes' : 'No',
              rating.isCE ? 'Critical Error' : (rating.isNCE ? 'Non-Critical Error' : 'None'),
              rating.comments || ''
            ]);
          });
          
          // Create the full detail worksheet
          const fullSheetName = `Full_${report.auditId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15)}`;
          const fullDetailWs = XLSX.utils.aoa_to_sheet(fullDetailData);
          
          // Set column widths for better readability
          const fullWsCols = [
            {wch: 15},  // Section
            {wch: 40},  // Question
            {wch: 10},  // Type
            {wch: 10},  // Weightage
            {wch: 6},   // Fatal?
            {wch: 15},  // Auditor Name
            {wch: 15},  // Auditor Answer
            {wch: 20},  // Auditor Remarks
            {wch: 15},  // Master Auditor Name
            {wch: 15},  // Master Auditor Answer
            {wch: 8},   // Match?
            {wch: 15},  // Error Type
            {wch: 30}   // Comments
          ];
          fullDetailWs['!cols'] = fullWsCols;
          
          // Add to workbook
          XLSX.utils.book_append_sheet(workbook, fullDetailWs, fullSheetName);
        }
      });
      
      // Process each report to create a comprehensive response comparison worksheet
      // This sheet will show all reports in a single view with response data
      const comparisonData = [
        // Header row
        ['Report ID', 'Audit ID', 'Form Name', 'Auditor Name', 'Master Auditor Name', 'Question Text', 'Auditor Answer', 'Master Auditor Answer', 'Match?', 'Error Type']
      ];
      
      // Add all questions from all reports in a flat structure
      filteredReports.forEach(report => {
        const questionRatings = report.questionRatings || [];
        const formName = report.formName || report.form || (report.auditId ? report.auditId.split('-')[0] : 'Unknown');
        
        // If there are no question ratings, add a placeholder row to at least show the report
        if (questionRatings.length === 0) {
          comparisonData.push([
            report.id,
            report.auditId,
            formName,
            report.auditor,
            report.masterAuditor,
            'No questions found',
            '',
            '',
            '',
            ''
          ]);
        } else {
          questionRatings.forEach(rating => {
            comparisonData.push([
              report.id,
              report.auditId,
              formName,
              report.auditor,
              report.masterAuditor,
              rating.questionText || 'Unknown Question',
              rating.auditorAnswer || '',
              rating.ataAnswer || '',
              rating.isCorrect ? 'Yes' : 'No',
              rating.isCE ? 'Critical Error' : (rating.isNCE ? 'Non-Critical Error' : 'None')
            ]);
          });
        }
      });
      
      // Add the comparison worksheet
      const comparisonWs = XLSX.utils.aoa_to_sheet(comparisonData);
      
      // Set column widths for the comparison worksheet
      const comparisonWsCols = [
        {wch: 10},  // Report ID
        {wch: 15},  // Audit ID
        {wch: 15},  // Form Name
        {wch: 15},  // Auditor Name
        {wch: 15},  // Master Auditor Name
        {wch: 40},  // Question Text
        {wch: 15},  // Auditor Answer
        {wch: 15},  // Master Auditor Answer
        {wch: 8},   // Match?
        {wch: 15},  // Error Type
      ];
      comparisonWs['!cols'] = comparisonWsCols;
      
      XLSX.utils.book_append_sheet(workbook, comparisonWs, 'All Comparisons');
      
      // Generate the Excel file and trigger download with form name in the filename when filtered
      const exportFileName = formFilter !== "all"
        ? `ATA_Reports_${formFilter.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`
        : `ATA_Reports_Detailed_${new Date().toISOString().slice(0,10)}.xlsx`;
        
      XLSX.writeFile(workbook, exportFileName);
      console.log(`Excel file generated with detailed ATA comparison data${formFilter !== "all" ? ` for form '${formFilter}'` : ''}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('There was an error generating the Excel file. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">ATA Reports</h2>
        <div className="flex items-center gap-2">
          {filteredReports.length === 0 && (
            <Button 
              onClick={createSampleATAReport}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Sample Report
            </Button>
          )}
          {filteredReports.length > 0 && (
            <Button 
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700"
            >
              {formFilter !== "all" ? `Export ${formFilter} Reports` : "Export All Details"}
            </Button>
          )}
          <div className="w-64">
            <Input 
              placeholder="Search by ID, auditor, or master auditor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {/* Filter controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Select
            value={formFilter}
            onValueChange={(value) => {
              console.log(`Form filter changed from "${formFilter}" to "${value}"`);
              setFormFilter(value);
            }}
          >
            <SelectTrigger id="form-filter" className="w-[200px]">
              <SelectValue placeholder="Select Form" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              {availableForms.map(form => (
                <SelectItem key={form} value={form}>{form}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formFilter !== "all" && (
            <Badge variant="outline" className="bg-blue-50 hover:bg-blue-100">
              {formFilter}
              <Button 
                variant="ghost" 
                className="h-4 w-4 p-0 ml-1"
                onClick={() => setFormFilter("all")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      </div>

      {filteredReports.length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit ID</TableHead>
                <TableHead>Auditor</TableHead>
                <TableHead>Master Auditor</TableHead>
                <TableHead>Original Score</TableHead>
                <TableHead>ATA Score</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.flatMap((report) => {
                const mainRow = (
                  <TableRow key={`row-${report.id}`}>
                    <TableCell>{report.auditId}</TableCell>
                    <TableCell>{report.auditor}</TableCell>
                    <TableCell>{report.masterAuditor}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        report.originalScore >= 90 ? 'bg-green-100 text-green-800' : 
                        report.originalScore >= 80 ? 'bg-blue-100 text-blue-800' : 
                        report.originalScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {report.originalScore}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        report.ataScore >= 90 ? 'bg-green-100 text-green-800' : 
                        report.ataScore >= 80 ? 'bg-blue-100 text-blue-800' : 
                        report.ataScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {report.ataScore}%
                      </span>
                    </TableCell>
                    <TableCell>{getVarianceBadge(report.variance)}</TableCell>
                    <TableCell>{new Date(report.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleReportDetails(report.id)}
                      >
                        {expandedReportId === report.id ? "Hide Details" : "View Details"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );

                if (expandedReportId === report.id) {
                  const detailsRow = (
                    <TableRow key={`details-${report.id}`}>
                      <TableCell colSpan={8}>
                        <Card className="mt-2 mb-4">
                          <CardHeader>
                            <CardTitle>ATA Review Details</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold mb-1">Remarks:</h4>
                                <p className="text-gray-700">{report.remarks || "No remarks provided."}</p>
                              </div>
                              
                              {report.accuracyMetrics && (
                                <div className="bg-blue-50 p-4 rounded-md">
                                  <h4 className="font-semibold mb-2">Accuracy Metrics:</h4>
                                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                    <div>
                                      <p className="text-sm text-gray-500">Total Questions</p>
                                      <p className="font-medium">{report.accuracyMetrics.totalQuestions}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500">Correct Answers</p>
                                      <p className="font-medium text-green-600">{report.accuracyMetrics.correctAnswers}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500">Incorrect Answers</p>
                                      <p className="font-medium text-red-600">{report.accuracyMetrics.incorrectAnswers}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500">Critical Errors</p>
                                      <p className="font-medium text-red-600">{report.accuracyMetrics.ceErrors}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500">Non-Critical Errors</p>
                                      <p className="font-medium text-amber-600">{report.accuracyMetrics.nceErrors}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500">Overall Accuracy</p>
                                      <p className={`font-medium ${
                                        report.accuracyMetrics.overallAccuracy >= 90 ? 'text-green-600' : 
                                        report.accuracyMetrics.overallAccuracy >= 80 ? 'text-blue-600' : 
                                        report.accuracyMetrics.overallAccuracy >= 60 ? 'text-amber-600' : 
                                        'text-red-600'
                                      }`}>
                                        {report.accuracyMetrics.overallAccuracy}%
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {report.questionRatings && report.questionRatings.length > 0 ? (
                              <div className="border rounded-md overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Question</TableHead>
                                      <TableHead>Auditor Answer</TableHead>
                                      <TableHead>ATA Answer</TableHead>
                                      <TableHead>Match</TableHead>
                                      <TableHead>Error Type</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {report.questionRatings.map((rating, index) => (
                                      <TableRow key={`question-${index}`}>
                                        <TableCell className="font-medium">
                                          {rating.questionText || `Question ${index + 1}`}
                                        </TableCell>
                                        <TableCell>{rating.auditorAnswer}</TableCell>
                                        <TableCell>{rating.ataAnswer}</TableCell>
                                        <TableCell>
                                          {rating.isCorrect ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                              Correct
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                              Incorrect
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {rating.isCE ? (
                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                              Critical Error
                                            </Badge>
                                          ) : rating.isNCE ? (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                              Non-Critical Error
                                            </Badge>
                                          ) : (
                                            <span className="text-gray-500">None</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="text-center py-6 text-gray-500">
                                No detailed question ratings available for this review.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TableCell>
                    </TableRow>
                  );
                  return [mainRow, detailsRow];
                }
                
                return mainRow;
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-md bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">No ATA reports found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm ? "Try a different search term or" : "There are no ATA reports that match your criteria"}
          </p>
        </div>
      )}
    </div>
  );
}
