import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// Define interfaces for the modal props and data structures
interface Question {
  text: string;
  answer: string;
  remarks?: string;
  rating?: string | number | null;
  questionType?: string;
  isFatal?: boolean;
  weightage?: number;
  questionId?: string;
  options?: string;
  conditionalSelection?: string; // For tracking secondary select options for "No" and "NA" responses
  showSubDropdownOn?: string[]; // Values that trigger sub-dropdown (e.g., ["No", "NA"])
  subDropdownLabel?: string; // Label for the sub-dropdown
  subDropdownOptions?: string; // Options for the sub-dropdown (comma-separated)
}

interface Section {
  section: string;
  questions: Question[];
}

interface EditHistory {
  timestamp: number;
  editor: string;
  action: string;
}

interface AuditReport {
  id: number | string;
  auditId: string;
  agent: string;
  auditor?: string;
  formName: string;
  timestamp: number;
  score: number;
  answers: Section[];
  editHistory?: EditHistory[];
}

interface EditReportModalProps {
  open: boolean;
  report: AuditReport;
  onSave: (report: AuditReport) => void;
  onCancel: () => void;
  isAdmin?: boolean;
}

export default function EditReportModal({ open, report, onSave, onCancel, isAdmin = false }: EditReportModalProps) {
  const [editedReport, setEditedReport] = useState<AuditReport | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [remarksByQuestionId, setRemarksByQuestionId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (report) {
      setEditedReport(JSON.parse(JSON.stringify(report))); // Deep copy
      
      // Initialize remarks from questions
      const initialRemarks: Record<string, string> = {};
      if (report.answers && report.answers.length > 0) {
        report.answers.forEach(section => {
          section.questions.forEach(question => {
            if (question.questionId) {
              initialRemarks[question.questionId] = question.remarks || '';
            }
          });
        });
        
        // Set active tab to the first section
        setActiveTab(report.answers[0].section);
      }
      setRemarksByQuestionId(initialRemarks);
    }
  }, [report]);

  if (!open || !editedReport) return null;

  const handleAnswerChange = (sectionIdx: number, questionIdx: number, value: string) => {
    // Only allow changes if user is admin
    if (!isAdmin) return;

    const updatedReport = { ...editedReport };
    updatedReport.answers[sectionIdx].questions[questionIdx].answer = value;
    setEditedReport(updatedReport);
  };

  const handleRemarksChange = (sectionIdx: number, questionIdx: number, value: string) => {
    // Only allow changes if user is admin
    if (!isAdmin) return;

    const updatedReport = { ...editedReport };
    const question = updatedReport.answers[sectionIdx].questions[questionIdx];
    question.remarks = value;
    
    // Also update the remarks state if we have a question ID
    if (question.questionId) {
      setRemarksByQuestionId(prev => {
        const updated = { ...prev };
        updated[question.questionId as string] = value;
        return updated;
      });
    }
    
    setEditedReport(updatedReport);
  };

  const calculateScore = (): number => {
    // Re-calculate score based on answers
    if (!editedReport.answers) return 0;

    let totalWeightage = 0;
    let deductedPoints = 0; 
    let hasFatal = false;

    // Fixed maximum score for all audits
    const MAX_SCORE = 100;

    console.log("=== RECALCULATING SCORE IN EDIT MODAL (USING 100% DEDUCTION APPROACH) ===");
    
    // STEP 1: Calculate total weightage from all questions
    for (const section of editedReport.answers) {
      for (const q of section.questions) {
        // Include all questions with weightage > 0
        if (q.weightage && q.weightage > 0) {
          totalWeightage += q.weightage;
          console.log(`Adding ${q.weightage} to total weightage for question: "${q.text}"`);
        }
      }
    }
    
    console.log(`Total weightage from all questions: ${totalWeightage}`);
    
    // STEP 2: Process answers and calculate deductions
    for (const section of editedReport.answers) {
      for (const q of section.questions) {
        // Skip questions without weightage
        if (!q.weightage || q.weightage <= 0) continue;

        // PART 1: Check for fatal errors
        // Only "Fatal" answers on fatal questions should set hasFatal = true
        if (q.isFatal === true) {
          console.log(`Checking fatal question: "${q.text}" with answer "${q.answer}"`);
          
          // If answer is specifically "Fatal", this is ALWAYS a fatal error (score = 0)
          if (q.answer === "Fatal") {
            console.log(`FATAL ERROR: Question "${q.text}" answered with "Fatal"`);
            hasFatal = true;
            // Continue checking other questions but score will be 0
          }
          
          // For fatal questions with "No" answers, deduct exactly the question's weightage
          if (q.answer === "No" || q.answer === "0" || q.answer === "false" || q.answer === "False") {
            console.log(`Question "${q.text}" is fatal but answered with "${q.answer}" - deducting exactly ${q.weightage} points`);
            deductedPoints += q.weightage;
          }
        }

        // PART 2: Calculate deductions for all non-fatal questions
        if (q.answer === "Yes" || q.answer === "1" || q.answer === "true" || q.answer === "True" || q.answer === "NA") {
          // No deductions for Yes/NA/True answers
          console.log(`Question "${q.text}": No deduction for '${q.answer}' answer`);
        } else if (q.answer === "No" || q.answer === "0" || q.answer === "false" || q.answer === "False") {
          // For No answers: Deduct EXACTLY the question's weightage
          deductedPoints += q.weightage;
          console.log(`Question "${q.text}": Deducting exactly ${q.weightage} points for '${q.answer}' answer`);
        } else if (q.answer === "Fatal") {
          // Fatal answers lead to 0 score (handled by hasFatal flag)
          console.log(`Question "${q.text}": Fatal answer will result in 0 total score`);
        }
      }
    }

    // Calculate final score using 100% - deductions approach
    let finalScore = 0;
    
    // If hasFatal is true, score is automatically 0
    if (hasFatal) {
      finalScore = 0;
      console.log(`FATAL ERROR DETECTED: Final score set to 0`);
    } else if (totalWeightage > 0) {
      // Calculate final score by subtracting deductions from 100%
      // (deductedPoints / totalWeightage) gives us the percentage to deduct
      finalScore = Math.max(0, Math.round(100 - (deductedPoints / totalWeightage * 100)));
      console.log(`FINAL SCORE: ${finalScore}% (deducted ${deductedPoints} from total weightage ${totalWeightage})`);
    }

    return finalScore;
  };

  const handleSave = () => {
    // Only allow save if user is admin
    if (!isAdmin) {
      onCancel();
      return;
    }

    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('qa-current-user') || '{}');
    const editorName = currentUser?.username || 'Admin';

    // Add an edit record to the history
    const updatedReport = {
      ...editedReport,
      score: calculateScore(),
      editHistory: [
        ...(editedReport.editHistory || []),
        {
          timestamp: Date.now(),
          editor: editorName,
          action: "edited"
        }
      ]
    };

    onSave(updatedReport);
  };

  // Determine if we need to show dropdown options or a simple text field
  const renderAnswerInput = (question: Question, sectionIdx: number, questionIdx: number) => {
    // Default to Yes/No/NA options
    const defaultOptions = ["Yes", "No", "NA"];
    
    // Check the question type to determine the appropriate input
    const questionType = question.questionType?.toLowerCase() || '';
    
    // For dropdown or multi-select questions with options
    if ((questionType === 'dropdown' || questionType === 'multiselect') && question.options) {
      // Parse the original options list
      let optionList = question.options.split(',').map(o => o.trim());
      
      // For fatal questions, ensure "Fatal" is an option if it doesn't exist already
      if (question.isFatal === true) {
        // Check if Fatal option exists already
        if (!optionList.includes('Fatal')) {
          // Add Fatal as an option
          console.log(`Adding Fatal option to question: "${question.text}" in EditReportModal`);
          optionList = [...optionList, 'Fatal'];
        }
      }
      
      return (
        <Select
          value={question.answer || ""}
          onValueChange={(val) => handleAnswerChange(sectionIdx, questionIdx, val)}
          disabled={!isAdmin}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select answer" />
          </SelectTrigger>
          <SelectContent>
            {optionList.map((option, idx) => {
              // Ensure value is never an empty string
              const optionValue = option.trim() === "" ? `empty-${idx}` : option.trim();
              return (
                <SelectItem key={`${optionValue}-${idx}`} value={optionValue}>
                  {optionValue.startsWith("empty-") ? "[Empty]" : optionValue}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }
    
    // For Yes/No type questions (boolean questions)
    if (questionType === 'boolean' || questionType === 'yesno') {
      // Start with default options (Yes/No/NA)
      let options = [...defaultOptions];
      
      // For fatal questions, ensure "Fatal" is available as an option
      if (question.isFatal === true && !options.includes("Fatal")) {
        console.log(`Adding Fatal option to boolean question: "${question.text}" in EditReportModal`);
        options = [...options, "Fatal"];
      }
      
      return (
        <Select
          value={question.answer || ""}
          onValueChange={(val) => handleAnswerChange(sectionIdx, questionIdx, val)}
          disabled={!isAdmin}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select answer" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option, idx) => (
              <SelectItem key={`${option}-${idx}`} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    // For number input type, use a number field with proper step
    if (questionType === 'number') {
      return (
        <input
          type="number"
          step="0.01"
          value={question.answer || ""}
          onChange={(e) => handleAnswerChange(sectionIdx, questionIdx, e.target.value)}
          disabled={!isAdmin}
          className="w-full p-2 border rounded-md"
          placeholder="Enter a number..."
        />
      );
    }
    
    // For date input type, use the date picker component
    if (questionType === 'date') {
      // Use the existing answer as a date if available
      let selectedDate: Date | undefined = undefined;
      if (question.answer) {
        try {
          selectedDate = new Date(question.answer);
          // Validate the date is valid
          if (isNaN(selectedDate.getTime())) {
            selectedDate = undefined;
          }
        } catch (e) {
          selectedDate = undefined;
        }
      }
      
      // Use an input with type="date" for simplicity and compatibility
      return (
        <input
          type="date"
          value={question.answer ? new Date(question.answer).toISOString().split('T')[0] : ''}
          onChange={(e) => {
            const dateStr = e.target.value ? new Date(e.target.value).toISOString() : '';
            handleAnswerChange(sectionIdx, questionIdx, dateStr);
          }}
          disabled={!isAdmin}
          className="w-full p-2 border rounded-md"
        />
      );
    }
    
    // For text or any other input type, use a simple text field
    return (
      <input
        type="text"
        value={question.answer || ""}
        onChange={(e) => handleAnswerChange(sectionIdx, questionIdx, e.target.value)}
        disabled={!isAdmin}
        className="w-full p-2 border rounded-md"
        placeholder="Enter answer here..."
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-[90%] max-w-3xl max-h-[90vh] overflow-y-auto relative">
        <button className="absolute right-4 top-3 text-xl" onClick={onCancel}>×</button>
        <h2 className="font-bold text-xl mb-4">
          {isAdmin ? "Edit Audit Report" : "View Audit Report"}
        </h2>

        <div className="mb-3">
          <div className="font-medium">Audit ID: {editedReport.auditId || "N/A"}</div>
          <div className="text-sm text-gray-500">
            Agent: {editedReport.agent} | Audited by: {editedReport.auditor || "Unknown"}
            <div className="mt-1">Date: {new Date(editedReport.timestamp).toLocaleString()}</div>
          </div>
        </div>

        {editedReport.answers && editedReport.answers.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="mb-4">
              {editedReport.answers.map((section) => (
                <TabsTrigger key={section.section} value={section.section}>
                  {section.section}
                </TabsTrigger>
              ))}
            </TabsList>

            {editedReport.answers.map((section, sectionIdx) => (
              <TabsContent key={section.section} value={section.section} className="space-y-4">
                {section.questions.map((question, questionIdx) => {
                  // Detect if it's a sub-question for visual indication
                  const isSubQuestion = question.text.startsWith('--') || 
                                       question.text.startsWith('>') || 
                                       question.text.trim().startsWith('•') ||
                                       (question.questionId && question.questionId.includes('sub'));
                  
                  return (
                    <div key={`q-${questionIdx}-${question.questionId || question.text.substring(0, 10)}`} 
                        className="border p-3 rounded-lg space-y-2">
                      <div className="flex flex-row items-start justify-between">
                        <p className="flex-1">
                          <strong>Q{questionIdx + 1}:</strong> {question.text}
                          {isSubQuestion && (
                            <Badge className="ml-2 bg-blue-100 text-blue-800">Sub-question</Badge>
                          )}
                        </p>
                        {question.isFatal && (
                          <Badge variant="destructive" className="ml-2">Fatal</Badge>
                        )}
                        {question.weightage && question.weightage > 1 && (
                          <Badge variant="outline" className="ml-2">Weight: {question.weightage}</Badge>
                        )}
                      </div>

                      {renderAnswerInput(question, sectionIdx, questionIdx)}
                      
                      {/* Show sub-dropdown if configured in form builder OR if it's Section B with "No" answer */}
                      {((question.showSubDropdownOn && 
                         question.showSubDropdownOn.includes(question.answer)) ||
                        (section.section.includes("Section B") && 
                         (question.answer === "No" || question.answer === "0"))) && (
                        <div className="mt-3 border-t pt-3 border-blue-200">
                          <p className="mb-2 text-sm font-medium text-blue-700">
                            {question.subDropdownLabel || 
                             (section.section.includes("Section B") ? 
                              "Why was the process not followed?" : 
                              `Selection for "${question.answer}" response:`)}
                          </p>
                          <Select
                            value={question.conditionalSelection || ""}
                            onValueChange={(val) => {
                              const updatedReport = { ...editedReport };
                              const q = updatedReport.answers[sectionIdx].questions[questionIdx];
                              q.conditionalSelection = val;
                              setEditedReport(updatedReport);
                            }}
                            disabled={!isAdmin}
                          >
                            <SelectTrigger className="w-full bg-blue-50">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {question.subDropdownOptions ? (
                                // If options are defined in the form builder, use those
                                question.subDropdownOptions.split(',').map((option, idx) => {
                                  const trimmedOption = option.trim();
                                  return trimmedOption ? (
                                    <SelectItem key={`${trimmedOption}-${idx}`} value={trimmedOption}>
                                      {trimmedOption}
                                    </SelectItem>
                                  ) : null;
                                })
                              ) : (
                                // Fallback options only for Section B
                                section.section.includes("Section B") && (
                                  <>
                                    <SelectItem value="Agent Error">Agent Error</SelectItem>
                                    <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                                    <SelectItem value="Process Limitation">Process Limitation</SelectItem>
                                    <SelectItem value="Time Constraint">Time Constraint</SelectItem>
                                    <SelectItem value="Customer Requested">Customer Requested</SelectItem>
                                    <SelectItem value="Knowledge Gap">Knowledge Gap</SelectItem>
                                  </>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="mt-3">
                        <p className="mb-1 text-sm font-medium">Remarks:</p>
                        <Textarea
                          value={question.remarks || ""}
                          onChange={(e) => handleRemarksChange(sectionIdx, questionIdx, e.target.value)}
                          disabled={!isAdmin}
                          placeholder="Enter remarks here..."
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="py-8 text-center">
            <p className="text-gray-500">No form sections found for this audit report.</p>
          </div>
        )}

        <div className="pt-4 text-lg">Score: 
          <span className={`ml-2 px-3 py-1 rounded-full font-bold inline-flex ${
            calculateScore() >= 90 ? 'bg-green-100 text-green-800' : 
            calculateScore() >= 80 ? 'bg-blue-100 text-blue-800' : 
            calculateScore() >= 60 ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }`}>{calculateScore()}%</span>
        </div>

        {editedReport.editHistory && editedReport.editHistory.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <h3 className="font-semibold text-sm">Edit History:</h3>
            <ul className="text-xs text-gray-500 mt-1">
              {editedReport.editHistory.map((edit, idx) => (
                <li key={`${edit.timestamp}-${idx}`}>
                  {new Date(edit.timestamp).toLocaleString()} - {edit.action} by {edit.editor}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onCancel}>Close</Button>
          {isAdmin && <Button onClick={handleSave}>Save Changes</Button>}
        </div>
      </div>
    </div>
  );
}