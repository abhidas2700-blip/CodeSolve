import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Question {
  id: string;
  text: string;
  type: "text" | "dropdown" | "multiSelect" | "number" | "date" | "partner";
  options?: string;
  weightage: number;
  mandatory: boolean;
  isFatal: boolean;
  enableRemarks: boolean;
  grazingLogic: boolean;
  controlsSection?: boolean;
  visibleOnValues?: string[];
  controlledSectionId?: string;
  controlsVisibility?: boolean;
  controlledBy?: string | null;
  triggersRepetition?: boolean;
  repeatOnValues?: string[];
  isRepeatable?: boolean;
  repeatableGroup?: string;
}

interface Section {
  id: string;
  name: string;
  type?: 'agent' | 'questionnaire' | 'custom' | 'interaction';
  questions: Question[];
  controlledBy?: string;
  isRepeatable?: boolean;
  repeatableGroupId?: string;
  maxRepetitions?: number;
  repetitionIndex?: number;
}

interface AuditForm {
  id: string;
  name: string;
  sections: Section[];
}

interface ConditionalFormRendererProps {
  form: AuditForm;
  onAnswerChange?: (questionId: string, value: string) => void;
}

export default function ConditionalFormRenderer({ form, onAnswerChange }: ConditionalFormRendererProps) {
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [remarks, setRemarks] = useState<{[key: string]: string}>({});
  const [dynamicSections, setDynamicSections] = useState<Section[]>([]);

  // Fetch partners for partner dropdown
  const { data: partners = [], isLoading: partnersLoading, error: partnersError } = useQuery<any[]>({
    queryKey: ['/api/partners']
  });

  // Determine if a section should be visible based on controlling question answers
  const isSectionVisible = (section: Section): boolean => {
    if (!section.controlledBy) return true;
    
    // Find the controlling question across all sections
    const controllingQuestion = form.sections
      .flatMap(s => s.questions)
      .find(q => q.controlsSection && q.controlledSectionId === section.id);
    
    if (!controllingQuestion) {
      console.log(`No controlling question found for section ${section.id}`);
      return true;
    }
    
    const controllingAnswer = answers[controllingQuestion.id];
    const isVisible = controllingQuestion.visibleOnValues?.includes(controllingAnswer || '') ?? false;
    
    console.log(`Section ${section.name} visibility:`, {
      controllingQuestionId: controllingQuestion.id,
      controllingAnswer,
      visibleOnValues: controllingQuestion.visibleOnValues,
      isVisible
    });
    
    return isVisible;
  };

  // Determine if a question should be visible based on controlling question answers
  const isQuestionVisible = (question: Question, section: Section): boolean => {
    if (!question.controlledBy) return true;
    
    // Find the controlling question within the same section
    const controllingQuestion = section.questions.find(q => q.id === question.controlledBy);
    
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
  };

  // Handle answer changes
  const handleAnswerChange = (questionId: string, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    
    if (onAnswerChange) {
      onAnswerChange(questionId, value);
    }
    
    console.log('Answer changed:', { questionId, value, allAnswers: newAnswers });
    
    // Check if this answer triggers a repeatable section
    handleRepeatableSection(questionId, value);
  };
  
  // Handle repeatable section logic  
  const handleRepeatableSection = (questionId: string, value: string) => {
    // Find all sections and questions to check for repeatable triggers
    const allSections = [...form.sections, ...dynamicSections];
    
    for (const section of allSections) {
      for (const question of section.questions) {
        console.log('Checking question details:', {
          questionId: question.id,
          matchesId: question.id === questionId,
          questionText: question.text,
          matchesText: question.text === "Was there another interaction?",
          sectionName: section.name,
          isRepeatable: section.isRepeatable
        });
        
        if (question.id === questionId && question.text === "Was there another interaction?") {
          console.log('FOUND MATCHING INTERACTION QUESTION! Value:', value);
          
          if (value === "Yes") {
            // Check if next interaction section already exists
            const currentIndex = section.repetitionIndex || 1;
            const nextIndex = currentIndex + 1;
            const nextSectionExists = [...form.sections, ...dynamicSections].some(s => 
              s.repeatableGroupId === section.repeatableGroupId && s.repetitionIndex === nextIndex
            );
            
            console.log('Section creation check:', {
              currentIndex,
              nextIndex,
              nextSectionExists,
              sectionIsRepeatable: section.isRepeatable
            });
            
            if (!nextSectionExists) {
              console.log('Creating Interaction', nextIndex);
              createRepeatableSection(section);
            }
          } else if (value === "No") {
            // Remove all sections with higher index than current
            const currentIndex = section.repetitionIndex || 1;
            setDynamicSections(prev => prev.filter(s => 
              !(s.repeatableGroupId === section.repeatableGroupId && (s.repetitionIndex || 1) > currentIndex)
            ));
            console.log('Removed higher indexed interaction sections');
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
    console.log('Created new repeatable section:', newSection.name);
  };

  // Handle remarks changes
  const handleRemarksChange = (questionId: string, value: string) => {
    setRemarks({ ...remarks, [questionId]: value });
  };

  // Render a question input based on its type
  const renderQuestionInput = (question: Question) => {
    const value = answers[question.id] || '';
    
    switch (question.type) {
      case 'text':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your response..."
            className="min-h-[100px]"
          />
        );
      
      case 'dropdown':
        const options = question.options?.split(',') || [];
        return (
          <Select value={value} onValueChange={(value) => handleAnswerChange(question.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.trim()} value={option.trim()}>
                  {option.trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter a number"
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          />
        );
      
      case 'partner':
        return (
          <Select value={value} onValueChange={(value) => handleAnswerChange(question.id, value)}>
            <SelectTrigger data-testid={`input-partner-${question.id}`}>
              <SelectValue placeholder="Select partner..." />
            </SelectTrigger>
            <SelectContent>
              {partnersLoading ? (
                <SelectItem value="loading" disabled>Loading partners...</SelectItem>
              ) : partnersError ? (
                <SelectItem value="error" disabled>Error loading partners</SelectItem>
              ) : partners.length > 0 ? (
                partners.map((partner: any) => (
                  <SelectItem key={partner.id} value={partner.id.toString()}>
                    {partner.username}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>No partners available</SelectItem>
              )}
            </SelectContent>
          </Select>
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your response..."
          />
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {form.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Complete all visible sections. Some sections may appear or hide based on your answers.
        </p>
      </div>

      {[...form.sections, ...dynamicSections].map((section) => {
        const sectionVisible = isSectionVisible(section);
        
        if (!sectionVisible) {
          console.log(`Hiding section: ${section.name}`);
          return null;
        }
        
        // Filter questions based on visibility
        const visibleQuestions = section.questions.filter(question => isQuestionVisible(question, section));
        
        return (
          <Card key={section.id} className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">
                    {section.name}
                    {section.type === 'agent' && (
                      <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">
                        Agent Data
                      </Badge>
                    )}
                    {section.controlledBy && (
                      <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700">
                        Conditional Section
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {visibleQuestions.length} question{visibleQuestions.length !== 1 ? 's' : ''} visible
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {visibleQuestions.map((question, questionIndex) => {
                const isVisible = isQuestionVisible(question, section);
                
                if (!isVisible) {
                  return null;
                }
                
                return (
                  <div key={question.id} className="space-y-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label className="text-base font-medium text-gray-900 dark:text-white">
                          {questionIndex + 1}. {question.text}
                          {question.mandatory && <span className="text-red-500 ml-1">*</span>}
                          {question.isFatal && (
                            <Badge variant="destructive" className="ml-2">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Fatal
                            </Badge>
                          )}
                          {question.controlsSection && (
                            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
                              Controls Section
                            </Badge>
                          )}
                          {question.controlsVisibility && (
                            <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700">
                              Controls Questions
                            </Badge>
                          )}
                          {question.controlledBy && (
                            <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-700">
                              Conditional Question
                            </Badge>
                          )}
                        </Label>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {section.type !== 'agent' && question.weightage > 0 && (
                            <span>Weight: {question.weightage} points</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {renderQuestionInput(question)}
                      
                      {question.enableRemarks && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Remarks (Optional)
                          </Label>
                          <Textarea
                            value={remarks[question.id] || ''}
                            onChange={(e) => handleRemarksChange(question.id, e.target.value)}
                            placeholder="Add any additional comments..."
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {visibleQuestions.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No questions are currently visible in this section.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      
      <div className="flex justify-center pt-6">
        <Button className="px-8 py-3 text-lg">
          Submit Audit
        </Button>
      </div>
    </div>
  );
}