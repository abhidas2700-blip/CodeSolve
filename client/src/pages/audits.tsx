import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { Upload, FileSpreadsheet, FileUp, CheckCircle, Clock, Filter, User, Users, ClipboardList, AlertCircle, AlertTriangle, Undo2, FileDown, Download, RefreshCw, Ban, Trash, X } from 'lucide-react';
import { generateAuditId, convertToAuditIdFormat } from '@/lib/utils';
import AuditorBadge from '@/components/AuditorBadge';
import AuditSampleItem from '@/components/AuditSampleItem';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { databaseSync } from '../services/databaseSync';

// Process audit answers for display in a results modal
// Global audit data store
let savedAuditAnswers: { [auditId: string]: any } = {};

// This component is replaced by the imported AuditorBadge component

// Functions to save and retrieve audit answers for later viewing
function saveAuditAnswersForViewing(auditId: string, sectionData: any) {
  // Convert legacy ID format to professional format before saving
  const professionalId = convertToAuditIdFormat(auditId);
  
  // If the ID was converted, log it
  if (professionalId !== auditId) {
    console.log(`Converting audit ID from ${auditId} to ${professionalId} for storage`);
    auditId = professionalId;
  }
  
  savedAuditAnswers[auditId] = sectionData;
  try {
    // Also persist to localStorage for greater durability
    localStorage.setItem('qa-saved-audit-answers', JSON.stringify(savedAuditAnswers));
  } catch (err) {
    console.error("Error saving audit answers to localStorage:", err);
  }
  console.log(`✓ Saved audit ${auditId} data for viewing:`, sectionData);
}

function getAuditAnswersForViewing(auditId: string) {
  // Convert to professional format for consistent lookup
  const professionalId = convertToAuditIdFormat(auditId);
  
  // Use the professional ID for data lookup
  const idToUse = professionalId;
  
  // Log if ID was converted
  if (professionalId !== auditId) {
    console.log(`Looking up audit data using converted ID ${auditId} → ${professionalId}`);
  }
  
  // First try in-memory cache with the professional ID
  if (savedAuditAnswers[idToUse]) {
    console.log(`✓ Found audit ${idToUse} data in memory cache`);
    return savedAuditAnswers[idToUse];
  }
  
  // For backwards compatibility, also try with the original ID
  if (idToUse !== auditId && savedAuditAnswers[auditId]) {
    console.log(`✓ Found audit data with original ID ${auditId} in memory cache`);
    return savedAuditAnswers[auditId];
  }
  
  // Then try localStorage
  try {
    const savedData = localStorage.getItem('qa-saved-audit-answers');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      savedAuditAnswers = parsedData; // Restore the cache
      
      // Try with the professional ID first
      if (parsedData[idToUse]) {
        console.log(`✓ Found audit ${idToUse} data in localStorage`);
        return parsedData[idToUse];
      }
      
      // For backwards compatibility, also try with the original ID
      if (idToUse !== auditId && parsedData[auditId]) {
        console.log(`✓ Found audit data with original ID ${auditId} in localStorage`);
        return parsedData[auditId];
      }
    }
  } catch (err) {
    console.error("Error retrieving audit answers from localStorage:", err);
  }
  
  return null;
}

// Actual audit data processor for display
const processAuditAnswersForDisplay = (sectionAnswers: any[] = [], formName?: string) => {
  if (!Array.isArray(sectionAnswers)) {
    console.warn("sectionAnswers is not an array in processAuditAnswersForDisplay");
    return [];
  }
  
  console.log(`Processing ${sectionAnswers.length} section answers for display, form: ${formName || 'unknown'}`);
  
  // For custom forms from Form Builder, enhance with form definition
  let questionMap: Record<string, any> = {};
  
  if (formName) {
    try {
      // Load form definitions to get better question text and metadata
      const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
      const formDef = savedForms.find((f: any) => f.name === formName);
      
      if (formDef && formDef.sections) {
        console.log(`Found form definition for "${formName}" with ${formDef.sections.length} sections`);
        
        // Build a lookup map of questionId -> question definition
        formDef.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((q: any) => {
              if (q.id) {
                questionMap[q.id] = q;
              }
            });
          }
        });
      }
    } catch (err) {
      console.error("Error loading form definition:", err);
    }
  }
  
  return sectionAnswers.map(section => {
    if (!section || typeof section !== 'object') {
      return {
        name: "Invalid Section",
        questions: []
      };
    }
    
    const questions = (section.answers && Array.isArray(section.answers)) 
      ? section.answers.map(answer => {
          if (!answer || typeof answer !== 'object') {
            return {
              text: "Invalid Question",
              answer: "",
              remarks: ""
            };
          }
          
          const questionId = answer.questionId || '';
          const questionDef = questionMap[questionId];
          
          // IMPORTANT: Preserve the original question text and answer exactly as entered
          // Do not replace any values, especially "Open Sample" values
          return {
            text: answer.questionText || (questionDef?.text) || questionId || "Untitled Question",
            answer: answer.answer !== undefined ? answer.answer : '',
            remarks: answer.remarks || '',
            type: answer.questionType || (questionDef?.type) || 'text',
            isFatal: answer.isFatal || (questionDef?.isFatal) || false,
            weightage: answer.weightage || (questionDef?.weightage) || 0,
            rating: answer.rating || null
          };
        })
      : []; 
      
    return {
      name: section.sectionName || "Untitled Section",
      questions
    };
  });
};

// Function to display the audit results in a modal
const showAuditResultsModal = (auditDetails: any) => {
  try {
    // Create a dialog container
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center';
    
    // First sanitize the data to prevent XSS in template literals
    const sanitize = (text: string) => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    // Generate section HTML with careful error handling
    const generateSectionsHtml = () => {
      try {
        if (!auditDetails.sections || !Array.isArray(auditDetails.sections) || auditDetails.sections.length === 0) {
          return '<div class="border rounded-md p-4 text-center text-muted-foreground">No audit sections found</div>';
        }
        
        return auditDetails.sections.map((section: any) => {
          if (!section) return '';
          
          // Generate questions HTML with error handling
          const questionsHtml = () => {
            try {
              if (!section.questions || !Array.isArray(section.questions) || section.questions.length === 0) {
                return '<div class="text-muted-foreground">No questions in this section</div>';
              }
              
              return section.questions.map((q: any) => {
                if (!q) return '';
                
                return `
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-4 border-b pb-3">
                    <div class="md:col-span-5">
                      <div class="font-medium">${sanitize(q.text || 'Untitled Question')}</div>
                      ${q.isFatal ? '<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">Fatal</span>' : ''}
                    </div>
                    <div class="md:col-span-7">
                      <div class="font-medium text-primary">${sanitize(q.answer || 'No answer')}</div>
                      ${q.remarks ? `<div class="text-sm text-muted-foreground mt-1">Remarks: ${sanitize(q.remarks)}</div>` : ''}
                    </div>
                  </div>
                `;
              }).join('');
            } catch (err) {
              console.error('Error generating questions HTML:', err);
              return '<div class="text-red-500">Error displaying questions</div>';
            }
          };
          
          return `
            <div class="border rounded-md p-4">
              <h3 class="text-lg font-medium mb-3">${sanitize(section.name || 'Untitled Section')}</h3>
              <div class="space-y-4">
                ${questionsHtml()}
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        console.error('Error generating sections HTML:', err);
        return '<div class="border rounded-md p-4 text-center text-red-500">Error displaying audit sections</div>';
      }
    };
    
    // Build the full modal content
    const modalContent = `
      <div class="bg-background border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto p-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold">${sanitize(auditDetails.formName || 'Unknown Form')} - Audit Results</h2>
            <div class="text-sm text-muted-foreground mt-1">
              Agent: ${sanitize(auditDetails.agent || 'Unknown')} • 
              Auditor: ${sanitize(auditDetails.auditor || 'Unknown')} •
              Date: ${new Date(auditDetails.timestamp || Date.now()).toLocaleString()}
            </div>
          </div>
          <button id="close-audit-modal" class="border rounded-md p-2 hover:bg-muted">✕</button>
        </div>
        
        <div class="space-y-6">
          ${generateSectionsHtml()}
          
          <div class="flex justify-end space-x-2 pt-4">
            <div class="font-medium text-lg">
              Score: ${sanitize(auditDetails.score || '0')}${auditDetails.maxScore ? `/${sanitize(auditDetails.maxScore)}` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insert the modal content
    dialog.innerHTML = modalContent;
    document.body.appendChild(dialog);
    
    // Add event listener to close button
    const closeButton = dialog.querySelector('#close-audit-modal');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
    }
    
    // Also close on outside click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
      }
    });
  } catch (error) {
    console.error('Error showing audit results modal:', error);
    alert('Error displaying audit details. Please try again.');
  }
};

// Transform section answers to report format
const transformSectionAnswersToReportFormat = (sectionAnswers: any[] = [], formName?: string) => {
  if (!Array.isArray(sectionAnswers)) {
    console.warn("sectionAnswers is not an array in transformSectionAnswersToReportFormat");
    return [];
  }
  
  console.log(`Transforming ${sectionAnswers.length} section answers to report format for form: ${formName || 'unknown'}`);
  
  // For custom forms from Form Builder, enhance with form definition
  let questionMap: Record<string, any> = {};
  
  if (formName) {
    try {
      // Load form definitions to get better question text and metadata
      const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
      const formDef = savedForms.find((f: any) => f.name === formName);
      
      if (formDef && formDef.sections) {
        console.log(`Found form definition for "${formName}" with ${formDef.sections.length} sections`);
        
        // Build a lookup map of questionId -> question definition
        formDef.sections.forEach((section: any) => {
          if (section.questions) {
            section.questions.forEach((q: any) => {
              if (q.id) {
                questionMap[q.id] = q;
              }
            });
          }
        });
        
        console.log(`Built question map with ${Object.keys(questionMap).length} questions for enhancing report data`);
      }
    } catch (err) {
      console.error("Error loading form definition:", err);
    }
  }
  
  return sectionAnswers.map(section => {
    // Check if section.answers exists and is an array
    if (!section || typeof section !== 'object') {
      console.warn("Invalid section in sectionAnswers:", section);
      return {
        section: "Invalid Section",
        questions: []
      };
    }
    
    console.log(`Processing section "${section.sectionName}":`, {
      hasAnswers: !!section.answers,
      isArray: Array.isArray(section.answers),
      count: section.answers ? (Array.isArray(section.answers) ? section.answers.length : 'not an array') : 0
    });
    
    const questions = (section.answers && Array.isArray(section.answers)) 
      ? section.answers.map(answer => {
          if (!answer || typeof answer !== 'object') {
            console.warn("Invalid answer in section.answers:", answer);
            return {
              text: "Invalid Question",
              answer: "",
              remarks: ""
            };
          }
          
          const questionId = answer.questionId || '';
          const questionDef = questionMap[questionId];
          
          console.log(`Processing answer for "${questionId}":`, {
            questionId: questionId,
            answer: answer.answer,
            hasRemarks: !!answer.remarks,
            foundInFormDef: !!questionDef
          });
          
          // IMPORTANT: Preserve the original question text and answer exactly as entered
          // Do not replace any values, especially "Open Sample" values
          return {
            // CRITICAL: Always use the original questionText if available
            text: answer.questionText || (questionDef?.text) || questionId || "Untitled Question",
            // CRITICAL: Always preserve the original answer value exactly as entered
            answer: answer.answer !== undefined ? answer.answer : '',
            remarks: answer.remarks || '',
            // Add additional metadata that might be useful for reports
            rating: answer.rating || answer.auditorRating || null,
            questionId: questionId,
            questionType: answer.questionType || (questionDef?.type) || 'text',
            isFatal: answer.isFatal || (questionDef?.isFatal) || false,
            weightage: answer.weightage || (questionDef?.weightage) || 0,
            // Add conditional selection properties if they exist
            ...(answer.conditionalSelection ? { conditionalSelection: answer.conditionalSelection } : {}),
            // Preserve form configuration for sub-dropdowns
            ...(questionDef?.showSubDropdownOn ? { showSubDropdownOn: questionDef.showSubDropdownOn } : {}),
            ...(questionDef?.subDropdownLabel ? { subDropdownLabel: questionDef.subDropdownLabel } : {}),
            ...(questionDef?.subDropdownOptions ? { subDropdownOptions: questionDef.subDropdownOptions } : {}),
            // Preserve original options list
            ...(answer.options ? { options: answer.options } : 
               questionDef?.options ? { options: questionDef.options } : {})
          };
        })
      : []; // Empty array if no answers or not an array
      
    return {
      section: section.sectionName || "Untitled Section",
      questions: questions
    };
  });
};

// Deep clone the submitted audit with enhanced error handling and logging
const getEnhancedAuditCopy = (auditId: string): any => {
  try {
    // First check for submitted audits
    const submittedAudits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
    const auditDetails = submittedAudits.find((a: any) => a.id === auditId);
    
    if (auditDetails) {
      console.log(`Found submitted audit ${auditId} with:`, {
        hasSectionAnswers: !!auditDetails.sectionAnswers,
        count: auditDetails.sectionAnswers?.length || 0
      });
      
      // Create a deep clone of the audit
      const enhancedAudit = JSON.parse(JSON.stringify(auditDetails));
      
      // Make sure section answers are properly formatted
      if (enhancedAudit.sectionAnswers && Array.isArray(enhancedAudit.sectionAnswers)) {
        // For debugging, check structure of sectionAnswers
        const sampleSection = enhancedAudit.sectionAnswers[0];
        if (sampleSection) {
          console.log('Sample section structure:', {
            name: sampleSection.sectionName,
            hasAnswers: !!sampleSection.answers,
            answerCount: sampleSection.answers?.length || 0
          });
          
          if (sampleSection.answers && sampleSection.answers.length > 0) {
            const sampleAnswer = sampleSection.answers[0];
            console.log('Sample answer structure:', {
              questionId: sampleAnswer.questionId,
              answer: sampleAnswer.answer,
              hasRemarks: !!sampleAnswer.remarks
            });
          }
        }
      }
      
      return enhancedAudit;
    }
    
    // If not found in submitted audits, check completed audits in audit samples
    const auditSamples = JSON.parse(localStorage.getItem('qa-audit-samples') || '[]');
    const sampleDetails = auditSamples.find((s: any) => s.id === auditId);
    
    if (sampleDetails) {
      console.log(`Found sample ${auditId} with status: ${sampleDetails.status}`);
      return JSON.parse(JSON.stringify(sampleDetails));
    }
    
    return null;
  } catch (error) {
    console.error('Error in getEnhancedAuditCopy:', error);
    return null;
  }
};

// Form renderer component for audit forms
interface Question {
  id: string;
  text: string;
  type: string;
  options?: string;
  weightage: number;
  deductionPoints?: number;
  mandatory: boolean;
  isFatal: boolean;
  enableRemarks: boolean;
  grazingLogic: boolean;
  grazingPercentage?: number;
  // Sub-dropdown fields
  showSubDropdownOn?: string[];
  subDropdownLabel?: string;
  subDropdownOptions?: string;
}

// Question interface for the audit form
interface Question {
  id: string;
  text: string;
  type: string; // Can be "text", "dropdown", "multiSelect", "number", or "date"
  options?: string;
  weightage: number;
  deductionPoints?: number;
  mandatory: boolean;
  isFatal: boolean;
  enableRemarks: boolean;
  grazingLogic: boolean;
  grazingPercentage?: number;
  // Conditional subdropdown fields
  showSubDropdownOn?: string[]; // Values that trigger showing the subdropdown (e.g., ["No", "Fatal"])
  subDropdownOptions?: string; // Options for the subdropdown
  subDropdownLabel?: string;   // Label for the subdropdown
  // Advanced form fields for nested dropdowns
  nestedDropdowns?: boolean;  // Whether this dropdown has nested options
  nestedDropdownMap?: {[key: string]: string}; // Map of primary values to comma-separated secondary options
  // Hide lower levels when NA or nothing is selected
  hideOnNA?: boolean;
  // Custom labels for each level
  level2Label?: string; // Custom label for level 2 (e.g., "Category")
  level3Label?: string; // Custom label for level 3 (e.g., "Subcategory")
  level4Label?: string; // Custom label for level 4 (e.g., "Type")
  // For third level dropdowns
  hasThirdLevel?: boolean;
  thirdLevelMap?: {[key: string]: {[key: string]: string}}; // Map of L1->L2->L3 options
  // For fourth level dropdowns
  hasFourthLevel?: boolean;
  fourthLevelMap?: {[key: string]: {[key: string]: {[key: string]: string}}}; // Map of L1->L2->L3->L4 options
  // For repeatable interaction sections
  isRepeatable?: boolean; // Whether this question is part of a repeatable block
  repeatableGroup?: string; // ID for the repeatable group this question belongs to
  // For conditional section visibility
  controlsSection?: boolean; // Whether this question controls the visibility of a section
  visibleOnValues?: string[]; // Section will be visible when this question has these values
  controlledSectionId?: string; // ID of the section that this question controls
}

interface Section {
  id: string;
  name: string;
  type?: 'agent' | 'questionnaire' | 'custom' | 'interaction';
  questions: Question[];
  isRepeatable?: boolean; // Whether this section can be repeated (for interaction tracking)
  repeatableGroupId?: string; // ID for grouping repeatable sections
  maxRepetitions?: number; // Maximum number of repetitions allowed
  repetitionIndex?: number; // Index in the repetition sequence
  isVisible?: boolean; // Whether this section is visible in the form (for conditional visibility)
  controlledBy?: string; // ID of the question that controls this section's visibility
}

interface AuditForm {
  name: string;
  sections: Section[];
  createdAt: string;
}

// Form renderer component
// Define a custom event for form updates
interface FormUpdateEvent extends Event {
  detail: {
    formName: string;
  };
}

// Custom event name
const FORM_UPDATE_EVENT = 'qa-form-update';

// Function to dispatch form update event
// Create a helper function that can be exported
export const dispatchFormUpdate = (formName: string) => {
  const event = new CustomEvent(FORM_UPDATE_EVENT, {
    detail: { formName }
  });
  window.dispatchEvent(event);
};

// Global state for form values using event-based communication
const FORM_VALUES_UPDATED = 'form-values-updated';

interface FormValuesEvent extends Event {
  detail: {
    answers?: Record<string, string>;
    remarks?: Record<string, string>;
    form?: AuditForm | null;
    dynamicSections?: Section[];
  };
}

// Function to update form values across components
function updateGlobalFormValues(answers?: Record<string, string>, remarks?: Record<string, string>, form?: AuditForm | null, dynamicSections?: Section[]) {
  // Dispatch custom event with form values
  const event = new CustomEvent(FORM_VALUES_UPDATED, {
    detail: { answers, remarks, form, dynamicSections }
  });
  window.dispatchEvent(event);
  
  return { answers, remarks, form, dynamicSections };
}

// Render a simple loading state component
function LoadingState() {
  return (
    <div className="border rounded-md p-4 bg-muted/30 text-center">
      <p>Loading audit form...</p>
    </div>
  );
}

// Render an error state component
function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="border rounded-md p-4 bg-red-50 text-red-800">
      <h3 className="font-medium mb-2">Error</h3>
      <p>{error}</p>
      <p className="text-sm mt-2">Using default form instead.</p>
      <div className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="q1">Was the greeting appropriate?</Label>
          <Select defaultValue="yes">
            <SelectTrigger id="q1">
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="na">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// Render a no form state component
function NoFormState() {
  return (
    <div className="border rounded-md p-4 bg-muted/30 text-center">
      <p>No form found</p>
    </div>
  );
}

function AuditFormRenderer({ formName }: { formName: string }) {
  // All state hooks must be defined at the top level
  const [form, setForm] = useState<AuditForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState<number>(0);
  const [formUpdateMessage, setFormUpdateMessage] = useState<string | null>(null);
  // Track which sections should be visible based on controls
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});
  // State to track active section tab
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // State for dynamic repeatable sections
  const [dynamicSections, setDynamicSections] = useState<Section[]>([]);
  const formRef = useRef<AuditForm | null>(null);
  
  // Update ref when form changes
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  
  // Manual refresh function
  const refreshForm = () => {
    setFormUpdateMessage("Form has been updated. Refreshing with latest changes...");
    setFormVersion(prev => prev + 1);
    setTimeout(() => setFormUpdateMessage(null), 5000);
  };
  
  // This will reload the form whenever localStorage changes or form update event is fired
  useEffect(() => {
    // Handle storage events (cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'qa-audit-forms') {
        console.log("Forms updated in localStorage, reloading form data");
        refreshForm();
      }
    };
    
    // Handle custom form update events (same-tab updates)
    const handleFormUpdate = (e: Event) => {
      const updateEvent = e as FormUpdateEvent;
      // Only refresh if our form was updated
      if (updateEvent.detail.formName === formName || updateEvent.detail.formName === '*') {
        console.log(`Form "${formName}" updated via event, refreshing data`);
        refreshForm();
      }
    };
    
    // Add event listeners
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(FORM_UPDATE_EVENT, handleFormUpdate);
    
    // Polling for changes (as backup)
    const intervalId = setInterval(() => {
      try {
        const currentForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
        const currentForm = currentForms.find((f: AuditForm) => f.name === formName);
        
        if (currentForm && formRef.current && 
            JSON.stringify(currentForm) !== JSON.stringify(formRef.current)) {
          console.log("Form updated during polling, refreshing data");
          refreshForm();
        }
      } catch (error) {
        console.error("Error checking for form updates:", error);
      }
    }, 2000);
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(FORM_UPDATE_EVENT, handleFormUpdate);
      clearInterval(intervalId);
    };
  }, [formName]);

  // Load the form data when formName or formVersion changes
  useEffect(() => {
    setLoading(true);
    try {
      // Load forms from localStorage
      const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
      console.log(`Loading form "${formName}" (version ${formVersion})`);
      
      // Find the form that matches the formName
      const matchedForm = savedForms.find((f: AuditForm) => f.name === formName);
      
      if (matchedForm) {
        setForm(matchedForm);
        // Initialize answers for all questions
        const initialAnswers: Record<string, string> = {};
        const initialRemarks: Record<string, string> = {};
        // Initialize section visibility (agent section always visible)
        const initialVisibility: Record<string, boolean> = {};
        
        // Initialize visibility for each section - display ALL sections by default
        matchedForm.sections.forEach((section) => {
          // All sections should be visible by default, regardless of section name/type
          // This ensures that ALL sections (A, B, C, D, G, etc.) will appear based on the form definition
          initialVisibility[section.id] = true;
          
          // Log which sections are being initialized
          console.log(`Setting section ${section.name} (${section.id}) to be visible by default`);
          
          section.questions.forEach((question) => {
            initialAnswers[question.id] = '';
            if (question.enableRemarks) {
              initialRemarks[question.id] = '';
            }
          });
        });
        
        setAnswers(initialAnswers);
        setRemarks(initialRemarks);
        setVisibleSections(initialVisibility);
        setError(null);
        
        console.log('Initialized section visibility:', initialVisibility);
      } else {
        // If form not found, set error
        setError(`Form "${formName}" not found`);
      }
    } catch (err) {
      console.error('Error loading form:', err);
      setError('Error loading form. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [formName, formVersion]);
  
  // Listen for FORM_VALUES_UPDATED events to update local state
  useEffect(() => {
    const handleGlobalFormUpdate = (e: Event) => {
      try {
        const event = e as FormValuesEvent;
        const { detail } = event;
        
        if (detail.answers) {
          console.log('AuditFormRenderer received form values update with answers', Object.keys(detail.answers).length);
          setAnswers(detail.answers);
        }
        
        if (detail.remarks) {
          console.log('AuditFormRenderer received form values update with remarks', Object.keys(detail.remarks).length);
          setRemarks(detail.remarks);
        }
      } catch (error) {
        console.error('Error in form update listener', error);
      }
    };
    
    // Add event listener for global form updates
    window.addEventListener(FORM_VALUES_UPDATED, handleGlobalFormUpdate);
    
    // Cleanup
    return () => {
      window.removeEventListener(FORM_VALUES_UPDATED, handleGlobalFormUpdate);
    };
  }, []);
  
  // Update global state whenever answers or remarks change
  useEffect(() => {
    if (form && !loading) {
      // Only update when we have a valid form and are not loading
      updateGlobalFormValues(answers, remarks, form, dynamicSections);
    }
  }, [answers, remarks, form, loading, dynamicSections]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionId]: value
      };
      return newAnswers;
    });
    
    // Check if this question controls any section visibility
    if (form) {
      let controlQuestion: Question | undefined;
      let sectionToControl: string | undefined;
      
      // Find the controlling question and the section it controls
      form.sections.forEach(section => {
        section.questions.forEach(question => {
          if (question.id === questionId && question.controlsSection && question.controlledSectionId) {
            controlQuestion = question;
            sectionToControl = question.controlledSectionId;
          }
        });
      });
      
      // If this is a control question, update section visibility
      if (controlQuestion && sectionToControl && controlQuestion.visibleOnValues) {
        const shouldBeVisible = controlQuestion.visibleOnValues.includes(value);
        
        setVisibleSections(prev => ({
          ...prev,
          [sectionToControl]: shouldBeVisible
        }));
        
        console.log(`Section ${sectionToControl} visibility set to ${shouldBeVisible} based on answer "${value}"`);
      }
    }
    
    // Handle repeatable section logic
    handleRepeatableSection(questionId, value);
  };

  // Handle repeatable section logic  
  const handleRepeatableSection = (questionId: string, value: string) => {
    // Find all sections and questions to check for repeatable triggers
    const allSections = [...(form?.sections || []), ...dynamicSections];
    
    for (const section of allSections) {
      for (const question of section.questions) {
        if (question.id === questionId && question.text === "Was there another interaction?") {
          if (value === "Yes") {
            // Check if next interaction section already exists
            const currentIndex = section.repetitionIndex || 1;
            const nextIndex = currentIndex + 1;
            const nextSectionExists = [...(form?.sections || []), ...dynamicSections].some(s => 
              s.repeatableGroupId === section.repeatableGroupId && s.repetitionIndex === nextIndex
            );
            
            if (!nextSectionExists) {
              console.log('Creating Interaction', nextIndex, 'in auditing form');
              createRepeatableSection(section);
            }
          } else if (value === "No") {
            // Remove all sections with higher index than current
            const currentIndex = section.repetitionIndex || 1;
            setDynamicSections(prev => prev.filter(s => 
              !(s.repeatableGroupId === section.repeatableGroupId && (s.repetitionIndex || 1) > currentIndex)
            ));
            console.log('Removed higher indexed interaction sections from auditing form');
          }
          break;
        }
      }
    }
  };
  
  // Create a new repeatable section based on the template
  const createRepeatableSection = (templateSection: Section) => {
    if (!templateSection.isRepeatable) return;
    
    const currentIndex = templateSection.repetitionIndex || 1;
    const nextIndex = currentIndex + 1;
    
    // Create new section with unique IDs
    const newSection: Section = {
      ...templateSection,
      id: `${templateSection.id}_repeat_${nextIndex}`,
      name: `Interaction ${nextIndex}`,
      repetitionIndex: nextIndex,
      questions: templateSection.questions.map(q => ({
        ...q,
        id: `${q.id}_repeat_${nextIndex}`
      }))
    };
    
    setDynamicSections(prev => [...prev, newSection]);
    console.log('Created new repeatable section in auditing form:', newSection.name);
  };
  
  const handleRemarksChange = (questionId: string, value: string) => {
    setRemarks(prev => {
      const newRemarks = {
        ...prev,
        [questionId]: value
      };
      return newRemarks;
    });
  };
  
  // Loading and error states are handled before this point by our extracted components
  
  // Update active section when form changes - this must come before any conditional returns
  useEffect(() => {
    if (form && form.sections.length > 0) {
      setActiveSection(form.sections[0]?.id || null);
    }
  }, [form]);
  
  // Use our component functions for consistent conditional rendering
  if (loading) {
    return <LoadingState />;
  }
  
  if (error) {
    return <ErrorState error={error} />;
  }
  
  if (!form) {
    return <NoFormState />;
  }

  return (
    <div className="space-y-6 audit-form">
      {formUpdateMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3 flex items-center mb-4 animate-in fade-in slide-in-from-top-5 duration-300">
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          {formUpdateMessage}
        </div>
      )}
      
      {/* Audit Form with Tabbed Sections */}
      <Tabs value={activeSection || ''} onValueChange={setActiveSection} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto mb-4">
          {[...form.sections, ...dynamicSections].map((section) => {
            // Check if this section should be visible
            const isVisible = visibleSections[section.id] !== false;
            if (!isVisible) return null;
            
            return (
              <TabsTrigger 
                key={section.id} 
                value={section.id}
                className="px-4 py-2"
              >
                {section.name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Section Content */}
        {[...form.sections, ...dynamicSections].map((section, sectionIndex) => {
          // Check if this section should be visible
          const isVisible = visibleSections[section.id] !== false;
          // Skip rendering if not visible
          if (!isVisible) return null;
          
          return (
            <TabsContent key={section.id} value={section.id} className="border rounded-md p-4 bg-muted/30 mt-0">
              <h3 className="font-medium mb-4 text-lg">{section.name}</h3>
              <div className="space-y-5">
            {section.questions.map((question) => {
              // Check if this question should be visible based on controlling question answers
              const isQuestionVisible = (() => {
                // Type assertion to access conditional properties (these exist in the form data)
                const questionWithConditions = question as any;
                if (!questionWithConditions.controlledBy) return true;
                
                // Find the controlling question within the same section
                const controllingQuestion = section.questions.find(q => q.id === questionWithConditions.controlledBy) as any;
                
                if (!controllingQuestion) {
                  console.log(`No controlling question found for question ${question.id}`);
                  return true;
                }
                
                const controllingAnswer = answers[controllingQuestion.id];
                
                // Use the controlling question's visibleOnValues to determine visibility
                const visibleOnValues = controllingQuestion.visibleOnValues || [];
                const isVisible = visibleOnValues.includes(controllingAnswer || '');
                
                console.log(`Question ${question.text} visibility:`, {
                  controllingQuestionId: controllingQuestion.id,
                  controllingAnswer,
                  visibleOnValues,
                  isVisible
                });
                
                return isVisible;
              })();
              
              // Skip rendering if not visible
              if (!isQuestionVisible) return null;
              
              return (
              <div key={question.id} className="space-y-2 pb-4 border-b border-dashed border-gray-200 last:border-0">
                <div className="flex items-start gap-2">
                  <Label htmlFor={question.id} className={`text-sm ${question.mandatory ? 'font-medium' : ''}`}>
                    {question.text}
                    {question.mandatory && <span className="text-red-500 ml-1">*</span>}
                    {question.isFatal && <Badge variant="destructive" className="ml-2 text-xs">Fatal</Badge>}
                  </Label>
                </div>
                
                {question.type === 'dropdown' && (
                  <div className="space-y-3">
                    {/* Primary Dropdown */}
                    <Select 
                      value={answers[question.id]} 
                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                    >
                      <SelectTrigger id={question.id}>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-2 sticky top-0 bg-background z-10 border-b">
                          <Input 
                            placeholder="Search options..." 
                            className="h-8"
                            onChange={(e) => {
                              const searchValue = e.target.value.toLowerCase();
                              // Get the parent for this dropdown
                              const dropdownId = `dropdown-search-${question.id}`;
                              const optionsDiv = document.getElementById(dropdownId);
                              if (optionsDiv) {
                                // Get all the option elements
                                const options = optionsDiv.querySelectorAll('[data-option]');
                                
                                // Show/hide based on search
                                options.forEach((option) => {
                                  const optionText = option.textContent?.toLowerCase() || '';
                                  if (optionText.includes(searchValue)) {
                                    option.classList.remove('hidden');
                                  } else {
                                    option.classList.add('hidden');
                                  }
                                });
                              }
                            }}
                          />
                        </div>
                        <div id={`dropdown-search-${question.id}`} className="max-h-[200px] overflow-y-auto">
                          {question.options?.split(',')
                            .map(option => option.trim())
                            .filter(option => option !== '') // Filter out empty strings
                            .map((option, i) => (
                              <SelectItem key={i} value={option} data-option>
                                {option}
                              </SelectItem>
                            ))}
                        </div>
                      </SelectContent>
                    </Select>
                    
                    {/* Hierarchical Dropdowns - Level 2 */}
                    {question.nestedDropdowns && 
                     question.nestedDropdownMap && 
                     answers[question.id] && 
                     !(question.hideOnNA && (answers[question.id] === "NA" || answers[question.id] === "")) && (
                      <div className="border rounded-md p-3 mt-2 bg-white dark:bg-slate-900">
                        <Label className="text-sm font-medium mb-2 block">
                          {question.level2Label || "Category"}
                        </Label>
                        <Select
                          value={remarks[`${question.id}-level2`] || ""}
                          onValueChange={(value) => handleRemarksChange(`${question.id}-level2`, value)}
                        >
                          <SelectTrigger id={`level2-${question.id}`}>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 py-2 sticky top-0 bg-background z-10 border-b">
                              <Input 
                                placeholder="Search options..." 
                                className="h-8"
                                onChange={(e) => {
                                  const searchValue = e.target.value.toLowerCase();
                                  const dropdownId = `level2-search-${question.id}`;
                                  const optionsDiv = document.getElementById(dropdownId);
                                  if (optionsDiv) {
                                    const options = optionsDiv.querySelectorAll('[data-option]');
                                    options.forEach((option) => {
                                      const optionText = option.textContent?.toLowerCase() || '';
                                      if (optionText.includes(searchValue)) {
                                        option.classList.remove('hidden');
                                      } else {
                                        option.classList.add('hidden');
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div id={`level2-search-${question.id}`} className="max-h-[200px] overflow-y-auto">
                              {question.nestedDropdownMap[answers[question.id]]?.split(',')
                                .map(option => option.trim())
                                .filter(option => option !== '')
                                .map((option, i) => (
                                  <SelectItem key={i} value={option} data-option>
                                    {option}
                                  </SelectItem>
                                ))}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Hierarchical Dropdowns - Level 3 */}
                    {question.nestedDropdowns && 
                     question.hasThirdLevel && 
                     question.thirdLevelMap && 
                     answers[question.id] && 
                     remarks[`${question.id}-level2`] && 
                     !(question.hideOnNA && (answers[question.id] === "NA" || answers[question.id] === "")) && (
                      <div className="border rounded-md p-3 mt-2 bg-white dark:bg-slate-900">
                        <Label className="text-sm font-medium mb-2 block">
                          {question.level3Label || "Subcategory"}
                        </Label>
                        <Select
                          value={remarks[`${question.id}-level3`] || ""}
                          onValueChange={(value) => handleRemarksChange(`${question.id}-level3`, value)}
                        >
                          <SelectTrigger id={`level3-${question.id}`}>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 py-2 sticky top-0 bg-background z-10 border-b">
                              <Input 
                                placeholder="Search options..." 
                                className="h-8"
                                onChange={(e) => {
                                  const searchValue = e.target.value.toLowerCase();
                                  const dropdownId = `level3-search-${question.id}`;
                                  const optionsDiv = document.getElementById(dropdownId);
                                  if (optionsDiv) {
                                    const options = optionsDiv.querySelectorAll('[data-option]');
                                    options.forEach((option) => {
                                      const optionText = option.textContent?.toLowerCase() || '';
                                      if (optionText.includes(searchValue)) {
                                        option.classList.remove('hidden');
                                      } else {
                                        option.classList.add('hidden');
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div id={`level3-search-${question.id}`} className="max-h-[200px] overflow-y-auto">
                              {question.thirdLevelMap[answers[question.id]]?.[remarks[`${question.id}-level2`]]?.split(',')
                                .map(option => option.trim())
                                .filter(option => option !== '')
                                .map((option, i) => (
                                  <SelectItem key={i} value={option} data-option>
                                    {option}
                                  </SelectItem>
                                ))}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Hierarchical Dropdowns - Level 4 */}
                    {question.nestedDropdowns && 
                     question.hasFourthLevel && 
                     question.fourthLevelMap && 
                     answers[question.id] && 
                     remarks[`${question.id}-level2`] && 
                     remarks[`${question.id}-level3`] && 
                     !(question.hideOnNA && (answers[question.id] === "NA" || answers[question.id] === "")) && (
                      <div className="border rounded-md p-3 mt-2 bg-white dark:bg-slate-900">
                        <Label className="text-sm font-medium mb-2 block">
                          {question.level4Label || "Type"}
                        </Label>
                        <Select
                          value={remarks[`${question.id}-level4`] || ""}
                          onValueChange={(value) => handleRemarksChange(`${question.id}-level4`, value)}
                        >
                          <SelectTrigger id={`level4-${question.id}`}>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 py-2 sticky top-0 bg-background z-10 border-b">
                              <Input 
                                placeholder="Search options..." 
                                className="h-8"
                                onChange={(e) => {
                                  const searchValue = e.target.value.toLowerCase();
                                  const dropdownId = `level4-search-${question.id}`;
                                  const optionsDiv = document.getElementById(dropdownId);
                                  if (optionsDiv) {
                                    const options = optionsDiv.querySelectorAll('[data-option]');
                                    options.forEach((option) => {
                                      const optionText = option.textContent?.toLowerCase() || '';
                                      if (optionText.includes(searchValue)) {
                                        option.classList.remove('hidden');
                                      } else {
                                        option.classList.add('hidden');
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div id={`level4-search-${question.id}`} className="max-h-[200px] overflow-y-auto">
                              {question.fourthLevelMap[answers[question.id]]?.[remarks[`${question.id}-level2`]]?.[remarks[`${question.id}-level3`]]?.split(',')
                                .map(option => option.trim())
                                .filter(option => option !== '')
                                .map((option, i) => (
                                  <SelectItem key={i} value={option} data-option>
                                    {option}
                                  </SelectItem>
                                ))}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Show conditional sub-dropdown if:
                        1. The question has sub-dropdown configuration
                        2. The answer is one of the trigger values */}
                    {question.showSubDropdownOn && 
                     question.subDropdownOptions && 
                     question.showSubDropdownOn.includes(answers[question.id]) && (
                      <div className="bg-muted/30 rounded-md p-3 mt-2 border border-muted">
                        <Label htmlFor={`subdropdown-${question.id}`} className="text-sm mb-2 block">
                          {question.subDropdownLabel || "Please specify:"}
                        </Label>
                        <Select 
                          value={remarks[question.id]} 
                          onValueChange={(value) => handleRemarksChange(question.id, value)}
                        >
                          <SelectTrigger id={`subdropdown-${question.id}`}>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 py-2 sticky top-0 bg-background z-10 border-b">
                              <Input 
                                placeholder="Search options..." 
                                className="h-8"
                                onChange={(e) => {
                                  const searchValue = e.target.value.toLowerCase();
                                  const dropdownId = `subdropdown-search-${question.id}`;
                                  const optionsDiv = document.getElementById(dropdownId);
                                  if (optionsDiv) {
                                    const options = optionsDiv.querySelectorAll('[data-option]');
                                    options.forEach((option) => {
                                      const optionText = option.textContent?.toLowerCase() || '';
                                      if (optionText.includes(searchValue)) {
                                        option.classList.remove('hidden');
                                      } else {
                                        option.classList.add('hidden');
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div id={`subdropdown-search-${question.id}`} className="max-h-[200px] overflow-y-auto">
                              {question.subDropdownOptions.split(',')
                                .map(option => option.trim())
                                .filter(option => option !== '')
                                .map((option, i) => (
                                  <SelectItem key={i} value={option} data-option>
                                    {option}
                                  </SelectItem>
                                ))}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                
                {question.type === 'text' && (
                  <Input 
                    id={question.id}
                    value={answers[question.id]} 
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Enter your answer"
                  />
                )}

                {question.type === 'number' && (
                  <Input 
                    id={question.id}
                    type="number"
                    step="0.01"
                    value={answers[question.id]} 
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Enter a number"
                  />
                )}

                {question.type === 'date' && (
                  <Input 
                    id={question.id}
                    type="date"
                    value={answers[question.id] ? new Date(answers[question.id]).toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        // Convert to ISO string for consistent date format
                        const dateStr = new Date(e.target.value).toISOString();
                        handleAnswerChange(question.id, dateStr);
                      } else {
                        handleAnswerChange(question.id, '');
                      }
                    }}
                    className="w-full"
                  />
                )}
                
                {question.type === 'multiSelect' && (
                  <div>
                    <div className="mb-2">
                      <Input 
                        placeholder="Search options..." 
                        className="h-8"
                        onChange={(e) => {
                          const searchValue = e.target.value.toLowerCase();
                          const optionsDiv = document.getElementById(`multiselect-${question.id}`);
                          if (optionsDiv) {
                            const options = optionsDiv.querySelectorAll('[data-option-container]');
                            options.forEach((option) => {
                              const optionText = option.textContent?.toLowerCase() || '';
                              if (optionText.includes(searchValue)) {
                                option.classList.remove('hidden');
                              } else {
                                option.classList.add('hidden');
                              }
                            });
                          }
                        }}
                      />
                    </div>
                    <div id={`multiselect-${question.id}`} className="grid gap-2 grid-cols-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                      {question.options?.split(',')
                        .map(option => option.trim())
                        .filter(option => option !== '') // Filter out empty strings
                        .map((option, i) => (
                          <div key={i} className="flex items-center space-x-2" data-option-container>
                            <Checkbox 
                              id={`${question.id}-${i}`} 
                              checked={answers[question.id]?.includes(option)}
                              onCheckedChange={(checked) => {
                                const currentValues = answers[question.id]?.split(',').filter(Boolean) || [];
                                
                                let newValues;
                                if (checked) {
                                  newValues = [...currentValues, option];
                                } else {
                                  newValues = currentValues.filter(val => val !== option);
                                }
                                
                                handleAnswerChange(question.id, newValues.join(','));
                              }}
                            />
                            <Label htmlFor={`${question.id}-${i}`} className="text-sm">
                              {option}
                            </Label>
                          </div>
                        ))}
                    </div>
                    {answers[question.id] && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {answers[question.id].split(',').filter(Boolean).map((selected, i) => (
                          <Badge key={i} variant="secondary" className="mr-1">
                            {selected}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-1 hover:bg-muted-foreground/20"
                              onClick={() => {
                                const currentValues = answers[question.id].split(',').filter(Boolean);
                                const newValues = currentValues.filter(val => val !== selected);
                                handleAnswerChange(question.id, newValues.join(','));
                              }}
                            >
                              ×
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {question.enableRemarks && (
                  <div className="mt-2">
                    <Label htmlFor={`${question.id}-remarks`} className="text-xs text-muted-foreground">
                      Remarks
                    </Label>
                    <Textarea 
                      id={`${question.id}-remarks`}
                      value={remarks[question.id]} 
                      onChange={(e) => handleRemarksChange(question.id, e.target.value)}
                      placeholder="Enter any additional remarks"
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                )}
                
                <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                  <span>Weightage: {question.weightage}</span>
                  {question.deductionPoints !== undefined && (
                    <span>Deduction: {question.deductionPoints}</span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </TabsContent>
        );
      })}
      </Tabs>
    </div>
  );
}

// Sample interface
interface AuditSample {
  id: string;
  customerName: string;
  ticketId: string;
  date: number;
  status: 'available' | 'assigned' | 'completed' | 'inProgress' | 'skipped';
  assignedTo?: string;
  formType: string;
  priority?: 'low' | 'medium' | 'high';
  metadata?: {
    channel?: 'call' | 'email' | 'chat';
    duration?: number;
    category?: string;
  };
  skipReason?: string;
  hasDraft?: boolean; // Flag to indicate whether this sample has a saved draft
}

// User interface for assignment
interface AuditorUser {
  id: number;
  username: string;
  role: string;
  workload: number; // Current number of assigned audits
}

// Function to generate demo data with assigned auditors
function generateDemoSamples(count: number): AuditSample[] {
  // Get available auditors from the user base
  const auditors = ['auditor', 'testuser', 'agent 1', 'agent 2', 'admin111', 'mohit'];
  
  return Array(count).fill(0).map((_, i) => {
    // Make some samples assigned to auditors
    const isAssigned = i % 3 === 0; // Every third sample is assigned 
    const status = isAssigned ? 'assigned' : 'available';
    const assignedTo = isAssigned ? auditors[i % auditors.length] : undefined;
    
    return {
      id: generateAuditId(),
      customerName: `Customer ${i+1}`,
      ticketId: `TICKET-${1000 + i}`,
      date: Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 7, // Random date in the last week
      status: status as 'available' | 'assigned' | 'completed' | 'inProgress',
      assignedTo: assignedTo,
      formType: ['Quality Check', 'Customer Satisfaction', 'Process Compliance'][Math.floor(Math.random() * 3)],
      priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
      metadata: {
        channel: ['call', 'email', 'chat'][Math.floor(Math.random() * 3)] as 'call' | 'email' | 'chat',
        duration: Math.floor(Math.random() * 300) + 60, // 1-6 minutes
        category: ['Sales', 'Support', 'Billing', 'Technical'][Math.floor(Math.random() * 4)]
      }
    };
  });
}

export default function Audits() {
  // Function to export audit data as CSV
  const exportAuditDataAsCSV = (samples: AuditSample[]) => {
    if (samples.length === 0) {
      alert("No data to export");
      return;
    }
    
    // Create CSV header
    const headers = [
      "Customer Name", 
      "Ticket ID", 
      "Date", 
      "Status", 
      "Assigned To", 
      "Form Type", 
      "Priority", 
      "Channel", 
      "Duration", 
      "Category"
    ];
    
    // Create CSV rows
    const rows = samples.map(sample => [
      sample.customerName,
      sample.ticketId,
      new Date(sample.date).toLocaleString(),
      sample.status,
      sample.assignedTo || "Unassigned",
      sample.formType,
      sample.priority || "None",
      sample.metadata?.channel || "N/A",
      sample.metadata?.duration ? formatDuration(sample.metadata.duration) : "N/A",
      sample.metadata?.category || "N/A"
    ]);
    
    // Combine header and rows
    const csvData = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    // Create a download link
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = "none";
    document.body.appendChild(link);
    
    // Click the link to trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("assigned");
  const [selectedForm, setSelectedForm] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [selectedAuditor, setSelectedAuditor] = useState<string>("");
  const [auditInProgress, setAuditInProgress] = useState<AuditSample | null>(null);
  const [sampleFilter, setSampleFilter] = useState("");
  const [randomAssign, setRandomAssign] = useState(false);
  const [assignCount, setAssignCount] = useState("1");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSampleToDelete, setSelectedSampleToDelete] = useState<AuditSample | null>(null);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);
  
  // Function to sync audit samples to database
  const syncAuditSamplesToDatabase = async (samples: AuditSample[]) => {
    try {
      console.log(`Syncing ${samples.length} audit samples to database...`);
      
      for (const sample of samples) {
        try {
          const response = await fetch('/api/audit-samples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              sampleId: sample.id,
              customerName: sample.customerName,
              ticketId: sample.ticketId,
              formType: sample.formType,
              priority: sample.priority || 'medium',
              status: sample.status || 'available',
              metadata: sample.metadata || {},
              uploadedBy: user?.id || 1
            })
          });
          
          if (response.ok) {
            console.log(`Synced sample ${sample.id} to database`);
          }
        } catch (error) {
          console.log(`Error syncing sample ${sample.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing audit samples to database:', error);
    }
  };

  // Determine user roles
  const isAdmin = user?.rights && Array.isArray(user.rights) && user.rights.includes('admin');
  const isManager = user?.rights && Array.isArray(user.rights) && 
                    user.rights.includes('reports') && 
                    user.rights.includes('dashboard') && 
                    user.rights.includes('createLowerUsers');
  const isTeamLeader = user?.rights && Array.isArray(user.rights) && user.rights.includes('audit') && user.rights.includes('review');
  const isAuditor = user?.rights && Array.isArray(user.rights) && user.rights.includes('audit') && !isManager && !isAdmin && !isTeamLeader;
  
  const canManageSamples = isAdmin || isManager || isTeamLeader;
  
  // Initialize mock data
  const [auditSamples, setAuditSamples] = useState<AuditSample[]>([]);
  const [auditorUsers, setAuditorUsers] = useState<AuditorUser[]>([]);
  const [isLoadingAuditors, setIsLoadingAuditors] = useState(false);
  
  // Load auditors on component mount
  useEffect(() => {
    if (!user) return; // Only load if user is logged in
    
    // Check for cached auditors first
    const cachedAuditors = localStorage.getItem('qa-cached-auditors');
    if (cachedAuditors) {
      try {
        const parsedAuditors = JSON.parse(cachedAuditors);
        console.log("Using cached auditors:", parsedAuditors.length);
        setAuditorUsers(parsedAuditors);
      } catch (e) {
        console.error("Error parsing cached auditors:", e);
      }
    }
    
    // Always fetch fresh auditors from the API
    setIsLoadingAuditors(true);
    fetch('/api/users', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(apiUsers => {
        if (apiUsers && apiUsers.length > 0) {
          console.log("Loaded auditor data from API:", apiUsers.length);
          
          // Filter users with audit rights
          const availableAuditors = apiUsers.filter((u: any) => {
            if (!u || !u.username) return false;
            
            // Skip current user if they are admin/manager
            if (user && u.username === user.username && (isAdmin || isManager || isTeamLeader)) {
              return false;
            }
            
            const userRights = u.rights || [];
            let hasAuditRights = false;
            
            if (Array.isArray(userRights)) {
              hasAuditRights = userRights.includes('audit') || userRights.includes('auditor');
            } else if (typeof userRights === 'string') {
              hasAuditRights = userRights === 'audit' || userRights === 'auditor';
            }
            
            console.log(`User ${u.username} has audit rights: ${hasAuditRights}`);
            return hasAuditRights;
          }).map((u: any) => ({
            id: u.id,
            username: u.username,
            role: u.role || 'Auditor',
            workload: 0 // Will update this later once we have samples
          }));
          
          console.log("Filtered auditor list:", availableAuditors);
          
          // Cache auditors for future use
          try {
            localStorage.setItem('qa-cached-auditors', JSON.stringify(availableAuditors));
          } catch (e) {
            console.error("Error caching auditors:", e);
          }
          
          if (availableAuditors.length > 0) {
            setAuditorUsers(availableAuditors);
          }
        }
      })
      .catch(err => {
        console.error("Error fetching auditors:", err);
      })
      .finally(() => {
        setIsLoadingAuditors(false);
      });
  }, [user, isAdmin, isManager, isTeamLeader]);
  
  // Get forms from localStorage
  const [availableForms, setAvailableForms] = useState<{ id: string, name: string }[]>([]);
  
  // Load forms from localStorage
  useEffect(() => {
    try {
      const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
      if (savedForms.length > 0) {
        const mappedForms = savedForms.map((form: any) => ({
          id: form.id,
          name: form.name
        }));
        setAvailableForms(mappedForms);
      } else {
        // Fallback forms if none exist
        setAvailableForms([
          { id: "1", name: "Call Quality Assessment" },
          { id: "2", name: "Email Response Evaluation" },
          { id: "3", name: "Customer Service Audit" },
          { id: "4", name: "Technical Support Evaluation" }
        ]);
      }
    } catch (error) {
      console.error("Error loading audit forms:", error);
      // Fallback to default forms
      setAvailableForms([
        { id: "1", name: "Call Quality Assessment" },
        { id: "2", name: "Email Response Evaluation" },
        { id: "3", name: "Customer Service Audit" },
        { id: "4", name: "Technical Support Evaluation" }
      ]);
    }
  }, []);

  // Mock data for draft/in-progress audits
  const [draftAudits, setDraftAudits] = useState<AuditSample[]>([]);

  // Initialize sample data
  useEffect(() => {
    // Load from localStorage if available
    const storedSamples = localStorage.getItem('qa-audit-samples');
    const storedAuditors = localStorage.getItem('qa-users');
    
    let parsedSamples: AuditSample[] = [];
    if (storedSamples) {
      try {
        parsedSamples = JSON.parse(storedSamples);
        
        // Update any old format IDs to use the new professional format
        // Also check for existing drafts and mark them with hasDraft property
        const savedDrafts = localStorage.getItem('qa-audit-drafts');
        let draftMap: {[auditId: string]: boolean} = {};
        
        // Create a map of audit IDs that have saved drafts
        if (savedDrafts) {
          try {
            const drafts = JSON.parse(savedDrafts);
            Object.keys(drafts).forEach(auditId => {
              draftMap[auditId] = true;
            });
            console.log(`Found ${Object.keys(draftMap).length} audit drafts`);
          } catch (e) {
            console.error('Error parsing saved drafts', e);
          }
        }
        
        const updatedSamples = parsedSamples.map(sample => {
          // Check if this ID needs to be updated (not already using AUD- format)
          let updatedSample = sample;
          if (!sample.id.startsWith('AUD-')) {
            console.log(`Converting legacy ID format ${sample.id} to professional format`);
            updatedSample = {
              ...sample,
              id: convertToAuditIdFormat(sample.id) // Use our conversion utility for consistent handling
            };
          }
          
          // Check if this sample has a saved draft
          if (draftMap[updatedSample.id]) {
            console.log(`Sample ${updatedSample.id} has a saved draft`);
            updatedSample = {
              ...updatedSample,
              hasDraft: true
            };
          }
          
          return updatedSample;
        });
        
        parsedSamples = updatedSamples;
      } catch (e) {
        console.error('Error parsing stored audit samples', e);
      }
    }
    
    if (parsedSamples.length === 0) {
      // Generate demo samples with assigned auditors
      const demoSamples = generateDemoSamples(10);
      parsedSamples = demoSamples;
      
      // Initialize with sample data
      localStorage.setItem('qa-audit-samples', JSON.stringify(parsedSamples));
    }
    
    // Prepare auditor users data for assignment
    if (storedAuditors) {
      try {
        const users = JSON.parse(storedAuditors);
        
        // Debug the user data to see what's happening
        console.log("All users from localStorage:", users.map((u: any) => ({ 
          username: u.username, 
          rights: u.rights,
          hasRights: !!u.rights,
          isArray: Array.isArray(u.rights)
        })));
        
        // Create function to process users and filter auditors
        function processUsers(userList: any[]) {
          console.log("Processing users list with", userList.length, "total users");
          
          // Safeguard against invalid user data
          if (!Array.isArray(userList)) {
            console.error("Invalid user list format:", userList);
            return;
          }
          
          // Enhanced filter: include ALL users with audit rights regardless of other rights
          // This change ensures admin users who also have audit rights are included
          const auditors = userList
            .filter((u: any) => {
              // Basic validation
              if (!u || typeof u !== 'object' || !u.username) {
                console.error("Invalid user object:", u);
                return false;
              }
              
              // Skip user if it's the current logged in admin/manager viewing the page
              if (user && u.username === user.username && (isAdmin || isManager || isTeamLeader)) {
                return false;
              }
              
              // Make sure rights exists and handle its data type correctly
              const userRights = u.rights || [];
              
              // Handle both array and string formats for rights
              let hasAuditRights = false;
              
              if (Array.isArray(userRights)) {
                hasAuditRights = userRights.includes('audit') || userRights.includes('auditor');
              } else if (typeof userRights === 'string') {
                hasAuditRights = userRights === 'audit' || userRights === 'auditor';
              }
              
              // Debug individual user rights evaluation
              console.log(`User ${u.username} has audit rights: ${hasAuditRights}`);
              
              // Include all users with audit rights in the assignment pool
              return hasAuditRights;
            })
            .map((u: any) => ({
              id: u.id || Math.random().toString(36).substr(2, 9), // Ensure there's always an ID
              username: u.username,
              role: u.role || 'Auditor',
              workload: parsedSamples.filter(s => s.assignedTo === u.username && s.status !== 'completed').length
            }));
          
          console.log("Filtered auditor list:", auditors);
          
          // If we have no auditors, add some default ones in development environment
          if (auditors.length === 0) {
            // Add default auditors for both development and local preview modes
            console.log("No auditors found, adding defaults");
            
            // Check if these users already exist in our list
            const existingUsers = userList.map((u: any) => u.username);
            
            // First try to add users we know already exist
            if (existingUsers.includes('auditor')) {
              auditors.push({ id: 'default-1', username: 'auditor', role: 'Auditor', workload: 0 });
            }
            
            if (existingUsers.includes('agent 1')) {
              auditors.push({ id: 'agent-1', username: 'agent 1', role: 'Auditor', workload: 0 });
            }
            
            if (existingUsers.includes('agent 2')) {
              auditors.push({ id: 'agent-2', username: 'agent 2', role: 'Auditor', workload: 0 });
            }
            
            // If still no auditors, add fallback defaults
            if (auditors.length === 0) {
              auditors.push(
                { id: 'default-1', username: 'auditor', role: 'Auditor', workload: 0 },
                { id: 'default-2', username: 'testuser', role: 'Auditor', workload: 0 }
              );
            }
          }
          
          setAuditorUsers(auditors);
          console.log("Loaded auditor users:", auditors.length);
        }
        
        // Initialize with localStorage data first
        processUsers(users);
        
        // Then try to fetch fresh user data from the server API
        fetch('/api/users', {
          credentials: 'include'
        })
        .then(res => res.ok ? res.json() : [])
        .then(apiUsers => {
          if (apiUsers && apiUsers.length > 0) {
            console.log("Loaded users from API:", apiUsers.length);
            // Use API users if available
            processUsers(apiUsers);
          }
        })
        .catch(err => {
          console.error("Error fetching users:", err);
        });
      } catch (e) {
        console.error('Error parsing user data', e);
      }
    }
    
    // Set the fetched/generated data to state
    setAuditSamples(parsedSamples);
    
    // Sync audit samples to database when user is logged in
    if (parsedSamples.length > 0 && user?.id) {
      console.log('Scheduling comprehensive database sync...');
      setTimeout(() => databaseSync.syncAllToDatabase(), 1000);
    }
    
    // Set drafts based on auditor role
    if (isAuditor && user) {
      setDraftAudits(
        parsedSamples.filter(s => 
          s.assignedTo === user.username && 
          (s.status === 'assigned' || s.status === 'inProgress')
        )
      );
    }
  }, [user, isAuditor]);

  // Handle file upload and Excel parsing
  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use the React state value for form selection
    const selectedFormObj = availableForms.find(form => form.id === selectedForm);
    const formName = selectedFormObj?.name || availableForms[0]?.name || 'Customer Service Audit';
    
    console.log("Uploading with form:", { selectedForm, formName });
    
    // Get the file input element
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      console.log("Processing uploaded file:", file.name);
      
      // Only proceed if it's an Excel file
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        // Show loading state
        setIsUploading(true);
        
        // Use FileReader to read the file
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            if (!event.target?.result) {
              throw new Error("Failed to read file");
            }
            
            // Import xlsx dynamically
            const XLSX = await import('xlsx');
            
            // Parse the Excel file
            const data = new Uint8Array(event.target.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first worksheet
            const worksheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[worksheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            console.log("Parsed Excel data:", jsonData);
            
            if (!Array.isArray(jsonData) || jsonData.length === 0) {
              throw new Error("No data found in Excel file or invalid format");
            }
            
            // Create samples from the Excel data
            const newSamples: AuditSample[] = [];
            
            // Process each row of the Excel file
            jsonData.forEach((row: any, i) => {
              // Log the row data for debugging
              console.log(`Processing row ${i+1}:`, row);
              
              // Normalize field names to handle different CSV formats
              // Handle both camelCase and space-separated field names
              const getField = (field: string): any => {
                // Try different variations of the field name
                const variations = [
                  field,                                 // CustomerName
                  field.replace(/([A-Z])/g, ' $1'),      // Customer Name
                  field.replace(/\s+/g, ''),             // CustomerName (no spaces)
                  field.toLowerCase(),                    // customername
                  field.toLowerCase().replace(/\s+/g, '') // customername (no spaces)
                ];
                
                // Find the first variation that exists in the row
                for (const variant of variations) {
                  if (row[variant] !== undefined) {
                    return row[variant];
                  }
                }
                
                // Try to find a key that contains the field (case insensitive)
                const fieldLower = field.toLowerCase();
                for (const key in row) {
                  if (key.toLowerCase().includes(fieldLower)) {
                    return row[key];
                  }
                }
                
                return null;
              };
              
              // Check if the required fields exist, using flexible matching
              const customerName = getField('CustomerName') || getField('Customer Name') || getField('Name');
              const ticketId = getField('TicketID') || getField('Ticket ID') || getField('Ticket');
              
              if (!customerName && !ticketId) {
                console.warn(`Row ${i+1} is missing required fields:`, row);
                return; // Skip this row
              }
              
              // Default values for optional fields
              const channels = ['call', 'email', 'chat'] as const;
              const priorities = ['low', 'medium', 'high'] as const;
              
              // Get all other fields with flexible matching
              const formType = getField('FormType') || getField('Form Type') || formName;
              const priority = getField('Priority') as 'low' | 'medium' | 'high' | undefined;
              const channel = getField('Channel') as 'call' | 'email' | 'chat' | undefined;
              const duration = getField('Duration');
              const category = getField('Category') || getField('Type');
              const status = getField('Status') || 'available';
              const assignedTo = getField('AssignedTo') || getField('Assigned To');
              
              // Create a new sample from the Excel data
              const newSample: AuditSample = {
                id: generateAuditId(),
                customerName: customerName || `Customer-${i+1}`,
                ticketId: ticketId || `TKT-${30000 + i}`,
                date: Date.now(),
                // Always put uploaded samples in the available pool regardless of their status in the CSV
                // This ensures all uploaded samples start in the available pool
                status: 'available' as const,
                formType: formType,
                priority: priority || priorities[Math.floor(Math.random() * priorities.length)],
                metadata: {
                  channel: channel || channels[Math.floor(Math.random() * channels.length)],
                  duration: duration || Math.floor(Math.random() * 900) + 60,
                  category: category || 'General'
                }
              };
              
              // Add to newSamples array
              newSamples.push(newSample);
            });
            
            // Finalize the Excel data upload
            const updatedSamples = [...auditSamples, ...newSamples];
            
            // Update state and localStorage
            setAuditSamples(updatedSamples);
            localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
            
            // Sync updated samples to database
            syncAuditSamplesToDatabase(updatedSamples);
            
            setUploadDialogOpen(false);
            
            // Show success notification
            alert(`Successfully uploaded ${newSamples.length} audit samples using the "${formName}" form.`);
            
            // Hide loading state
            setIsUploading(false);
          } catch (error) {
            console.error("Error processing Excel file:", error);
            alert(`Error processing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsUploading(false);
          }
        };
        
        // Read the file as an array buffer
        reader.readAsArrayBuffer(file);
      } else {
        alert("Please upload a valid Excel file (.xlsx, .xls) or CSV file (.csv)");
      }
    } else {
      alert("Please select a file to upload");
    }
  };

  // Handle assignment of samples to auditors
  const handleAssignSamples = () => {
    if (!selectedAuditor && !randomAssign) {
      alert("Please select an auditor or enable random assignment");
      return;
    }
    
    if (selectedSamples.length === 0) {
      alert("Please select at least one sample to assign");
      return;
    }
    
    // Process assignment
    const updatedSamples = auditSamples.map(sample => {
      if (selectedSamples.includes(sample.id)) {
        // Determine assigned auditor
        let assignTo = selectedAuditor;
        
        if (randomAssign) {
          // Simple round-robin assignment based on current workload
          const sortedAuditors = [...auditorUsers].sort((a, b) => a.workload - b.workload);
          assignTo = sortedAuditors[0]?.username || user?.username || '';
          
          // Update the workload counter for this auditor
          setAuditorUsers(
            auditorUsers.map(au => 
              au.username === assignTo ? {...au, workload: au.workload + 1} : au
            )
          );
        }
        
        // Log the assignment details for debugging
        console.log(`Assigning sample ${sample.id} to auditor: ${assignTo}`);
        
        return {
          ...sample,
          status: 'assigned',
          assignedTo: assignTo
        };
      }
      return sample;
    });
    
    setAuditSamples(updatedSamples);
    localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
    setSelectedSamples([]);
    setAssignDialogOpen(false);
    
    // Show success message
    alert(`Successfully assigned ${selectedSamples.length} samples to auditors.`);
  };

  // Handle bulk sample assignment
  const handleBulkAssign = () => {
    if (!selectedAuditor) {
      alert("Please select an auditor for bulk assignment");
      return;
    }
    
    const count = parseInt(assignCount);
    if (isNaN(count) || count < 1) {
      alert("Please enter a valid number of samples to assign");
      return;
    }
    
    // Get available samples
    const availableSampleIds = auditSamples
      .filter(s => s.status === 'available')
      .slice(0, count)
      .map(s => s.id);
    
    if (availableSampleIds.length === 0) {
      alert("No available samples to assign");
      return;
    }
    
    // Log the bulk assignment details
    console.log(`Bulk assigning ${availableSampleIds.length} samples to auditor: ${selectedAuditor}`);
    console.log("Sample IDs being assigned:", availableSampleIds);
    
    // Update samples
    const updatedSamples = auditSamples.map(sample => {
      if (availableSampleIds.includes(sample.id)) {
        // Log each assignment for debugging
        console.log(`Assigning sample ${sample.id} to ${selectedAuditor}`);
        
        return {
          ...sample,
          status: 'assigned',
          assignedTo: selectedAuditor
        };
      }
      return sample;
    });
    
    setAuditSamples(updatedSamples);
    localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
    
    // Update auditor workload
    setAuditorUsers(
      auditorUsers.map(au => 
        au.username === selectedAuditor ? 
        {...au, workload: au.workload + availableSampleIds.length} : au
      )
    );
    
    setAssignDialogOpen(false);
    
    // Show success message
    alert(`Successfully assigned ${availableSampleIds.length} samples to ${selectedAuditor}.`);
  };

  // Start working on a sample
  const startAudit = (sample: AuditSample) => {
    console.log(`Starting audit for sample ${sample.id}, has draft: ${sample.hasDraft}`);    
    const updatedSample = { ...sample, status: 'inProgress' };
    
    // Update the sample status
    const updatedSamples = auditSamples.map(s => 
      s.id === sample.id ? updatedSample : s
    );
    
    setAuditSamples(updatedSamples);
    localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
    
    // Set as the current working audit FIRST so it's available for subsequent operations
    setAuditInProgress(updatedSample);
    
    // Check if there's a saved draft for this audit
    if (sample.hasDraft) {
      try {
        const savedDraftsStr = localStorage.getItem('qa-draft-audits');
        let draftAudit: any = null;
        
        if (savedDraftsStr) {
          const savedDrafts = JSON.parse(savedDraftsStr);
          
          // Handle both array and object formats
          if (Array.isArray(savedDrafts)) {
            // Array format: find by ID
            draftAudit = savedDrafts.find((draft: any) => draft.id === sample.id);
            console.log(`Searching for draft with ID ${sample.id} in array format, found:`, draftAudit);
          } else if (typeof savedDrafts === 'object') {
            // Object format: direct key access
            draftAudit = savedDrafts[sample.id];
            console.log(`Searching for draft with ID ${sample.id} in object format, found:`, draftAudit);
          }
        }
        
        if (draftAudit && draftAudit.sectionAnswers) {
          console.log(`Found saved draft for audit ${sample.id}`, draftAudit);
          
          // Prepare answers and remarks from the draft
          const draftAnswers: Record<string, string> = {};
          const draftRemarks: Record<string, string> = {};
          
          // Process each section's answers
          draftAudit.sectionAnswers.forEach((section: any) => {
            section.answers.forEach((answer: any) => {
              if (answer.questionId) {
                // Store the answer value
                draftAnswers[answer.questionId] = answer.answer || '';
                
                // Store remarks if present
                if (answer.remarks) {
                  draftRemarks[answer.questionId] = answer.remarks;
                }
              }
            });
          });
          
          // Get the form definition first
          const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
          const formDef = savedForms.find((f: AuditForm) => f.name === updatedSample.formType);
          
          // Load draft data into global form state
          setGlobalFormState({
            answers: draftAnswers,
            remarks: draftRemarks,
            form: formDef || null
          });
          
          // Use a timeout to ensure component is ready before sending events
          setTimeout(() => {
            // Dispatch the event to update form values across components
            updateGlobalFormValues(draftAnswers, draftRemarks, formDef || null, []);
            console.log('Dispatched form values update event with draft data', Object.keys(draftAnswers).length);
            
            // Also dispatch a form update event to ensure the form is properly loaded
            if (formDef) {
              dispatchFormUpdate(updatedSample.formType);
              console.log('Dispatched form update event to reload form', updatedSample.formType);
            }
            
            // Show notification to user
            alert('Draft data loaded. You can continue where you left off.');
          }, 100);
        } else {
          console.log(`No draft data found for audit ${sample.id} despite hasDraft flag`);
        }
      } catch (error) {
        console.error('Error loading draft data:', error);
      }
    } else {
      // Reset form state if no draft
      setGlobalFormState({
        answers: {},
        remarks: {},
        form: null
      });
    }
  };

  // Create state for the form values
  const [globalFormState, setGlobalFormState] = useState<{
    answers: Record<string, string>;
    remarks: Record<string, string>;
    form: AuditForm | null;
    dynamicSections?: Section[];
  }>({
    answers: {},
    remarks: {},
    form: null,
    dynamicSections: []
  });
  
  // Listen for form values updates
  useEffect(() => {
    const handleFormValuesUpdate = (e: Event) => {
      const event = e as FormValuesEvent;
      const { detail } = event;
      
      // Update our global state with the latest values
      setGlobalFormState(prev => ({
        answers: detail.answers ? { ...detail.answers } : prev.answers,
        remarks: detail.remarks ? { ...detail.remarks } : prev.remarks,
        form: detail.form || prev.form,
        dynamicSections: detail.dynamicSections || prev.dynamicSections
      }));
    };
    
    // Add event listener
    window.addEventListener(FORM_VALUES_UPDATED, handleFormValuesUpdate);
    
    // Clean up
    return () => {
      window.removeEventListener(FORM_VALUES_UPDATED, handleFormValuesUpdate);
    };
  }, []);
  
  // Function to handle skipping a sample
  const skipSample = async () => {
    if (!auditInProgress || !skipReason.trim()) return;
    
    try {
      // Create the skipped sample record with exactly the right fields
      // according to insertSkippedSampleSchema
      const skippedSample = {
        auditId: auditInProgress.id,
        formName: auditInProgress.formType, 
        agent: auditInProgress.customerName,
        agentId: auditInProgress.id,
        auditor: user?.id ? Number(user.id) : null, // Make sure this is a number or null
        auditorName: user?.username || 'Unknown',
        reason: skipReason.trim(),
        status: 'skipped'
      };
      
      console.log("Submitting skipped sample:", skippedSample);
      
      // Submit to the API
      const response = await fetch('/api/skipped-samples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(skippedSample),
        credentials: 'include'
      });
      
      if (!response.ok) {
        // Log the error details for debugging
        const errorDetails = await response.json();
        console.error('Skip sample API error:', errorDetails);
        throw new Error('Failed to submit skipped sample');
      }
      
      // Find the index of the current audit in the samples array
      const sampleIndex = auditSamples.findIndex(s => s.id === auditInProgress.id);
      
      // Create a clone of the samples array
      const updatedSamples = [...auditSamples];
      
      // Update the status of the skipped audit
      if (sampleIndex !== -1) {
        updatedSamples[sampleIndex] = {
          ...updatedSamples[sampleIndex],
          status: 'skipped', // Mark as skipped (not completed) 
          skipReason: skipReason // Store the skip reason
        };
      }
      
      // Save the updated samples
      setAuditSamples(updatedSamples);
      localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
      
      // Reset states
      setSkipDialogOpen(false);
      setSkipReason('');
      setAuditInProgress(null);
      
      // Show success message
      alert('Sample skipped successfully. It will be reviewed by a team lead, manager, or admin.');
    } catch (error) {
      console.error('Error skipping sample:', error);
      alert('There was an error skipping the sample. Please try again.');
    }
  };

  // Save the current audit as draft
  const saveDraftAudit = () => {
    if (!auditInProgress) {
      console.error('Cannot save draft: No audit in progress');
      return;
    }
    
    try {
      // Log the global form state for debugging
      console.log('Current globalFormState:', globalFormState);
      
      // Get current form values from the UI directly
      // This ensures we capture the most up-to-date values
      const currentFormElements = document.querySelectorAll('.audit-form select, .audit-form input, .audit-form textarea');
      const formValues: Record<string, string> = {};
      const formRemarks: Record<string, string> = {};
      
      console.log(`Found ${currentFormElements.length} form elements for capturing draft values`);
      
      // Extract values from form elements
      currentFormElements.forEach((element: Element) => {
        const htmlElement = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const id = htmlElement.id;
        
        if (!id) {
          console.log('Skipping element without ID');
          return;
        }
        
        // Enhanced handling for different input types and special fields
        if (id.startsWith('remarks-') || id.startsWith('notes-')) {
          // This is a remarks/notes field
          const questionId = id.replace(/^(remarks-|notes-)/, '');
          formRemarks[questionId] = htmlElement.value || '';
          console.log(`Captured remarks for ${questionId}: ${htmlElement.value}`);
        } else if (id.includes('-level2') || id.includes('-level3') || id.includes('-level4')) {
          // This is a hierarchical dropdown level
          formRemarks[id] = htmlElement.value || '';
          console.log(`Captured hierarchical value for ${id}: ${htmlElement.value}`);
        } else if (id.includes('subdropdown')) {
          // This is a subdropdown field
          formRemarks[id] = htmlElement.value || '';
          console.log(`Captured subdropdown value for ${id}: ${htmlElement.value}`);
        } else {
          // This is a standard answer field
          formValues[id] = htmlElement.value || '';
          console.log(`Captured answer for ${id}: ${htmlElement.value}`);
        }
      });
      
      // Merge with global state values to ensure we have everything
      const { answers: globalAnswers, remarks: globalRemarks, form: formDef } = globalFormState;
      
      // Create merged answers and remarks
      const answers = { ...globalAnswers, ...formValues };
      const remarks = { ...globalRemarks, ...formRemarks };
      
      // Check if any values have been entered
      const hasAnswers = Object.values(answers).some(value => value && value.trim() !== '');
      const hasRemarks = Object.values(remarks).some(value => value && value.trim() !== '');
      
      if (!hasAnswers && !hasRemarks) {
        console.warn('No answers or remarks found - empty draft will not be saved');
        alert('You need to fill in at least one field before saving a draft.');
        return;
      }
      
      console.log('Saving draft with these values:', { 
        formValues, 
        formRemarks,
        mergedAnswers: answers,
        mergedRemarks: remarks,
        hasAnswers,
        hasRemarks
      });
      
      console.log("Saving draft for form:", auditInProgress.formType);
      
      // Get saved forms first, so we can use it throughout
      const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
      
      if (!formDef) {
        console.error("Form definition not found in global state");
        
        // Try to find it in the saved forms
        const fallbackFormDef = savedForms.find((f: AuditForm) => f.name === auditInProgress.formType);
        
        if (!fallbackFormDef) {
          alert("Form definition not found. Cannot save the draft.");
          return;
        }
      }
      
      // Use the form definition from either global state or fallback
      const activeFormDef = formDef || savedForms.find((f: AuditForm) => f.name === auditInProgress.formType);
      
      if (!activeFormDef) {
        console.error("Form definition is still missing after fallback attempt");
        alert("Form definition not found. Cannot save the draft.");
        return;
      }
      
      // Prepare sections and answers for the draft
      const sectionAnswers: { sectionName: string; answers: any[] }[] = [];
      
      // Get all sections including dynamic ones from the global form state
      const { form: globalFormDef } = globalFormState;
      const allSections = globalFormDef ? 
        [...globalFormDef.sections, ...(globalFormState.dynamicSections || [])] : 
        activeFormDef.sections;
      
      console.log('Processing sections for draft:', allSections.map(s => s.name));
      
      allSections.forEach(section => {
        const sectionResult = {
          sectionName: section.name,
          answers: []
        };
        
        section.questions.forEach(question => {
          const answer = answers[question.id] || '';
          const remarkText = remarks[question.id] || '';
          
          console.log(`Saving question ${question.id} with answer "${answer}" and remark "${remarkText}"`);
          
          // Add to the section result
          sectionResult.answers.push({
            questionId: question.id,
            questionText: question.text,
            answer,
            remarks: remarkText,
            isFatal: question.isFatal,
            weightage: question.weightage,
            questionType: question.type,
            options: question.options
          });
        });
        
        // Add the section result to the sections array
        sectionAnswers.push(sectionResult);
      });
      
      // Create the draft audit record
      const draftAudit = {
        id: auditInProgress.id,
        formName: auditInProgress.formType,
        agent: auditInProgress.customerName,
        agentId: auditInProgress.id, // Using ID as agentId for consistency
        auditor: user?.username || 'Unknown',
        timestamp: Date.now(),
        sectionAnswers: sectionAnswers,
        score: 0, // Not calculating score for drafts
        maxScore: 100,
        hasFatal: false,
        status: 'draft' as const
      };
      
      console.log('✅ Saved draft audit with data:', draftAudit);
      
      // Get existing drafts
      const savedDraftsStr = localStorage.getItem('qa-draft-audits');
      let draftAudits: any[] = [];
      let isDraftObject = false;
      
      if (savedDraftsStr) {
        try {
          const parsedDrafts = JSON.parse(savedDraftsStr);
          
          // Determine if drafts are stored as an array or object
          if (Array.isArray(parsedDrafts)) {
            console.log('Drafts are stored as an array');
            draftAudits = parsedDrafts;
          } else if (typeof parsedDrafts === 'object') {
            console.log('Drafts are stored as an object with ID keys');
            isDraftObject = true;
            // We'll handle updating the object directly
          }
        } catch (e) {
          console.error('Error parsing draft audits:', e);
          draftAudits = []; // Fallback to empty array
        }
      }
      
      if (isDraftObject) {
        // Get as object and update by ID key
        const draftAuditsObj = JSON.parse(savedDraftsStr || '{}');
        draftAuditsObj[draftAudit.id] = draftAudit;
        localStorage.setItem('qa-draft-audits', JSON.stringify(draftAuditsObj));
      } else {
        // Array format - check if draft already exists
        const existingDraftIndex = draftAudits.findIndex((d: any) => d.id === draftAudit.id);
        
        if (existingDraftIndex !== -1) {
          // Update existing draft
          draftAudits[existingDraftIndex] = draftAudit;
        } else {
          // Add new draft
          draftAudits.push(draftAudit);
        }
        
        // Save back to localStorage
        localStorage.setItem('qa-draft-audits', JSON.stringify(draftAudits));
      }
      
      // Keep track of the in-progress audit for a better user experience
      // This ensures we don't reset to start screen after saving a draft
      const updatedSamples = auditSamples.map(s => 
        s.id === auditInProgress.id ? {
          ...s,
          hasDraft: true // Mark this sample as having a draft
        } : s
      );
      
      setAuditSamples(updatedSamples);
      localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
      
      // Update global form state with the most recent values
      setGlobalFormState({
        answers: answers,
        remarks: remarks,
        form: activeFormDef
      });
      
      // Show a toast notification that automatically dismisses
      const timestamp = new Date().toLocaleString();
      setDraftSaveMessage(`Draft saved at ${timestamp}`);
      setTimeout(() => setDraftSaveMessage(null), 5000); // Auto-dismiss after 5 seconds
      
      // Also show an alert for more detailed information
      alert(`✅ Audit saved as draft at ${timestamp}\n\nData for ${auditInProgress.customerName} has been successfully saved. You can continue working or safely close the form now.`);
      
    } catch (error) {
      console.error('Error saving draft audit:', error);
      alert('Error: There was a problem saving the draft. Please try again.');
    }
  };

  // Complete an audit with proper data capturing
  const completeAudit = () => {
    if (!auditInProgress) return;
    
    try {
      // Get current form values from the UI directly like we do in saveDraftAudit
      // This ensures we capture the most up-to-date values before completion
      const currentFormElements = document.querySelectorAll('.audit-form select, .audit-form input, .audit-form textarea');
      const formValues: Record<string, string> = {};
      const formRemarks: Record<string, string> = {};
      
      console.log(`Found ${currentFormElements.length} form elements for capturing completion values`);
      
      // Extract values from form elements
      currentFormElements.forEach((element: Element) => {
        const htmlElement = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const id = htmlElement.id;
        
        if (!id) {
          return; // Skip elements without IDs
        }
        
        // Enhanced handling for different input types and special fields
        if (id.startsWith('remarks-') || id.startsWith('notes-')) {
          // This is a remarks/notes field
          const questionId = id.replace(/^(remarks-|notes-)/, '');
          formRemarks[questionId] = htmlElement.value || '';
        } else if (id.includes('-level2') || id.includes('-level3') || id.includes('-level4')) {
          // This is a hierarchical dropdown level
          formRemarks[id] = htmlElement.value || '';
        } else if (id.includes('subdropdown')) {
          // This is a subdropdown field
          formRemarks[id] = htmlElement.value || '';
        } else {
          // This is a standard answer field
          formValues[id] = htmlElement.value || '';
        }
      });
      
      // Merge with global state values to ensure we have everything
      const { answers: globalAnswers, remarks: globalRemarks, form: formDef } = globalFormState;
      
      // Create merged answers and remarks, prioritizing the DOM values
      const answers = { ...globalAnswers, ...formValues };
      const remarks = { ...globalRemarks, ...formRemarks };
      
      console.log("Checking required fields in form:", auditInProgress.formType);
      console.log("Current answers:", answers);
      
      // Get saved forms first, so we can use it throughout
      const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
      
      if (!formDef) {
        console.error("Form definition not found in global state");
        
        // Try to find it in the saved forms
        const fallbackFormDef = savedForms.find((f: AuditForm) => f.name === auditInProgress.formType);
        
        if (!fallbackFormDef) {
          alert("Form definition not found. Cannot complete the audit.");
          return;
        }
      }
      
      // Use the form definition from either global state or fallback
      const activeFormDef = formDef || savedForms.find((f: AuditForm) => f.name === auditInProgress.formType);
      
      // Check for required fields
      let missingRequired = false;
      let requiredFields: string[] = [];
      
      const formDefinition = activeFormDef;
      
      if (!formDefinition) {
        console.error("Form definition is still missing after fallback attempt");
        alert("Form definition not found. Cannot complete the audit.");
        return;
      }
      
      console.log("Checking required fields in form:", formDefinition.name);
      console.log("Current answers:", answers);
      
      // Helper functions for visibility (same logic as audits-new.tsx)
      const isSectionVisible = (section: any): boolean => {
        if (!section.controlledBy) return true;
        
        const controllingQuestion = formDefinition.sections
          .flatMap((s: any) => s.questions)
          .find((q: any) => q.controlsSection && q.controlledSectionId === section.id);
        
        if (!controllingQuestion) {
          return true;
        }
        
        const controllingAnswer = answers[controllingQuestion.id];
        const isVisible = controllingQuestion.visibleOnValues?.includes(controllingAnswer || '') ?? false;
        
        return isVisible;
      };

      const isQuestionVisible = (question: any, section: any): boolean => {
        if (!question.controlledBy) return true;
        
        const controllingQuestion = section.questions.find((q: any) => q.id === question.controlledBy);
        
        if (!controllingQuestion) {
          return true;
        }
        
        const controllingAnswer = answers[controllingQuestion.id];
        const visibleValues = question.visibleOnValues?.split(',').map((v: string) => v.trim()) || [];
        const isVisible = visibleValues.includes(controllingAnswer || '');
        
        return isVisible;
      };
      
      // CRITICAL FIX: Validate ALL sections including dynamic sections
      // Get dynamic sections from global form state
      const currentDynamicSections = globalFormState.dynamicSections || [];
      const allSectionsForValidation = [...formDefinition.sections, ...currentDynamicSections];
      console.log('🔧 Validating sections:', allSectionsForValidation.map(s => s.name));
      
      allSectionsForValidation.forEach((section: any) => {
        console.log(`Checking section: ${section.name}`);
        
        // Skip entire section if it's not visible
        if (!isSectionVisible(section)) {
          console.log(`Skipping validation for hidden section: ${section.name}`);
          return;
        }
        
        section.questions.forEach((question: any) => {
          // Skip question if it's not visible due to nested controlling logic
          if (!isQuestionVisible(question, section)) {
            console.log(`Skipping validation for hidden question: ${question.text}`);
            return;
          }
          
          // Check if answer is empty, null, undefined, or just whitespace
          const answerValue = answers[question.id];
          const isEmpty = answerValue === undefined || answerValue === null || 
                        (typeof answerValue === 'string' && answerValue.trim() === '');
          
          if (question.mandatory) {
            console.log(`Mandatory question "${question.text}" (${question.id}) has value: "${answerValue}" (${isEmpty ? 'EMPTY' : 'FILLED'})`);
          }
          
          if (question.mandatory && isEmpty) {
            missingRequired = true;
            requiredFields.push(`${question.text} (${question.id})`);
          }
        });
      });
      
      if (missingRequired) {
        // Show specific fields that are missing
        alert(`Please complete all required fields: ${requiredFields.join(', ')}`);
        return;
      }
      
      // Calculate score - simple version for now
      let maxScore = 0;
      let actualScore = 0;
      let hasFatal = false;
      
      // Format answers by section for easier processing
      const sectionAnswers: {
        sectionName: string;
        answers: {
          questionId: string;
          questionText: string;
          answer: string;
          remarks?: string;
          isFatal: boolean;
          weightage: number;
          questionType: string;
          options?: string;
        }[];
      }[] = [];
      
      // CRITICAL FIX: Process ALL sections including dynamic sections  
      // Get dynamic sections from global form state
      const currentDynamicSectionsForSubmission = globalFormState.dynamicSections || [];
      const allSections = [...formDefinition.sections, ...currentDynamicSectionsForSubmission];
      console.log('🔧 Processing sections for audit submission:', allSections.map(s => s.name));
      
      // Process each section (including dynamic ones)
      allSections.forEach((section: any) => {
        const sectionResult = {
          sectionName: section.name,
          answers: [] as any[]
        };
        
        // Process each question in this section
        section.questions.forEach((question: any) => {
          const answer = answers[question.id] || '';
          const remarkText = remarks[question.id] || '';
          
          // Add to the total maximum possible score
          maxScore += question.weightage;
          
          // Check if this is a fatal error
          if (question.isFatal) {
            // For fatal questions, check if the selected answer is one that should be marked as fatal
            // This is a simplified check - would need to be customized based on form needs
            const fatalAnswers = ['No', 'Failed', 'Missing'];
            if (fatalAnswers.includes(answer)) {
              hasFatal = true;
            }
          }
          
          // Add to actual score if not a deduction
          // This is a simplified scoring - would need to be customized
          if (answer && answer !== 'No' && answer !== 'Failed') {
            actualScore += question.weightage;
          }
          
          // Add the answer to the section result
          sectionResult.answers.push({
            questionId: question.id,
            questionText: question.text,
            answer,
            remarks: remarkText,
            isFatal: question.isFatal,
            weightage: question.weightage,
            questionType: question.type,
            options: question.options
          });
        });
        
        // Add the section result to the sections array
        sectionAnswers.push(sectionResult);
      });
      
      // If any fatal errors, zero the score
      if (hasFatal) {
        actualScore = 0;
      }
      
      // Calculate percentage score
      const percentScore = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;
      
      // Create the audit record
      const completedAudit = {
        id: auditInProgress.id,
        formName: auditInProgress.formType,
        agent: auditInProgress.customerName,
        agentId: auditInProgress.id,
        auditor: user?.username || 'Unknown',
        timestamp: Date.now(),
        sectionAnswers: sectionAnswers,
        score: percentScore,
        maxScore: 100,
        hasFatal: hasFatal,
        status: 'completed' as const
      };
      
      console.log('✅ Completed audit with data:', completedAudit);
      
      // CRITICAL: Save the audit data for "View Results" functionality 
      saveAuditAnswersForViewing(auditInProgress.id, {
        timestamp: Date.now(),
        formName: auditInProgress.formType,
        auditor: user?.username || 'Unknown',
        agent: auditInProgress.customerName,
        sectionAnswers: sectionAnswers,
        score: percentScore,
        maxScore: 100
      });
      console.log(`✅ Saved audit answers for viewing later:`, auditInProgress.id);
      
      // Add to submitted audits
      const submittedAudits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
      submittedAudits.push(completedAudit);
      localStorage.setItem('qa-submitted-audits', JSON.stringify(submittedAudits));
      
      // Create a copy to add to completed audits
      const completedAudits = JSON.parse(localStorage.getItem('qa-completed-audits') || '[]');
      completedAudits.push(completedAudit);
      localStorage.setItem('qa-completed-audits', JSON.stringify(completedAudits));
      
      // Update the audit sample status
      const updatedSamples = auditSamples.map(s => 
        s.id === auditInProgress.id ? 
        { ...s, status: 'completed' as const } : s
      );
      setAuditSamples(updatedSamples);
      localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
      
      // Add to reports
      // Convert completed audit to report format and add to qa-reports
      const newReport = {
        id: completedAudit.id,
        auditId: completedAudit.id,
        agent: completedAudit.agent,
        auditor: user?.username || "Unknown",
        formName: completedAudit.formName,
        timestamp: completedAudit.timestamp,
        score: Math.round((completedAudit.score / completedAudit.maxScore) * 100),
        answers: completedAudit.sectionAnswers.map(section => ({
          section: section.sectionName,
          questions: section.answers.map(answer => ({
            text: answer.questionText,
            answer: answer.answer,
            remarks: answer.remarks,
            questionType: answer.questionType,
            isFatal: answer.isFatal,
            weightage: answer.weightage,
            questionId: answer.questionId,
            options: answer.options
          }))
        }))
      };
      
      // Get existing reports
      const reports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
      reports.push(newReport);
      localStorage.setItem('qa-reports', JSON.stringify(reports));
      
      // Use alert instead of toast, include timestamp and details
      const timestamp = new Date().toLocaleString();
      const fatalStatus = hasFatal ? ' (Contains Fatal Error)' : '';
      alert(`✅ Audit Completed at ${timestamp}\n\nAudit for ${auditInProgress.customerName} has been completed with a score of ${percentScore}%${fatalStatus}\n\nThe report has been saved and is available in the Reports section.`);
      
      // Clear current audit
      setAuditInProgress(null);
      
      // Reset the form data
      localStorage.removeItem(`qa-audit-form-data-${auditInProgress.formType}`);
      
      // Direct manually to completed tab
      setActiveTab('completed');
      
      // No page refresh, simply navigate back to the audits list
      // and clear any form state
      setGlobalFormState({
        answers: {},
        remarks: {},
        form: null
      });
    } catch (error) {
      console.error('Error completing audit:', error);
      alert(`Error: There was a problem completing the audit. Please try again.`);
    }
  };

  // Reset assigned samples
  const resetAssignment = (sampleId: string) => {
    const updatedSamples = auditSamples.map(s => 
      s.id === sampleId ? 
      { ...s, status: 'available', assignedTo: undefined } : s
    );
    
    setAuditSamples(updatedSamples);
    localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
  };
  
  // Permanently delete a sample (admin only)
  const permanentDelete = async (sampleId: string) => {
    try {
      // First, find the sample to get its ID before removal
      const sample = auditSamples.find(s => s.id === sampleId);
      if (!sample) {
        console.error(`Sample with ID ${sampleId} not found`);
        return;
      }
      
      // Call the server API to permanently delete
      const response = await fetch(`/api/audit-samples/${sampleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete sample: ${response.statusText}`);
      }
      
      // Update the local state
      const updatedSamples = auditSamples.filter(s => s.id !== sampleId);
      setAuditSamples(updatedSamples);
      
      // Update localStorage
      localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
      
      // Add to permanently deleted registry to prevent re-adding
      const permanentlyDeletedIds = JSON.parse(localStorage.getItem('qa-permanently-deleted-ids') || '[]');
      permanentlyDeletedIds.push(String(sampleId));
      if (sample.ticketId) {
        permanentlyDeletedIds.push(String(sample.ticketId));
      }
      localStorage.setItem('qa-permanently-deleted-ids', JSON.stringify(permanentlyDeletedIds));
      console.log("Added to permanently deleted registry");
      
      alert(`Audit sample ${sample.ticketId || sampleId} has been permanently deleted.`);
    } catch (error) {
      console.error('Error permanently deleting sample:', error);
      alert('Failed to permanently delete the sample. Please try again.');
    }
  };

  // Handle selecting all samples
  const toggleSelectAllSamples = (checked: boolean) => {
    if (checked) {
      const availableSampleIds = auditSamples
        .filter(s => s.status === 'available')
        .map(s => s.id);
      setSelectedSamples(availableSampleIds);
    } else {
      setSelectedSamples([]);
    }
  };

  // Toggle selection of a single sample
  const toggleSampleSelection = (sampleId: string) => {
    setSelectedSamples(prev => 
      prev.includes(sampleId) ? 
      prev.filter(id => id !== sampleId) : 
      [...prev, sampleId]
    );
  };

  // Filter samples based on search input
  const getFilteredSamples = (status?: AuditSample['status']) => {
    let filtered = auditSamples;
    
    // Always exclude skipped samples from regular tabs - they should only appear in Skip Reports tab
    if (status !== 'skipped') {
      filtered = filtered.filter(s => s.status !== 'skipped');
    }
    
    // Filter by status if specified
    if (status) {
      filtered = filtered.filter(s => s.status === status);
    }
    
    // Filter by assignee if auditor
    if (isAuditor && user) {
      filtered = filtered.filter(s => s.assignedTo === user.username);
      
      // Auditors should never see skipped samples
      filtered = filtered.filter(s => s.status !== 'skipped');
    }
    
    // Apply search filter
    if (sampleFilter) {
      const lowerFilter = sampleFilter.toLowerCase();
      filtered = filtered.filter(s => 
        s.customerName.toLowerCase().includes(lowerFilter) ||
        s.ticketId.toLowerCase().includes(lowerFilter) ||
        s.formType.toLowerCase().includes(lowerFilter) ||
        (s.metadata?.category && s.metadata.category.toLowerCase().includes(lowerFilter))
      );
    }
    
    return filtered;
  };

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status badge variants
  const getStatusBadge = (status: AuditSample['status']) => {
    switch (status) {
      case 'available':
        return <Badge variant="outline">Available</Badge>;
      case 'assigned':
        return <Badge variant="secondary">Assigned</Badge>;
      case 'inProgress':
        return <Badge variant="default">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Render priority badge with color
  const getPriorityBadge = (priority?: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container py-8">
      {/* Toast notification for draft save */}
      {draftSaveMessage && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-100 text-green-800 rounded-md px-4 py-3 shadow-md z-50 max-w-md animate-in slide-in-from-top fade-in duration-300">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
            <span className="font-medium">{draftSaveMessage}</span>
          </div>
          <button 
            onClick={() => setDraftSaveMessage(null)} 
            className="absolute top-2 right-2 text-green-500 hover:text-green-700"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Audit Management</h1>
        
        {canManageSamples && (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Samples
            </Button>
            
            <Button 
              onClick={() => setAssignDialogOpen(true)}
              disabled={getFilteredSamples('available').length === 0}
            >
              <Users className="h-4 w-4 mr-2" />
              Assign Samples
            </Button>
          </div>
        )}
      </div>
      
      <Tabs defaultValue="assigned" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          {isAuditor ? (
            <>
              <TabsTrigger value="assigned">
                My Assigned Audits ({getFilteredSamples('assigned').length})
              </TabsTrigger>
              <TabsTrigger value="inProgress">
                In Progress ({getFilteredSamples('inProgress').length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({getFilteredSamples('completed').length})
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="available">
                Available Pool ({getFilteredSamples('available').length})
              </TabsTrigger>
              <TabsTrigger value="assigned">
                Assigned ({getFilteredSamples('assigned').length})
              </TabsTrigger>
              <TabsTrigger value="inProgress">
                In Progress ({getFilteredSamples('inProgress').length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({getFilteredSamples('completed').length})
              </TabsTrigger>
              {(isAdmin || isManager || isTeamLeader) && (
                <TabsTrigger value="skipped">
                  Skip Reports ({getFilteredSamples('skipped').length})
                </TabsTrigger>
              )}
            </>
          )}
        </TabsList>
        
        <div className="mb-4 relative">
          <Input
            placeholder="Search by customer name, ticket ID, or category..."
            value={sampleFilter}
            onChange={(e) => setSampleFilter(e.target.value)}
            className="pr-8"
          />
          <Filter className="h-4 w-4 absolute right-3 top-3 text-muted-foreground" />
        </div>
        
        {/* Available Pool Tab - Only visible to Admins/Managers/Team Leaders */}
        {!isAuditor && (
          <TabsContent value="available">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Available Audit Pool</CardTitle>
                    <CardDescription>
                      All unassigned audit samples ready for allocation
                    </CardDescription>
                  </div>
                  {getFilteredSamples('available').length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportAuditDataAsCSV(getFilteredSamples('available'))}
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {getFilteredSamples('available').length > 0 ? (
                  <div className="space-y-3">
                    {getFilteredSamples('available').map(sample => (
                      <div 
                        key={sample.id}
                        className="p-3 border rounded-md hover:bg-muted transition-colors flex justify-between items-center"
                      >
                        <div className="flex items-center space-x-3">
                          <Checkbox 
                            checked={selectedSamples.includes(sample.id)}
                            onCheckedChange={() => toggleSampleSelection(sample.id)}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{sample.customerName}</h3>
                              {getPriorityBadge(sample.priority)}
                            </div>
                            <p className="text-sm">
                              Ticket: <span className="font-mono">{sample.ticketId}</span> 
                              {sample.metadata?.channel && (
                                <span className="ml-2 capitalize">[{sample.metadata.channel}]</span>
                              )}
                            </p>
                            <div className="flex text-xs text-muted-foreground gap-3">
                              <span>Type: {sample.formType}</span>
                              <span>Date: {new Date(sample.date).toLocaleDateString()}</span>
                              {sample.metadata?.duration && (
                                <span>Duration: {formatDuration(sample.metadata.duration)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => {
                                    setSelectedSamples([sample.id]);
                                    setAssignDialogOpen(true);
                                  }}
                                >
                                  <User className="h-4 w-4 mr-1" />
                                  Assign
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Assign this sample to an auditor</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <ClipboardList className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p>No available audit samples found.</p>
                    <p className="text-sm">Upload new samples using the "Upload Samples" button.</p>
                  </div>
                )}
              </CardContent>
              {getFilteredSamples('available').length > 0 && (
                <CardFooter className="flex justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="select-all"
                      onCheckedChange={(checked) => toggleSelectAllSamples(!!checked)} 
                    />
                    <Label htmlFor="select-all">Select All</Label>
                  </div>
                  
                  <Button 
                    variant="default" 
                    onClick={() => setAssignDialogOpen(true)}
                    disabled={selectedSamples.length === 0}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Assign Selected ({selectedSamples.length})
                  </Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
        )}
        
        {/* Assigned Tab */}
        <TabsContent value="assigned">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>
                    {isAuditor ? 'My Assigned Audits' : 'Assigned Audit Samples'}
                  </CardTitle>
                  <CardDescription>
                    {isAuditor 
                      ? 'Audits that have been assigned to you'
                      : 'Samples that have been assigned to auditors but not yet started'}
                  </CardDescription>
                </div>
                {getFilteredSamples('assigned').length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportAuditDataAsCSV(getFilteredSamples('assigned'))}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {getFilteredSamples('assigned').length > 0 ? (
                <div className="space-y-3">
                  {getFilteredSamples('assigned').map(sample => (
                    <AuditSampleItem
                      key={sample.id}
                      sample={{
                        ...sample,
                        status: 'assigned' // Force the status to ensure correct badge
                      }}
                      isAuditor={isAuditor}
                      isAdmin={isAdmin}
                      onStartAudit={startAudit}
                      onResetAssignment={resetAssignment}
                      onPermanentDelete={permanentDelete}
                      getPriorityBadge={getPriorityBadge}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <AlertCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p>No assigned audits found.</p>
                  {isAuditor ? (
                    <p className="text-sm">Wait for a manager to assign audits to you.</p>
                  ) : (
                    <p className="text-sm">Assign samples from the Available Pool to auditors.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* In Progress Tab */}
        <TabsContent value="inProgress">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>In-Progress Audits</CardTitle>
                  <CardDescription>
                    Audits that are currently being worked on
                  </CardDescription>
                </div>
                {getFilteredSamples('inProgress').length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportAuditDataAsCSV(getFilteredSamples('inProgress'))}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {getFilteredSamples('inProgress').length > 0 ? (
                <div className="space-y-3">
                  {getFilteredSamples('inProgress').map(sample => (
                    <div key={sample.id}>
                      <AuditSampleItem
                        sample={{
                          ...sample,
                          status: 'inProgress' // Force the status to ensure correct badge
                        }}
                        isAuditor={isAuditor}
                        isAdmin={isAdmin}
                        onStartAudit={setAuditInProgress}
                        onPermanentDelete={permanentDelete}
                        getPriorityBadge={getPriorityBadge}
                        formatDuration={formatDuration}
                      />
                      {!isAuditor && (
                        <div className="flex justify-end mt-2 items-center space-x-2">
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            In Progress
                          </Badge>
                          
                          {/* Only admin can reset in-progress audits */}
                          {user?.username === 'admin' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetAssignment(sample.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Reset
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={true}
                              className="opacity-50 cursor-not-allowed"
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Reset
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p>No in-progress audits found.</p>
                  {isAuditor && (
                    <p className="text-sm">Start working on your assigned audits to see them here.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Completed Tab */}
        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Completed Audits</CardTitle>
                  <CardDescription>
                    Audit samples that have been fully processed
                  </CardDescription>
                </div>
                {getFilteredSamples('completed').length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportAuditDataAsCSV(getFilteredSamples('completed'))}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {getFilteredSamples('completed').length > 0 ? (
                <div className="space-y-3">
                  {getFilteredSamples('completed').map(sample => (
                    <div key={sample.id}>
                      <AuditSampleItem
                        sample={{
                          ...sample,
                          status: 'completed' // Force the status to ensure correct badge
                        }}
                        isAuditor={isAuditor}
                        isAdmin={isAdmin}
                        onPermanentDelete={permanentDelete}
                        getPriorityBadge={() => <Badge variant="success">Completed</Badge>}
                        formatDuration={formatDuration}
                      />
                      <div className="flex justify-end mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // Extract the ID from the sample
                            const auditId = sample.id;
                            console.log(`Viewing results for audit: ${auditId}`);
                            
                            try {
                              // FIRST check if we have saved view data specifically for this audit
                              const savedViewData = getAuditAnswersForViewing(auditId);
                              
                              if (savedViewData) {
                                console.log(`✅ Found saved audit view data for ${auditId}:`, savedViewData);
                                
                                // Process section answers from our saved view data
                                const processedAnswers = processAuditAnswersForDisplay(savedViewData.sectionAnswers, savedViewData.formName);
                                
                                // Create view model with the saved data
                                const auditViewModel = {
                                  id: auditId,
                                  agent: savedViewData.agent || sample.customerName,
                                  formName: savedViewData.formName || sample.formType,
                                  score: savedViewData.score || 0,
                                  maxScore: savedViewData.maxScore || 100,
                                  timestamp: savedViewData.timestamp || sample.date,
                                  auditor: savedViewData.auditor || sample.assignedTo || user?.username,
                                  sections: processedAnswers
                                };
                                
                                // Show the view with accurate saved data
                                console.log("Showing audit with saved view data:", auditViewModel);
                                showAuditResultsModal(auditViewModel);
                                return; // Exit early since we've handled the display
                              }
                              
                              // If no saved view data, search in all possible storage locations
                              const submittedAudits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
                              const completedAudits = JSON.parse(localStorage.getItem('qa-completed-audits') || '[]');
                              const samples = JSON.parse(localStorage.getItem('qa-audit-samples') || '[]');
                              
                              // Find the audit details, checking multiple sources
                              let auditDetails = null;
                              
                              // First check submitted audits
                              console.log(`Checking ${submittedAudits.length} submitted audits`);
                              auditDetails = submittedAudits.find((a: any) => String(a.id) === String(auditId));
                              
                              // If not found, check completed audits
                              if (!auditDetails) {
                                console.log(`Checking ${completedAudits.length} completed audits`);
                                auditDetails = completedAudits.find((a: any) => String(a.id) === String(auditId));
                              }
                              
                              // If still not found, try to build from the audit sample itself
                              if (!auditDetails) {
                                console.log(`Checking ${samples.length} audit samples`);
                                const matchingSample = samples.find((s: any) => String(s.id) === String(auditId));
                                
                                if (matchingSample) {
                                  console.log(`✓ Found matching audit sample`);
                                  console.log(`Using data from audit sample to build detailed view`);
                                  
                                  // For sample data, we need a basic structure with available data
                                  console.log(`Formatting audit:`, matchingSample);
                                  
                                  try {
                                    // Check if this is a sample object with predefined sections/questions
                                    if (matchingSample.sectionAnswers) {
                                      console.log(`Found sectionAnswers in sample, using directly`);
                                      auditDetails = matchingSample;
                                    } else {
                                      console.log(`Detected sample object format, attempting to process directly...`);
                                      
                                      // Load the form definition to get the structure
                                      const savedForms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
                                      let formDef = savedForms.find((f: any) => f.name === matchingSample.formType);
                                      
                                      if (formDef) {
                                        console.log(`Found form definition for "${matchingSample.formType}" with ${formDef.sections.length} sections`);
                                        
                                        // First, let's check if we have any actual audit data in completed audits
                                      let actualAuditData = null;
                                      
                                      try {
                                        // Check for completed audits
                                        const completedAudits = JSON.parse(localStorage.getItem('qa-completed-audits') || '[]');
                                        actualAuditData = completedAudits.find((a: any) => String(a.id) === String(matchingSample.id));
                                        
                                        // If not found, check form builder audits
                                        if (!actualAuditData) {
                                          const formBuilderAudits = JSON.parse(localStorage.getItem('qa-form-builder-audits') || '[]');
                                          actualAuditData = formBuilderAudits.find((a: any) => String(a.id) === String(matchingSample.id));
                                        }
                                      } catch (error) {
                                        console.error('Error looking for actual audit data:', error);
                                      }
                                      
                                      if (actualAuditData && actualAuditData.sectionAnswers) {
                                        console.log('Found actual audit data for this sample:', actualAuditData);
                                        return actualAuditData.sectionAnswers;
                                      }
                                      
                                      // Create simpler answers - empty for all questions except specific ones
                                      const sampleSectionAnswers = formDef.sections.map((section: any) => {
                                        return {
                                          sectionName: section.name,
                                          answers: section.questions.map((q: any) => {
                                            let answer = '';
                                            
                                            // Use real data for agent fields
                                            if (q.text.toLowerCase().includes('agent')) {
                                              answer = matchingSample.customerName;
                                            } 
                                            // Use ticket ID for ticket fields
                                            else if (q.text.toLowerCase().includes('ticket')) {
                                              answer = matchingSample.ticketId;
                                            }
                                            // For dropdown questions, use the first option
                                            else if (q.type === 'dropdown' && q.options) {
                                              const options = q.options.split(',');
                                              if (options.length > 0) {
                                                answer = options[0].trim();
                                              }
                                            }
                                            
                                            return {
                                              questionId: q.id,
                                              questionText: q.text,
                                              answer: answer,
                                              remarks: '',
                                              questionType: q.type,
                                              options: q.options,
                                              isFatal: q.isFatal,
                                              weightage: q.weightage
                                            };
                                          })
                                        };
                                      });
                                        
                                        auditDetails = {
                                          id: matchingSample.id,
                                          agent: matchingSample.customerName || 'Open Sample',
                                          formName: matchingSample.formType,
                                          timestamp: matchingSample.date,
                                          score: 0, // For samples
                                          auditorName: matchingSample.assignedTo || user?.username,
                                          sectionAnswers: sampleSectionAnswers
                                        };
                                      }
                                    }
                                  } catch (err) {
                                    console.error('Error creating sample report:', err);
                                  }
                                }
                              }
                              
                              // Now create the view details with proper audit data
                              if (auditDetails) {
                                // Get important data about the audit
                                const formName = auditDetails.formName || sample.formType;
                                const auditor = auditDetails.auditorName || sample.assignedTo || user?.username || 'Unknown';
                                const agent = auditDetails.agent || sample.customerName || 'Open Sample';
                                
                                console.log(`Viewing audit by: ${auditor}, for agent: ${agent}`);
                                
                                // Process section answers for display
                                const processedAnswers = auditDetails.sectionAnswers 
                                  ? processAuditAnswersForDisplay(auditDetails.sectionAnswers, formName)
                                  : [];
                                
                                // Create view model for displaying the audit
                                const auditViewModel = {
                                  id: auditId,
                                  agent: agent,
                                  formName: formName,
                                  score: auditDetails.score || 0,
                                  maxScore: auditDetails.maxScore || 100,
                                  timestamp: auditDetails.timestamp || sample.date || Date.now(),
                                  auditor: auditor,
                                  sections: processedAnswers
                                };
                                
                                console.log("Audit view model prepared:", auditViewModel);
                                
                                // Show the audit details in a modal
                                showAuditResultsModal(auditViewModel);
                              } else {
                                console.error(`No audit details found for ID ${auditId} in any storage location`);
                                alert('Audit details not found. Please try again.');
                              }
                            } catch (error) {
                              console.error('Error viewing audit results:', error);
                              alert('Error loading audit results. Please try again.');
                            }
                          }}
                        >
                          View Results
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <CheckCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p>No completed audits found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skipped Samples Tab - Only visible to Admins/Managers/Team Leaders */}
        {(isAdmin || isManager || isTeamLeader) && (
          <TabsContent value="skipped">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Skipped Audit Samples</CardTitle>
                    <CardDescription>
                      Audit samples that were skipped by auditors with reason
                    </CardDescription>
                  </div>
                  {getFilteredSamples('skipped').length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportAuditDataAsCSV(getFilteredSamples('skipped'))}
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {getFilteredSamples('skipped').length > 0 ? (
                  <div className="space-y-3">
                    {getFilteredSamples('skipped').map(sample => (
                      <div 
                        key={sample.id}
                        className="p-3 border rounded-md hover:bg-muted transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{sample.customerName}</h3>
                              <Badge variant="destructive">Skipped</Badge>
                              {getPriorityBadge(sample.priority)}
                            </div>
                            <p className="text-sm">
                              Ticket: <span className="font-mono">{sample.ticketId}</span>
                              {sample.metadata?.channel && (
                                <span className="ml-2 capitalize">[{sample.metadata.channel}]</span>
                              )}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetAssignment(sample.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Reset
                            </Button>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedSampleToDelete(sample);
                                  setDeleteConfirmDialogOpen(true);
                                }}
                              >
                                <Trash className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2 bg-muted p-3 rounded-md">
                          <p className="text-sm font-semibold mb-1">Skip Reason:</p>
                          <p className="text-sm">{sample.skipReason || "No reason provided"}</p>
                        </div>
                        
                        <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-3">
                          <span>Form: {sample.formType}</span>
                          <span>Date: {new Date(sample.date).toLocaleDateString()}</span>
                          <span>Skipped by: {sample.assignedTo || "Unknown"}</span>
                          {sample.metadata?.duration && (
                            <span>Duration: {formatDuration(sample.metadata.duration)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Ban className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p>No skipped samples found.</p>
                    <p className="text-sm">When auditors skip samples, they will appear here with the skip reason.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      
      {/* Current Audit UI - Shows when an audit is in progress */}
      {auditInProgress && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{auditInProgress.formType}</h2>
                  <div className="text-sm text-muted-foreground mt-1">
                    Ticket: <span className="font-mono">{auditInProgress.ticketId}</span> • 
                    Customer: {auditInProgress.customerName}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setAuditInProgress(null)}>
                  ✕
                </Button>
              </div>
              
              <div className="space-y-6 audit-form">
                <AuditFormRenderer formName={auditInProgress.formType} />
                
                <div className="flex justify-between space-x-2">
                  <Button 
                    variant="destructive" 
                    onClick={() => setSkipDialogOpen(true)}
                  >
                    Skip Sample
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={saveDraftAudit}>
                      Save Draft
                    </Button>
                    <Button onClick={completeAudit}>
                      Complete Audit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sample Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            // Reset file name when closing the dialog
            setSelectedFileName("");
          }
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Audit Samples</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file containing customer audit samples or create open samples
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="upload">Upload Agent Data</TabsTrigger>
              <TabsTrigger value="open">Create Open Samples</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload">
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="file-upload">File</Label>
                  <label className={`border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <FileSpreadsheet className="h-8 w-8 mb-2 text-muted-foreground" />
                    {selectedFileName ? (
                      <div className="text-sm text-center mb-3">
                        <p className="font-medium text-primary">{selectedFileName}</p>
                        <p className="text-muted-foreground mt-1">Click to change file</p>
                      </div>
                    ) : (
                      <div className="text-sm text-center text-muted-foreground mb-3">
                        <p>Drag and drop your Excel file here, or</p>
                        <p>click to browse</p>
                      </div>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      type="button"
                      disabled={isUploading}
                      onClick={(e) => {
                        e.preventDefault(); // Prevent form submission
                        document.getElementById('file-upload')?.click();
                      }}
                    >
                      <FileUp className="h-4 w-4 mr-2" />
                      Browse Files
                    </Button>
                    <input 
                      type="file" 
                      id="file-upload" 
                      className="hidden" 
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        // Set the file name for display
                        if (e.target.files && e.target.files.length > 0) {
                          setSelectedFileName(e.target.files[0].name);
                        }
                      }} 
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .csv, .xlsx, .xls (max 10MB)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="form-type">Default Audit Form Type</Label>
                  <Select 
                    defaultValue={availableForms[0]?.id || ""}
                    value={selectedForm || availableForms[0]?.id || ""}
                    onValueChange={setSelectedForm}
                    disabled={isUploading}
                  >
                    <SelectTrigger id="form-type">
                      <SelectValue placeholder="Select form type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableForms.map(form => (
                        <SelectItem key={form.id} value={form.id || "default-form"}>{form.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This will be used if no form type is specified in the file
                  </p>
                </div>
                
                {isUploading && (
                  <div className="py-2 flex items-center justify-center text-center">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                      <p className="text-sm text-muted-foreground">Processing Excel file...</p>
                    </div>
                  </div>
                )}
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    type="button" 
                    onClick={() => setUploadDialogOpen(false)}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={!selectedFileName || isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Samples'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="open">
              <form onSubmit={(e) => {
                e.preventDefault();
                // Get the sample count from the input field
                const countInput = document.getElementById('sample-count') as HTMLInputElement;
                const sampleCount = parseInt(countInput?.value || '5', 10); // Default to 5 if input is invalid
                
                // Use the React state value instead of getting from DOM
                // This ensures we have the correct form selected
                const selectedFormObj = availableForms.find(form => form.id === selectedForm);
                const formName = selectedFormObj?.name || availableForms[0]?.name || 'Customer Service Audit';
                
                console.log("Creating samples with form:", { selectedForm, formName });
                
                const newSamples: AuditSample[] = [];
                
                for (let i = 0; i < sampleCount; i++) {
                  const newSample: AuditSample = {
                    id: generateAuditId(),
                    customerName: 'Open Sample',
                    ticketId: `OPEN-${30000 + Math.floor(Math.random() * 5000)}`,
                    date: Date.now(),
                    status: 'available',
                    formType: formName,
                    priority: 'medium',
                    metadata: {
                      category: 'Open Sample'
                    }
                  };
                  
                  newSamples.push(newSample);
                }
                
                const updatedSamples = [...auditSamples, ...newSamples];
                
                // Update state and localStorage
                setAuditSamples(updatedSamples);
                localStorage.setItem('qa-audit-samples', JSON.stringify(updatedSamples));
                
                setUploadDialogOpen(false);
                
                // Show success notification
                alert(`Successfully created ${sampleCount} open audit samples using the "${formName}" form.`);
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="open-form-type">Audit Form Type</Label>
                  <Select 
                    defaultValue={availableForms[0]?.id || ""}
                    value={selectedForm || availableForms[0]?.id || ""}
                    onValueChange={setSelectedForm}
                  >
                    <SelectTrigger id="open-form-type">
                      <SelectValue placeholder="Select form type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableForms.map(form => (
                        <SelectItem key={form.id} value={form.id || "default-form"}>{form.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the audit form to use for these open samples
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sample-count">Number of Open Samples</Label>
                  <Input 
                    id="sample-count" 
                    type="number" 
                    defaultValue="5" 
                    min="1"
                    max="20"
                  />
                  <p className="text-xs text-muted-foreground">
                    Agents will fill in details when conducting these audits
                  </p>
                </div>
                
                <div className="rounded-md bg-blue-50 p-4 mt-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">Open Sample Mode</h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>
                          Open samples allow auditors to manually enter agent and interaction details during the audit process.
                          This is useful when you don't have pre-populated agent data.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Create Open Samples
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {/* Sample Assignment Dialog */}
      <Dialog 
      open={assignDialogOpen} 
      onOpenChange={(open) => {
        if (open) {
          console.log("Assignment dialog opened with", auditorUsers.length, "auditors already loaded");
          
          // Preselect the first auditor if there are auditors but none is selected
          if (auditorUsers.length > 0 && !selectedAuditor) {
            console.log("Preselecting first auditor:", auditorUsers[0].username);
            setSelectedAuditor(auditorUsers[0].username);
          } 
          
          // Update workload counts on all auditors based on current sample assignments
          if (auditorUsers.length > 0) {
            const updatedAuditors = auditorUsers.map(auditor => ({
              ...auditor,
              workload: auditSamples.filter(s => 
                s.assignedTo === auditor.username && 
                s.status !== 'completed' && 
                s.status !== 'skipped'
              ).length
            }));
            setAuditorUsers(updatedAuditors);
          }
          
          // If we still have no auditors, make sure we check for any defaults
          if (auditorUsers.length === 0) {
            console.log("No auditors available, checking fallbacks");
            
            // First check if we have cached auditors
            const cachedAuditors = localStorage.getItem('qa-cached-auditors');
            if (cachedAuditors) {
              try {
                const parsedAuditors = JSON.parse(cachedAuditors);
                console.log("Using cached auditors:", parsedAuditors.length);
                if (parsedAuditors.length > 0) {
                  setAuditorUsers(parsedAuditors);
                  setSelectedAuditor(parsedAuditors[0].username);
                }
              } catch (e) {
                console.error("Error parsing cached auditors:", e);
              }
            }
          }
        }
        setAssignDialogOpen(open);
      }}
    >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign Audit Samples
              {selectedSamples.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {selectedSamples.length} selected
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Assign samples to auditors for processing
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-2">
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Assignment</TabsTrigger>
                <TabsTrigger value="bulk">Bulk Assignment</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auditor">Select Auditor</Label>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="random-assign" className="text-sm">Random Assignment</Label>
                      <Switch 
                        id="random-assign"
                        checked={randomAssign}
                        onCheckedChange={setRandomAssign}
                      />
                    </div>
                  </div>
                  
                  <Select 
                    value={selectedAuditor} 
                    onValueChange={(value) => {
                      console.log("Manual assignment: Auditor selected:", value);
                      setSelectedAuditor(value);
                    }}
                    disabled={randomAssign}
                  >
                    <SelectTrigger id="auditor">
                      <SelectValue placeholder="Select an auditor" />
                    </SelectTrigger>
                    <SelectContent>
                      {auditorUsers.length > 0 ? (
                        auditorUsers.map(auditor => (
                          <SelectItem key={auditor.id} value={auditor.username}>
                            {auditor.username} ({auditor.workload} assigned)
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="dummy">Select an auditor</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedSamples.length > 0 ? (
                  <div className="border rounded-md py-2">
                    <div className="px-3 py-1 text-sm font-medium">
                      Selected Samples ({selectedSamples.length})
                    </div>
                    <ScrollArea className="h-[120px]">
                      {selectedSamples.map(id => {
                        const sample = auditSamples.find(s => s.id === id);
                        return sample ? (
                          <div key={id} className="flex items-center justify-between px-3 py-1 hover:bg-muted">
                            <div className="text-sm">
                              <span className="font-medium">{sample.customerName}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({sample.ticketId})
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleSampleSelection(id)}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : null;
                      })}
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No samples selected. Return to the Available Pool to select samples.
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="bulk" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-auditor">Select Auditor</Label>
                  <Select 
                    value={selectedAuditor} 
                    onValueChange={(value) => {
                      console.log("Bulk assignment: Auditor selected:", value);
                      setSelectedAuditor(value);
                    }}
                  >
                    <SelectTrigger id="bulk-auditor">
                      <SelectValue placeholder="Select an auditor" />
                    </SelectTrigger>
                    <SelectContent>
                      {auditorUsers.length > 0 ? (
                        auditorUsers.map(auditor => (
                          <SelectItem key={auditor.id} value={auditor.username}>
                            {auditor.username} ({auditor.workload} assigned)
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="dummy">Select an auditor</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assign-count">Number of Samples to Assign</Label>
                  <Input
                    id="assign-count"
                    type="number"
                    placeholder="Enter number of samples"
                    min="1"
                    value={assignCount}
                    onChange={(e) => setAssignCount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {getFilteredSamples('available').length} samples available in pool
                  </p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Assignment Options</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="priority-high" />
                      <Label htmlFor="priority-high" className="text-sm">
                        Prioritize high priority samples
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="oldest-first" defaultChecked />
                      <Label htmlFor="oldest-first" className="text-sm">
                        Assign oldest samples first
                      </Label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={activeTab === 'bulk' ? handleBulkAssign : handleAssignSamples}
              disabled={(selectedSamples.length === 0 && activeTab !== 'bulk') || 
                      (!selectedAuditor && !randomAssign)}
            >
              Assign Samples
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Skip Sample Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skip Audit Sample</DialogTitle>
            <DialogDescription>
              Please provide a reason why this sample cannot be audited. This will be reviewed by a team lead, manager, or admin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="skip-reason">Reason for skipping</Label>
              <Textarea 
                id="skip-reason" 
                placeholder="Please explain why this sample cannot be audited..."
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="min-h-[100px]"
                required
              />
            </div>
            
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Skipped samples will be reviewed by team leads, managers, or admins. Please provide a detailed reason to justify skipping this audit sample.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={skipSample}
              disabled={!skipReason.trim()}
            >
              Skip Sample
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Permanent Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this audit sample? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedSampleToDelete && (
            <div className="border rounded-md p-3 mt-2">
              <p><strong>Customer:</strong> {selectedSampleToDelete.customerName}</p>
              <p><strong>Ticket ID:</strong> {selectedSampleToDelete.ticketId}</p>
              <p><strong>Form Type:</strong> {selectedSampleToDelete.formType}</p>
              {selectedSampleToDelete.skipReason && (
                <p><strong>Skip Reason:</strong> {selectedSampleToDelete.skipReason}</p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (selectedSampleToDelete) {
                  permanentDelete(selectedSampleToDelete.id);
                  setDeleteConfirmDialogOpen(false);
                  setSelectedSampleToDelete(null);
                }
              }}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
