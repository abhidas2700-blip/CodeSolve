import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define Label component since it isn't being imported properly
interface LabelProps {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

const Label = ({ htmlFor, className, children }: LabelProps) => (
  <label htmlFor={htmlFor} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ''}`}>
    {children}
  </label>
);

// Define interfaces for form data
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
}

interface Section {
  name: string;
  questions: Question[];
}

interface AuditForm {
  name: string;
  sections: Section[];
  createdAt: string;
}

interface Answer {
  questionId: string;
  answer: string;
  remarks?: string;
  questionText?: string;
  questionType?: string;
  isFatal?: boolean;
  weightage?: number;
  rating?: string | null;
}

interface SectionAnswers {
  sectionName: string;
  answers: Answer[];
}

interface SubmittedAudit {
  id: string;
  formName: string;
  agent: string;
  agentId: string;
  timestamp: number;
  sectionAnswers: SectionAnswers[];
  score: number;
  maxScore: number;
  hasFatal: boolean;
  status: 'completed' | 'draft';
}

export default function UserAuditPage() {
  const [availableForms, setAvailableForms] = useState<AuditForm[]>([]);
  const [selectedFormIndex, setSelectedFormIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [agentName, setAgentName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [submittedAudits, setSubmittedAudits] = useState<SubmittedAudit[]>([]);
  const [draftAudits, setDraftAudits] = useState<SubmittedAudit[]>([]);
  const [currentScore, setCurrentScore] = useState({ score: 0, maxScore: 0, hasFatal: false });
  const [showScore, setShowScore] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [dynamicSections, setDynamicSections] = useState<any[]>([]);

  // Load saved forms and submitted audits when component mounts
  useEffect(() => {
    loadForms();
    loadSubmittedAudits();
    loadDraftAudits();
  }, []);

  const loadForms = () => {
    const savedForms = localStorage.getItem('qa-audit-forms');
    if (savedForms) {
      try {
        const forms = JSON.parse(savedForms);
        setAvailableForms(forms);
        if (forms.length > 0 && selectedFormIndex === null) {
          setSelectedFormIndex(0);
          if (forms[0].sections.length > 0) {
            setActiveTab(forms[0].sections[0].name);
          }
        }
      } catch (e) {
        console.error("Error loading saved forms:", e);
      }
    }
  };

  const loadSubmittedAudits = () => {
    const savedAudits = localStorage.getItem('qa-submitted-audits');
    if (savedAudits) {
      try {
        const audits = JSON.parse(savedAudits);
        setSubmittedAudits(audits.filter((audit: SubmittedAudit) => audit.status === 'completed'));
      } catch (e) {
        console.error("Error loading submitted audits:", e);
      }
    }
  };

  const loadDraftAudits = () => {
    const draftAudits = localStorage.getItem('qa-draft-audits');
    if (draftAudits) {
      try {
        setDraftAudits(JSON.parse(draftAudits));
      } catch (e) {
        console.error("Error loading draft audits:", e);
      }
    }
  };

  // Update selected form and reset state when form changes
  useEffect(() => {
    if (selectedFormIndex !== null && availableForms[selectedFormIndex] && !editingDraftId) {
      const form = availableForms[selectedFormIndex];
      if (form.sections.length > 0) {
        setActiveTab(form.sections[0].name);
      }
      // Reset answers when changing forms
      setAnswers({});
      setShowScore(false);
    }
  }, [selectedFormIndex, availableForms, editingDraftId]);

  // Load draft data when editing a draft
  useEffect(() => {
    if (editingDraftId) {
      const draft = draftAudits.find(d => d.id === editingDraftId);
      if (draft) {
        // Find the form that matches this draft
        const formIndex = availableForms.findIndex(f => f.name === draft.formName);
        if (formIndex !== -1) {
          setSelectedFormIndex(formIndex);
          setAgentName(draft.agent);
          setAgentId(draft.agentId);

          // Convert draft answers format to local format
          const answersMap: Record<string, Answer> = {};
          draft.sectionAnswers.forEach(section => {
            section.answers.forEach(answer => {
              answersMap[answer.questionId] = answer;
            });
          });

          setAnswers(answersMap);

          if (availableForms[formIndex].sections.length > 0) {
            setActiveTab(availableForms[formIndex].sections[0].name);
          }
        }
      }
    }
  }, [editingDraftId, draftAudits, availableForms]);

  // Calculate current score based on answers
  useEffect(() => {
    if (selectedFormIndex === null) return;

    const form = availableForms[selectedFormIndex];
    let totalWeightage = 0;
    let deductedPoints = 0;
    let hasFatal = false;

    // Fixed maximum score for all audits
    const MAX_SCORE = 100;

    console.log("=== RECALCULATING SCORE IN USER AUDIT PAGE (NEW 100% DEDUCTION APPROACH) ===");
    console.log(`Total questions with answers: ${Object.keys(answers).length}`);
    
    // STEP 1: Calculate total weightage from all questions including dynamic sections
    // Get all sections including dynamic interaction sections
    const allSectionsForScore = [...form.sections];
    
    // Add dynamic sections based on answered questions
    const interactionSections = new Set<number>();
    Object.keys(answers).forEach(questionId => {
      if (questionId.includes('_repeat_')) {
        const parts = questionId.split('_repeat_');
        if (parts.length === 2) {
          const repeatIndex = parseInt(parts[1]);
          if (repeatIndex > 1) {
            interactionSections.add(repeatIndex);
          }
        }
      }
    });
    
    // Add dynamic sections for score calculation
    interactionSections.forEach(repeatIndex => {
      const templateSection = form.sections.find(s => s.isRepeatable);
      if (templateSection) {
        allSectionsForScore.push({
          ...templateSection,
          name: `Interaction ${repeatIndex}`,
          questions: templateSection.questions.map(q => ({
            ...q,
            id: `${q.id}_repeat_${repeatIndex}`
          }))
        });
      }
    });
    
    for (const section of allSectionsForScore) {
      for (const question of section.questions) {
        // Include all questions with weightage > 0
        if (question.weightage > 0) {
          totalWeightage += question.weightage;
          console.log(`Adding ${question.weightage} to total weightage for question: "${question.text}" in section: ${section.name}`);
        }
      }
    }
    
    console.log(`Total weightage from all questions (including dynamic sections): ${totalWeightage}`);
    
    // STEP 2: Process answers and calculate deductions
    for (const section of allSectionsForScore) {
      console.log(`Processing section: ${section.name} with ${section.questions.length} questions`);
      for (const question of section.questions) {
        // Skip text-only questions that don't affect score
        if (question.weightage <= 0) {
          console.log(`Skipping zero-weightage question: "${question.text}"`);
          continue;
        }

        // Get the answer for this question
        const answer = answers[question.id];
        if (!answer) {
          console.log(`No answer found for question: "${question.text}" (id: ${question.id})`);
          continue;
        }
        
        console.log(`Found answer: "${answer.answer}" for question: "${question.text}" (id: ${question.id})`);

        // PART 1: Check for fatal errors
        // Only "Fatal" answers on fatal questions should set hasFatal = true
        if (question.isFatal === true) {
          console.log(`****FOUND FATAL QUESTION****: "${question.text}" with answer "${answer.answer}"`);
          
          // If answer is specifically "Fatal", this is ALWAYS a fatal error (score = 0)
          if (answer.answer === 'Fatal') {
            console.log(`🚨 FATAL ERROR: Question "${question.text}" answered with "Fatal" - setting score to 0`);
            hasFatal = true;
            // Continue checking other questions but score will be 0
          }
          
          // For fatal questions with "No" answers, we only deduct points by the question's weightage
          if (answer.answer === 'No') {
            console.log(`ℹ️ Question "${question.text}" is fatal but answered with "No" - only deducting ${question.weightage} points by weightage`);
            deductedPoints += question.weightage;
          }
        }

        // PART 2: Calculate deductions for all non-fatal answers
        if (answer.answer === 'Yes' || answer.answer === 'NA') {
          // No deductions for Yes or NA answers
          console.log(`Question "${question.text}": No deduction for '${answer.answer}' answer`);
        } else if (answer.answer === 'No') {
          // For No answers: Deduct based on weightage
          // Apply grazing logic if configured
          if (question.grazingLogic && question.grazingPercentage) {
            // Apply partial deduction based on grazing percentage
            const deduction = question.weightage * (question.grazingPercentage / 100);
            deductedPoints += deduction;
            console.log(`Question "${question.text}": Deducting ${deduction.toFixed(2)} points for 'No' with grazing logic`);
          } else {
            // No grazing logic, deduct full weightage for No answers
            deductedPoints += question.weightage;
            console.log(`Question "${question.text}": Deducting exact ${question.weightage} points for 'No' answer`);
          }
        } else if (answer.answer === 'Fatal') {
          // Fatal answers lead to 0 score (handled by hasFatal flag)
          console.log(`Question "${question.text}": Fatal answer will result in 0 total score`);
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

    setCurrentScore({
      score: finalScore,
      maxScore: MAX_SCORE,
      hasFatal: hasFatal
    });
  }, [answers, selectedFormIndex, availableForms]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        answer: value,
        ...(prev[questionId] ? { remarks: prev[questionId].remarks } : {})
      }
    }));

    // Check if this answer triggers creating a new interaction section
    if (selectedFormIndex !== null && availableForms[selectedFormIndex]) {
      const form = availableForms[selectedFormIndex];
      const question = form.sections.flatMap(s => s.questions).find(q => q.id === questionId);
      
      console.log('🔍 DEBUG: Answer changed for question:', question?.text, 'Value:', value, 'Question ID:', questionId);
      
      if (question && question.text?.toLowerCase().includes('was there another interaction') && value.toLowerCase() === 'yes') {
        console.log('🔄 TRIGGER: Creating new interaction section triggered by question:', question.text);
        console.log('🔄 Current dynamic sections count:', dynamicSections.length);
        createNewInteractionSection();
      }
    }
  };

  const createNewInteractionSection = () => {
    if (selectedFormIndex === null) return;
    
    const form = availableForms[selectedFormIndex];
    console.log('🔍 All form sections:', form.sections.map(s => ({ name: s.name, isRepeatable: s.isRepeatable })));
    
    const interactionSection = form.sections.find(s => s.isRepeatable || s.name.toLowerCase().includes('interaction') || s.name.toLowerCase().includes('agent data'));
    
    if (!interactionSection) {
      console.warn('❌ No repeatable interaction section found in form sections');
      console.log('Available sections:', form.sections.map(s => s.name));
      return;
    }

    console.log('✅ Found interaction section template:', interactionSection.name);

    // Find the highest existing interaction number
    let maxInteractionNum = 1;
    const existingInteractionSections = dynamicSections.filter(s => s.name.toLowerCase().includes('interaction'));
    existingInteractionSections.forEach(section => {
      const match = section.name.match(/interaction\s*(\d+)/i);
      if (match) {
        maxInteractionNum = Math.max(maxInteractionNum, parseInt(match[1]));
      }
    });

    // Check for dynamic interactions in answers
    Object.keys(answers).forEach(questionId => {
      if (questionId.includes('_repeat_')) {
        const parts = questionId.split('_repeat_');
        if (parts.length === 2) {
          const repeatIndex = parseInt(parts[1]);
          maxInteractionNum = Math.max(maxInteractionNum, repeatIndex);
        }
      }
    });

    const newInteractionNum = maxInteractionNum + 1;
    const newSectionName = `Interaction ${newInteractionNum}`;

    // Create new section based on the template
    const newSection = {
      ...interactionSection,
      name: newSectionName,
      questions: interactionSection.questions.map((q: any) => ({
        ...q,
        id: `${q.id}_repeat_${newInteractionNum}`
      }))
    };

    console.log(`✅ CREATED: New section "${newSectionName}" with ${newSection.questions.length} questions`);
    console.log('📝 New section question IDs:', newSection.questions.map((q: any) => q.id));

    setDynamicSections(prev => {
      const updated = [...prev, newSection];
      console.log('📊 Updated dynamic sections count:', updated.length);
      return updated;
    });
    
    // Automatically switch to the new interaction tab
    console.log('🔄 Switching to tab:', newSectionName);
    setActiveTab(newSectionName);
  };

  const handleRemarksChange = (questionId: string, remarks: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        remarks
      }
    }));
  };

  const handleFormChange = (formName: string) => {
    const index = availableForms.findIndex(form => form.name === formName);
    if (index !== -1) {
      setSelectedFormIndex(index);
      setEditingDraftId(null);
    }
  };

  // Helper function to determine if a section should be visible based on controlling question answers
  const isSectionVisible = (section: any): boolean => {
    if (!section.controlledBy) return true;
    
    // Find the controlling question across all sections
    const form = availableForms[selectedFormIndex!];
    const controllingQuestion = form.sections
      .flatMap((s: any) => s.questions)
      .find((q: any) => q.controlsSection && q.controlledSectionId === section.id);
    
    if (!controllingQuestion) {
      return true;
    }
    
    const controllingAnswer = answers[controllingQuestion.id]?.answer;
    const isVisible = controllingQuestion.visibleOnValues?.includes(controllingAnswer || '') ?? false;
    
    console.log(`🔍 VALIDATION SECTION VISIBILITY CHECK: Section "${section.name}"`, {
      controlledBy: section.controlledBy,
      controllingQuestionId: controllingQuestion.id,
      controllingAnswer,
      visibleOnValues: controllingQuestion.visibleOnValues,
      isVisible
    });
    
    return isVisible;
  };

  // Helper function to determine if a question should be visible based on controlling question answers
  const isQuestionVisible = (question: any, section: any): boolean => {
    if (!question.controlledBy) return true;
    
    // Find the controlling question within the same section
    const controllingQuestion = section.questions.find((q: any) => q.id === question.controlledBy);
    
    if (!controllingQuestion) {
      return true;
    }
    
    const controllingAnswer = answers[controllingQuestion.id]?.answer;
    
    // Use the controlled question's visibleOnValues to determine visibility
    // This should match the rendering logic exactly
    const visibleValues = question.visibleOnValues?.split(',').map((v: string) => v.trim()) || [];
    const isVisible = visibleValues.includes(controllingAnswer || '');
    
    console.log(`🔍 VALIDATION VISIBILITY CHECK: Question "${question.text}"`, {
      controlledBy: question.controlledBy,
      controllingAnswer,
      visibleOnValues: visibleValues,
      isVisible
    });
    
    return isVisible;
  };

  const checkMandatoryQuestions = (): { isValid: boolean; missingQuestions: string[] } => {
    if (selectedFormIndex === null) {
      return { isValid: false, missingQuestions: [] };
    }

    const form = availableForms[selectedFormIndex];
    const missingQuestions: string[] = [];

    // Check all sections and questions, but only validate visible ones
    for (const section of form.sections) {
      // Skip entire section if it's not visible
      if (!isSectionVisible(section)) {
        console.log(`Skipping validation for hidden section: ${section.name}`);
        continue;
      }

      for (const question of section.questions) {
        // Skip question if it's not visible due to nested controlling logic
        if (!isQuestionVisible(question, section)) {
          console.log(`Skipping validation for hidden question: ${question.text}`);
          continue;
        }

        // Only check mandatory requirement for visible questions
        if (question.mandatory && (!answers[question.id] || !answers[question.id].answer)) {
          missingQuestions.push(`${question.text} (${question.id})`);
          console.log(`Missing mandatory visible question: ${question.text}`);
        }
      }
    }

    return {
      isValid: missingQuestions.length === 0,
      missingQuestions
    };
  };

  const prepareSectionAnswers = (): SectionAnswers[] => {
    if (selectedFormIndex === null) return [];

    const form = availableForms[selectedFormIndex];
    
    // Using the logic provided to create section answers
    const finalAnswers: SectionAnswers[] = [];
    
    // Process all sections: original form sections + any dynamic sections created during form filling
    const allSections = [...form.sections];
    
    // Add any dynamic sections that were created (like additional interactions)
    // Check if there are any dynamic sections stored in component state or context
    // For now, we'll check for additional interaction sections by looking for pattern in answers
    const interactionSectionNames = new Set<string>();
    
    // Analyze answers to identify which interaction sections have data
    Object.keys(answers).forEach(questionId => {
      if (questionId.includes('_repeat_')) {
        const parts = questionId.split('_repeat_');
        if (parts.length === 2) {
          const repeatIndex = parseInt(parts[1]);
          if (repeatIndex > 1) {
            // Find the original section name and create interaction section name
            const originalQuestionId = parts[0];
            const originalSection = form.sections.find(s => 
              s.questions.some(q => q.id === originalQuestionId)
            );
            if (originalSection) {
              interactionSectionNames.add(`Interaction ${repeatIndex}`);
            }
          }
        }
      }
    });
    
    // Add dynamic interaction sections
    interactionSectionNames.forEach(sectionName => {
      const repeatIndex = parseInt(sectionName.split(' ')[1]);
      const templateSection = form.sections.find(s => s.isRepeatable);
      
      if (templateSection) {
        allSections.push({
          ...templateSection,
          name: sectionName,
          questions: templateSection.questions.map(q => ({
            ...q,
            id: `${q.id}_repeat_${repeatIndex}`
          }))
        });
      }
    });
    
    console.log('🔍 AUDIT SUBMISSION DEBUG:');
    console.log('📊 Processing sections for final audit:', allSections.map(s => s.name));
    console.log('🔄 Detected interaction sections:', Array.from(interactionSectionNames));
    console.log('📝 All answer keys with _repeat_:', Object.keys(answers).filter(k => k.includes('_repeat_')));
    console.log('🎯 Current answers state:', Object.keys(answers));
    console.log('🔧 Dynamic sections in state:', dynamicSections.map(s => s.name));
    
    allSections.forEach(section => {
      const sectionAnswers: SectionAnswers = {
        sectionName: section.name,
        answers: []
      };
      
      section.questions.forEach(question => {
        // Get the user answer for this question (or null if not answered)
        const userAnswer = answers[question.id]?.answer || null;
        const userRemarks = answers[question.id]?.remarks || "";
        const userRating = answers[question.id]?.rating || null;
        
        sectionAnswers.answers.push({
          questionId: question.id,
          answer: userAnswer ? userAnswer : "Not Answered", // If blank, show Not Answered
          remarks: userRemarks,
          rating: userRating,
          questionText: question.text,
          questionType: question.type,
          isFatal: question.isFatal || false,
          weightage: question.weightage || 0
        });
      });
      
      finalAnswers.push(sectionAnswers);
    });
    
    return finalAnswers;
  };

  const createAuditRecord = (status: 'completed' | 'draft'): SubmittedAudit => {
    if (selectedFormIndex === null) {
      // This shouldn't happen due to previous checks, but just in case
      console.error("Trying to create audit record with no form selected");

      // Return a default empty record to avoid errors
      return {
        id: `AUD-${Date.now()}`,
        formName: "Unknown Form",
        agent: agentName,
        agentId: agentId,
        timestamp: Date.now(),
        sectionAnswers: [],
        score: 0,
        maxScore: 0,
        hasFatal: false,
        status: status
      };
    }

    const form = availableForms[selectedFormIndex];
    const sectionAnswers = prepareSectionAnswers();

    // Create the audit record with a status
    return {
      id: editingDraftId || `AUD-${Date.now()}`,
      formName: form.name,
      agent: agentName,
      agentId: agentId,
      timestamp: Date.now(),
      sectionAnswers: sectionAnswers,
      score: currentScore.score,
      maxScore: currentScore.maxScore,
      hasFatal: currentScore.hasFatal,
      status: status
    };
  };

  const saveAsDraft = () => {
    if (selectedFormIndex === null) {
      alert("Please select a form first");
      return;
    }

    if (!agentName.trim()) {
      alert("Please enter the agent name");
      return;
    }

    // Create the draft audit
    const draftAudit = createAuditRecord('draft');

    // Add or update in drafts
    let updatedDrafts: SubmittedAudit[];
    if (editingDraftId) {
      updatedDrafts = draftAudits.map(d =>
        d.id === editingDraftId ? draftAudit : d
      );
    } else {
      updatedDrafts = [draftAudit, ...draftAudits];
    }

    setDraftAudits(updatedDrafts);
    localStorage.setItem('qa-draft-audits', JSON.stringify(updatedDrafts));

    alert("Audit saved as draft. You can complete it later.");

    // Reset the form
    setAnswers({});
    setAgentName("");
    setAgentId("");
    setEditingDraftId(null);
    setShowScore(false);
  };

  const handleSkipSample = () => {
    if (selectedFormIndex === null) {
      alert("Please select a form first");
      return;
    }

    if (!agentName.trim()) {
      alert("Please enter the agent name");
      return;
    }

    if (!agentId.trim()) {
      alert("Please enter the agent ID");
      return;
    }

    // Open skip dialog
    setSkipDialogOpen(true);
  };
  
  const submitSkippedSample = () => {
    if (!skipReason.trim()) {
      alert("A reason is required to skip a sample.");
      return;
    }
    
    // Create a skipped sample record
    if (selectedFormIndex === null) return;
    
    const form = availableForms[selectedFormIndex];
    const skippedSample = {
      auditId: `SKIP-${Date.now()}`,
      formName: form.name,
      agent: agentName,
      agentId: agentId,
      auditor: 1, // This should be the current user's ID in a real app
      auditorName: 'Current Auditor', // This should be the current user's name
      reason: skipReason.trim(),
      timestamp: new Date().toISOString(),
      status: 'skipped'
    };

    // Send to the server
    fetch('/api/skipped-samples', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(skippedSample)
    })
    .then(response => {
      if (response.ok) {
        alert("Sample has been skipped successfully.");
        // Reset form
        setAnswers({});
        setAgentName("");
        setAgentId("");
        setEditingDraftId(null);
        setShowScore(false);
      } else {
        alert("Error skipping sample. Please try again.");
      }
    })
    .catch(error => {
      console.error("Error skipping sample:", error);
      alert("Error skipping sample. Please try again.");
    });
  };

  const handleSubmitAudit = () => {
    if (selectedFormIndex === null) {
      alert("Please select a form first");
      return;
    }

    if (!agentName.trim()) {
      alert("Please enter the agent name");
      return;
    }

    if (!agentId.trim()) {
      alert("Please enter the agent ID");
      return;
    }

    // Check if all mandatory questions are answered
    const { isValid, missingQuestions } = checkMandatoryQuestions();
    if (!isValid) {
      alert(`Please answer all mandatory questions before submitting. Missing: ${missingQuestions.join(", ")}`);
      return;
    }

    // Create the completed audit
    const newAudit = createAuditRecord('completed');

    // Add to submitted audits
    const updatedAudits = [newAudit, ...submittedAudits];
    setSubmittedAudits(updatedAudits);
    localStorage.setItem('qa-submitted-audits', JSON.stringify(updatedAudits));

    // If this was a draft, remove it from drafts
    if (editingDraftId) {
      const filteredDrafts = draftAudits.filter(d => d.id !== editingDraftId);
      setDraftAudits(filteredDrafts);
      localStorage.setItem('qa-draft-audits', JSON.stringify(filteredDrafts));
    }

    // Add to reports
    try {
      addToReports(newAudit);
      console.log("Report added successfully");
    } catch (error) {
      console.error("Error adding report:", error);
    }

    // Reset form without showing score
    setAnswers({});
    setAgentName("");
    setAgentId("");
    setEditingDraftId(null);

    // No longer showing the score, so don't need to set showScore to true

    alert(`Audit submitted successfully! ID: ${newAudit.id}`);
    resetForm(); // Call resetForm to prepare for a new audit
  };

  const addToReports = (audit: SubmittedAudit) => {
    if (selectedFormIndex === null) return;

    console.log("Adding audit to reports:", audit.id);

    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('qa-current-user') || '{}');
    const editorName = currentUser?.username || 'System';

    // Check if this report already exists
    const existingReports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
    const reportExists = existingReports.some((report: any) => report.auditId === audit.id);
    
    if (reportExists) {
      console.log(`Report for audit ${audit.id} already exists, skipping creation`);
      return;
    }

    // Create report data directly from audit with question text from sectionAnswers
    
    // CRITICAL: Double-check that fatal errors result in a score of 0
    // This ensures consistency between viewing and creating reports
    let hasFatalAnswer = false;
    
    // Check each section and question for a "Fatal" answer
    audit.sectionAnswers.forEach(section => {
      section.answers.forEach(answer => {
        if (answer.isFatal === true && answer.answer === "Fatal") {
          console.log("⚠️⚠️ FATAL ERROR DETECTED in answer when creating report:", section.sectionName, answer.questionText);
          hasFatalAnswer = true;
        }
      });
    });
    
    // Force score to 0 if fatal answer found
    const finalScore = hasFatalAnswer ? 0 : audit.score;
    console.log(`Setting final score for report ${audit.id}: ${finalScore}% (hasFatal: ${hasFatalAnswer})`);
    
    const reportData = {
      id: audit.id, // Use same ID as audit for better tracking
      auditId: audit.id,
      agent: audit.agent,
      auditor: editorName,
      formName: audit.formName,
      timestamp: audit.timestamp,
      score: finalScore, // Use the rechecked score to ensure fatal answers => 0
      answers: audit.sectionAnswers.map(section => ({
        section: section.sectionName,
        questions: section.answers.map(answer => ({
          text: answer.questionText || `Question ID: ${answer.questionId}`,
          answer: answer.answer,
          remarks: answer.remarks || '',
          rating: answer.rating || null,
          questionId: answer.questionId,
          questionType: answer.questionType,
          isFatal: answer.isFatal,
          weightage: answer.weightage
        }))
      })),
      editHistory: []
    };

    // Save to localStorage
    const reports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
    const updatedReports = [reportData, ...reports];
    localStorage.setItem('qa-reports', JSON.stringify(updatedReports));
    console.log("Report added to qa-reports successfully");

    // Also add to completed audits for better tracking
    const completedAudits = JSON.parse(localStorage.getItem('qa-completed-audits') || '[]');
    const auditExists = completedAudits.some((a: any) => a.id === audit.id);
    
    if (!auditExists) {
      const updatedCompletedAudits = [audit, ...completedAudits];
      localStorage.setItem('qa-completed-audits', JSON.stringify(updatedCompletedAudits));
      console.log("Audit added to qa-completed-audits successfully");
    }

    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('reportsUpdated'));
  };

  const resetForm = () => {
    setAnswers({});
    setAgentName("");
    setAgentId("");
    setEditingDraftId(null);
    setShowScore(false);
    setShowDrafts(false);
    setDynamicSections([]); // Clear dynamic sections when resetting
  };

  const handleSectionTabChange = (sectionName: string) => {
    setActiveTab(sectionName);
  };

  // Toggle between new audit and drafts
  const toggleDraftsView = () => {
    setShowDrafts(!showDrafts);
    setShowScore(false);
    if (showDrafts) {
      // Going back to new audit form, reset editingDraftId
      setEditingDraftId(null);
    }
  };

  const handleEditDraft = (draftId: string) => {
    setEditingDraftId(draftId);
    setShowDrafts(false);
  };

  const handleDeleteDraft = (draftId: string) => {
    if (window.confirm("Are you sure you want to delete this draft?")) {
      const updatedDrafts = draftAudits.filter(d => d.id !== draftId);
      setDraftAudits(updatedDrafts);
      localStorage.setItem('qa-draft-audits', JSON.stringify(updatedDrafts));
    }
  };

  const handleCalculateScore = () => {
    setShowScore(true);
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Quality Audit Form</h1>
      
      {/* Skip Sample Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip this Sample</DialogTitle>
            <DialogDescription>
              Please provide a reason for skipping this audit sample.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="skip-reason" className="mb-2 block">Reason for Skipping</Label>
            <Textarea 
              id="skip-reason"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Enter the reason for skipping this sample..."
              rows={4}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitSkippedSample}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle between New Audit and Drafts */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button
            variant={!showDrafts ? "default" : "outline"}
            onClick={() => { if (showDrafts) toggleDraftsView(); }}
            className="mr-2"
          >
            New Audit
          </Button>
          <Button
            variant={showDrafts ? "default" : "outline"}
            onClick={() => { if (!showDrafts) toggleDraftsView(); }}
          >
            Drafts ({draftAudits.length})
          </Button>
        </div>

        {!showDrafts && !editingDraftId && (
          <Button variant="outline" onClick={resetForm}>
            Reset Form
          </Button>
        )}
      </div>

      {showDrafts ? (
        // Drafts List
        <Card>
          <CardHeader>
            <CardTitle>Saved Draft Audits</CardTitle>
          </CardHeader>
          <CardContent>
            {draftAudits.length > 0 ? (
              <div className="space-y-4">
                {draftAudits.map(draft => (
                  <div key={draft.id} className="p-4 border rounded-lg flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{draft.formName}</h3>
                      <p className="text-sm text-gray-500">
                        Agent: {draft.agent} | Date: {new Date(draft.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditDraft(draft.id)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteDraft(draft.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No draft audits saved yet.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        // Audit Form
        <div>
          {availableForms.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <Label htmlFor="form-select" className="mb-2 block">Select Audit Form</Label>
                  <Select
                    value={selectedFormIndex !== null ? availableForms[selectedFormIndex]?.name : ""}
                    onValueChange={handleFormChange}
                    disabled={!!editingDraftId}
                  >
                    <SelectTrigger id="form-select">
                      <SelectValue placeholder="Select a form" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableForms.map((form, index) => (
                        <SelectItem key={index} value={form.name}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="agent-name" className="mb-2 block">Agent Name</Label>
                    <Input 
                      id="agent-name"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Enter agent name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="agent-id" className="mb-2 block">Agent ID</Label>
                    <Input 
                      id="agent-id"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      placeholder="Enter agent ID"
                    />
                  </div>
                </div>
              </div>

              {selectedFormIndex !== null && availableForms[selectedFormIndex] ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{availableForms[selectedFormIndex].name}</CardTitle>
                  </CardHeader>
                  
                  <CardContent>
                    <Tabs value={activeTab} onValueChange={handleSectionTabChange}>
                      <TabsList className="mb-4 flex flex-wrap">
                        {availableForms[selectedFormIndex].sections.map((section) => (
                          <TabsTrigger key={section.name} value={section.name}>
                            {section.name}
                          </TabsTrigger>
                        ))}
                        {dynamicSections.map((section) => (
                          <TabsTrigger 
                            key={section.name} 
                            value={section.name}
                            className="bg-blue-100 text-blue-800 border-blue-300"
                          >
                            {section.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      
                      {availableForms[selectedFormIndex].sections.map((section: any) => {
                        // Check if this section should be visible based on conditional logic
                        const shouldShowSection = () => {
                          if (!(section as any).controlsSection) return true;
                          
                          // Find the controlling question in any section
                          const controllingQuestion = availableForms[selectedFormIndex].sections
                            .flatMap(s => s.questions)
                            .find(q => q.id === (section as any).controlledSectionId);
                            
                          if (!controllingQuestion) return true;
                          
                          const controllingAnswer = answers[controllingQuestion.id]?.answer;
                          if (!controllingAnswer) return false;
                          
                          // Check if the answer matches any of the visible values
                          const visibleValues = (section as any).visibleOnValues?.split(',').map((v: string) => v.trim()) || [];
                          return visibleValues.includes(controllingAnswer);
                        };

                        if (!shouldShowSection()) return null;

                        return (
                        <TabsContent key={section.name} value={section.name}>
                          <div className="space-y-6">
                            {section.questions.map((question: any) => {
                              // Check if this question should be visible based on conditional logic
                              const shouldShowQuestion = () => {
                                // Check if this question is controlled by another question
                                if (question.controlledBy) {
                                  // Find the controlling question in the current section
                                  const controllingQuestion = section.questions.find((q: any) => q.id === question.controlledBy);
                                  if (!controllingQuestion) {
                                    console.log(`⚠️ VISIBILITY: Controlling question not found for "${question.text}"`);
                                    return true;
                                  }
                                  
                                  const controllingAnswer = answers[controllingQuestion.id]?.answer;
                                  console.log(`🔍 VISIBILITY CHECK: Question "${question.text}" controlled by "${controllingQuestion.text}"`);
                                  console.log(`🔍 Controlling answer: "${controllingAnswer}"`);
                                  
                                  if (!controllingAnswer) {
                                    console.log(`❌ VISIBILITY: No answer yet for controlling question - hiding "${question.text}"`);
                                    return false;
                                  }
                                  
                                  // Check if the answer matches any of the visible values
                                  const visibleValues = question.visibleOnValues?.split(',').map((v: string) => v.trim()) || [];
                                  console.log(`🔍 Visible on values: [${visibleValues.join(', ')}]`);
                                  const shouldShow = visibleValues.includes(controllingAnswer);
                                  console.log(`${shouldShow ? '✅' : '❌'} VISIBILITY: Question "${question.text}" should ${shouldShow ? 'show' : 'hide'}`);
                                  return shouldShow;
                                }
                                
                                return true; // Show by default if not controlled
                              };

                              if (!shouldShowQuestion()) {
                                console.log(`🚫 HIDING QUESTION: "${question.text}"`);
                                return null;
                              }

                              return (
                              <div key={question.id} className="p-4 border rounded-lg">
                                <div className="flex flex-col space-y-2">
                                  <Label className="text-base font-medium">
                                    {question.text}
                                    {question.mandatory && <span className="text-red-500 ml-1">*</span>}
                                    {question.isFatal && <span className="ml-2 text-xs text-red-500 font-normal">(Fatal)</span>}
                                  </Label>
                                  
                                  {question.type === "dropdown" && (
                                    <Select
                                      value={answers[question.id]?.answer || ""}
                                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                                    >
                                      <SelectTrigger className="w-40">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(() => {
                                          // Parse the original options
                                          let options = question.options?.split(',').map((o: string) => o.trim()) || [];
                                          
                                          console.log(`DROPDOWN OPTIONS for question "${question.text}": ${options.join(', ')}`);
                                          console.log(`Is fatal question: ${question.isFatal ? 'YES' : 'NO'}`);
                                          
                                          // For fatal questions, ensure "Fatal" is an option if it doesn't exist
                                          // We want Yes/No/Fatal for fatal questions
                                          if (question.isFatal === true) {
                                            // Check if Fatal option exists already
                                            if (!options.includes('Fatal')) {
                                              // Add Fatal as an option
                                              console.log(`🔴 ADDING FATAL OPTION to question: ${question.text}`);
                                              options = [...options, 'Fatal'];
                                            } else {
                                              console.log(`✅ Fatal option already exists for question: ${question.text}`);
                                            }
                                            
                                            console.log(`Final options for fatal question: ${options.join(', ')}`);
                                          }
                                          
                                          // Return the options as SelectItems
                                          return options.map((option: string, idx: number) => (
                                            <SelectItem key={idx} value={option}>
                                              {option}
                                            </SelectItem>
                                          ));
                                        })()}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  
                                  {question.type === "text" && (
                                    <Input
                                      value={answers[question.id]?.answer || ""}
                                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                      placeholder="Enter your answer"
                                    />
                                  )}
                                  
                                  {question.enableRemarks && (
                                    <div className="mt-2">
                                      <Label htmlFor={`remarks-${question.id}`} className="text-sm">Remarks</Label>
                                      <Textarea
                                        id={`remarks-${question.id}`}
                                        value={answers[question.id]?.remarks || ""}
                                        onChange={(e) => handleRemarksChange(question.id, e.target.value)}
                                        placeholder="Add remarks (optional)"
                                        className="min-h-[80px]"
                                      />
                                    </div>
                                  )}
                                  
                                  {question.grazingLogic && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      Grazing: {question.grazingPercentage}% point deduction for "No" answers
                                    </div>
                                  )}
                                  
                                  {question.weightage > 0 && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      Points: {question.weightage}
                                    </div>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </TabsContent>
                        );
                      })}
                      
                      {/* Render dynamic interaction sections */}
                      {dynamicSections.map((section: any) => (
                        <TabsContent key={section.name} value={section.name}>
                          <div className="space-y-6 border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                            <h2 className="font-bold text-xl mb-4 text-blue-800">
                              {section.name}
                            </h2>
                            {section.questions.map((question: any) => {
                              return (
                                <div key={question.id} className="p-4 border rounded-lg bg-white">
                                  <div className="flex flex-col space-y-2">
                                    <Label className="text-base font-medium">
                                      {question.text}
                                      {question.mandatory && <span className="text-red-500 ml-1">*</span>}
                                      {question.isFatal && <span className="ml-2 text-xs text-red-500 font-normal">(Fatal)</span>}
                                    </Label>
                                    
                                    {question.type === "dropdown" && (
                                      <Select
                                        value={answers[question.id]?.answer || ""}
                                        onValueChange={(value) => handleAnswerChange(question.id, value)}
                                      >
                                        <SelectTrigger className="w-40">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(() => {
                                            let options = question.options?.split(',').map((o: string) => o.trim()) || [];
                                            
                                            if (question.isFatal === true) {
                                              if (!options.includes('Fatal')) {
                                                options = [...options, 'Fatal'];
                                              }
                                            }
                                            
                                            return options.map((option: string, idx: number) => (
                                              <SelectItem key={idx} value={option}>
                                                {option}
                                              </SelectItem>
                                            ));
                                          })()}
                                        </SelectContent>
                                      </Select>
                                    )}
                                    
                                    {question.type === "text" && (
                                      <Input
                                        value={answers[question.id]?.answer || ""}
                                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                        placeholder="Enter your response..."
                                      />
                                    )}
                                    
                                    {question.type === "textarea" && (
                                      <Textarea
                                        value={answers[question.id]?.answer || ""}
                                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                        placeholder="Enter your response..."
                                        rows={3}
                                      />
                                    )}
                                    
                                    <div className="mt-2">
                                      <Label className="text-sm text-gray-600">Remarks (Optional)</Label>
                                      <Textarea
                                        value={answers[question.id]?.remarks || ""}
                                        onChange={(e) => {
                                          const current = answers[question.id] || { questionId: question.id, answer: "", remarks: "" };
                                          setAnswers(prev => ({
                                            ...prev,
                                            [question.id]: {
                                              ...current,
                                              remarks: e.target.value
                                            }
                                          }));
                                        }}
                                        placeholder="Add any additional comments..."
                                        rows={2}
                                        className="mt-1"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                  
                  <CardFooter className="flex justify-between">
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={saveAsDraft}>
                        Save as Draft
                      </Button>
                      <Button variant="outline" onClick={handleCalculateScore}>
                        Calculate Score
                      </Button>
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleSubmitAudit}>Submit Audit</Button>
                      <Button variant="outline" onClick={handleSkipSample} className="bg-amber-100 hover:bg-amber-200 text-amber-900">
                        Skip Sample
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {availableForms.length > 0 
                    ? "Please select a form to start" 
                    : "No audit forms available. Please create a form first."}
                </div>
              )}

              {/* Score Display */}
              {showScore && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Audit Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center">
                      <div className="text-4xl font-bold mb-2">
                        {currentScore.hasFatal 
                          ? "0%" 
                          : `${currentScore.score}%`}
                      </div>
                      
                      <div className="text-sm text-gray-500 mb-4">
                        {currentScore.hasFatal 
                          ? "Critical Error detected - automatic score of 0" 
                          : `Final score: ${currentScore.score}/100`}
                      </div>
                      
                      <div className={`text-sm px-3 py-1 rounded-full ${
                        currentScore.hasFatal 
                          ? "bg-red-100 text-red-800" 
                          : currentScore.score >= 80 
                            ? "bg-green-100 text-green-800" 
                            : currentScore.score >= 60 
                              ? "bg-yellow-100 text-yellow-800" 
                              : "bg-red-100 text-red-800"
                      }`}>
                        {currentScore.hasFatal 
                          ? "Critical Error" 
                          : currentScore.score >= 80 
                            ? "Excellent" 
                            : currentScore.score >= 60 
                              ? "Needs Improvement" 
                              : "Requires Attention"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">No Audit Forms Available</h3>
                  <p className="text-gray-500 mb-4">
                    You need to create audit forms before you can start auditing.
                  </p>
                  <p className="text-sm text-gray-500">
                    Ask an administrator to create audit forms using the Form Builder.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}