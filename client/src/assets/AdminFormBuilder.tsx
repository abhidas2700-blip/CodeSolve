import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";

interface Question {
  id: string;
  text: string;
  type: "text" | "dropdown" | "multiSelect" | "number" | "partner";
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

export default function AdminFormBuilder() {
  const [formName, setFormName] = useState("");
  const [sections, setSections] = useState<Section[]>([{ name: "Section A", questions: [] }]);
  const [activeTab, setActiveTab] = useState("Section A");
  const [newQuestion, setNewQuestion] = useState<Question>({
    id: Date.now().toString(),
    text: "",
    type: "dropdown",
    options: "Yes,No,N/A",
    weightage: 5,
    deductionPoints: 5,
    mandatory: true,
    isFatal: false,
    enableRemarks: false,
    grazingLogic: false,
    grazingPercentage: 50,
  });
  const [forms, setForms] = useState<AuditForm[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [editingForm, setEditingForm] = useState<AuditForm | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch partners for partner dropdown
  const { data: partners = [], isLoading: partnersLoading, error: partnersError } = useQuery({
    queryKey: ['/api/partners'],
    enabled: showPreview || newQuestion.type === 'partner'
  });

  // Check if the user is an admin
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('qa-current-user') || '{}');
      setIsAdmin(user.rights?.includes('admin') || false);
    } catch (error) {
      console.error("Error checking admin rights:", error);
      setIsAdmin(false);
    }
  }, []);

  // Load saved forms when component mounts
  useEffect(() => {
    const savedForms = localStorage.getItem('qa-audit-forms');
    if (savedForms) {
      try {
        setForms(JSON.parse(savedForms));
      } catch (e) {
        console.error("Error loading saved forms:", e);
      }
    }
  }, []);

  // Populate form fields when editing a form
  useEffect(() => {
    if (editingForm) {
      setFormName(editingForm.name);
      setSections(JSON.parse(JSON.stringify(editingForm.sections))); // Deep copy sections

      if (editingForm.sections.length > 0) {
        setActiveTab(editingForm.sections[0].name);
      }
    }
  }, [editingForm]);

  const addSection = () => {
    const newSectionName = `Section ${String.fromCharCode(65 + sections.length)}`;
    setSections([...sections, { name: newSectionName, questions: [] }]);
    setActiveTab(newSectionName);
  };

  const handleAddQuestion = () => {
    if (!newQuestion.text) return;

    const activeSection = sections.find(s => s.name === activeTab);
    if (!activeSection) return;

    const updatedSections = sections.map(section => {
      if (section.name === activeTab) {
        return {
          ...section,
          questions: [...section.questions, {...newQuestion, id: Date.now().toString()}]
        };
      }
      return section;
    });

    setSections(updatedSections);

    // Reset the form except for some fields that should persist
    setNewQuestion({
      id: Date.now().toString(),
      text: "",
      type: newQuestion.type,
      options: newQuestion.options,
      weightage: newQuestion.weightage,
      deductionPoints: newQuestion.deductionPoints,
      mandatory: newQuestion.mandatory,
      isFatal: false, // Always reset fatal flag
      enableRemarks: newQuestion.enableRemarks,
      grazingLogic: newQuestion.grazingLogic,
      grazingPercentage: newQuestion.grazingPercentage,
    });
  };

  const handleDeleteQuestion = (sectionIndex: number, questionIndex: number) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions.splice(questionIndex, 1);
    setSections(updatedSections);
  };

  const handleRenameSection = (oldName: string, newName: string) => {
    if (!newName.trim()) return;

    const updatedSections = sections.map(section => {
      if (section.name === oldName) {
        return { ...section, name: newName };
      }
      return section;
    });

    setSections(updatedSections);
    if (activeTab === oldName) {
      setActiveTab(newName);
    }
  };

  const handleDeleteSection = (sectionName: string) => {
    if (sections.length <= 1) {
      alert("You must have at least one section");
      return;
    }

    const updatedSections = sections.filter(s => s.name !== sectionName);
    setSections(updatedSections);

    if (activeTab === sectionName) {
      setActiveTab(updatedSections[0].name);
    }
  };

  const handleSaveForm = () => {
    if (!formName.trim()) {
      alert("Please enter a form name");
      return;
    }

    if (sections.some(section => section.questions.length === 0)) {
      alert("All sections must contain at least one question");
      return;
    }

    // Check if we're editing an existing form or creating a new one
    if (editingForm) {
      // Update existing form
      const updatedForms = forms.map(form =>
        form.name === editingForm.name
          ? {
              name: formName.trim(),
              sections: sections,
              createdAt: editingForm.createdAt
            }
          : form
      );

      setForms(updatedForms);
      localStorage.setItem('qa-audit-forms', JSON.stringify(updatedForms));
      alert(`Form "${formName}" updated successfully!`);

      // Update any relevant audit data that uses this form?
      // This would be more complex and might require updating submitted audits
      // For this implementation, we'll just note that audits using the old form version won't be updated
    } else {
      // Create new form
      const newForm = {
        name: formName.trim(),
        sections: sections,
        createdAt: new Date().toISOString()
      };

      const updatedForms = [...forms, newForm];
      setForms(updatedForms);
      localStorage.setItem('qa-audit-forms', JSON.stringify(updatedForms));
      alert(`Form "${formName}" saved successfully!`);
    }

    // Reset the form builder
    resetFormBuilder();
  };

  const resetFormBuilder = () => {
    setFormName("");
    setSections([{ name: "Section A", questions: [] }]);
    setActiveTab("Section A");
    setEditingForm(null);
    setShowPreview(false);
  };

  const handleEditForm = (form: AuditForm) => {
    if (!isAdmin) {
      alert("Only administrators can edit forms.");
      return;
    }

    setEditingForm(form);
    setShowPreview(false);
  };

  const handleCancelEdit = () => {
    if (window.confirm("Are you sure you want to cancel editing? All changes will be lost.")) {
      resetFormBuilder();
    }
  };

  // Calculate total possible score for the form
  const calculateTotalScore = () => {
    let total = 0;
    sections.forEach(section => {
      section.questions.forEach(question => {
        // Exclude partner questions from scoring calculation
        if (question.type !== "partner" && question.weightage > 0) {
          total += question.weightage;
        }
      });
    });
    return total;
  };

  const renderQuestionForm = () => (
    <div className="space-y-4 p-4 bg-white border rounded-lg shadow-sm">
      <h3 className="font-medium text-lg">Add New Parameter</h3>

      <div className="space-y-2">
        <Label htmlFor="questionText">Parameter Text</Label>
        <Textarea
          id="questionText"
          value={newQuestion.text}
          onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
          placeholder="Enter parameter text"
          className="min-h-20"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="questionType">Response Type</Label>
          <Select
            value={newQuestion.type}
            onValueChange={(value: "text" | "dropdown" | "multiSelect" | "number" | "partner") => {
              setNewQuestion({
                ...newQuestion,
                type: value,
                options: value === "dropdown" ? "Yes,No,N/A" : "",
                // For partner fields, set weightage to 0 and disable scoring
                weightage: value === "partner" ? 0 : newQuestion.weightage,
                deductionPoints: value === "partner" ? 0 : newQuestion.deductionPoints,
                isFatal: value === "partner" ? false : newQuestion.isFatal,
                grazingLogic: value === "partner" ? false : newQuestion.grazingLogic
              });
            }}
          >
            <SelectTrigger id="questionType">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dropdown">Dropdown</SelectItem>
              <SelectItem value="text">Text Input</SelectItem>
              <SelectItem value="multiSelect">Multi Select</SelectItem>
              <SelectItem value="number">Number Input</SelectItem>
              <SelectItem value="partner">Partner Dropdown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {newQuestion.type === "dropdown" && (
          <div className="space-y-2">
            <Label htmlFor="options">Options (comma-separated)</Label>
            <Input
              id="options"
              value={newQuestion.options}
              onChange={(e) => setNewQuestion({...newQuestion, options: e.target.value})}
              placeholder="Yes,No,N/A"
            />
          </div>
        )}

        {newQuestion.type === "partner" && (
          <div className="space-y-2">
            <Label>Partner Selection</Label>
            <div className="text-sm text-gray-500">
              This field will automatically populate with available partners from the system.
            </div>
          </div>
        )}

        {newQuestion.type !== "partner" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="weightage">Weightage (Points)</Label>
              <Input
                id="weightage"
                type="number"
                value={newQuestion.weightage.toString()}
                onChange={(e) => setNewQuestion({
                  ...newQuestion,
                  weightage: Number.parseInt(e.target.value) || 0
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deductionPoints">Deduction Points for "No"</Label>
              <Input
                id="deductionPoints"
                type="number"
                value={newQuestion.deductionPoints?.toString() || "0"}
                onChange={(e) => setNewQuestion({
                  ...newQuestion,
                  deductionPoints: Number.parseInt(e.target.value) || 0
                })}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col space-y-4">
        {newQuestion.type !== "partner" && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isFatal"
              checked={newQuestion.isFatal}
              onCheckedChange={(checked) => setNewQuestion({
                ...newQuestion,
                isFatal: checked === true
              })}
            />
            <Label htmlFor="isFatal" className="font-medium text-red-600">
              Fatal Parameter (selecting "Fatal" will set total score to zero)
            </Label>
            <div className="text-xs text-gray-500 ml-6">
              When this box is checked, the question will show a "Fatal" option. Selecting "Fatal" sets score to 0%.
              Selecting "No" will just deduct points based on weightage.
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Checkbox
            id="enableRemarks"
            checked={newQuestion.enableRemarks}
            onCheckedChange={(checked) => setNewQuestion({
              ...newQuestion,
              enableRemarks: checked === true
            })}
          />
          <Label htmlFor="enableRemarks">Enable Remarks Field (Why Yes/No/Fatal)</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="mandatory"
            checked={newQuestion.mandatory}
            onCheckedChange={(checked) => setNewQuestion({
              ...newQuestion,
              mandatory: checked === true
            })}
          />
          <Label htmlFor="mandatory">Mandatory Question</Label>
        </div>

        {newQuestion.type !== "partner" && (
          <div className="pt-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="grazingLogic"
                checked={newQuestion.grazingLogic}
                onCheckedChange={(checked) => setNewQuestion({
                  ...newQuestion,
                  grazingLogic: checked
                })}
              />
              <Label htmlFor="grazingLogic">Apply Grazing Logic for "No" Responses</Label>
            </div>

            {newQuestion.grazingLogic && (
              <div className="mt-2 ml-8 space-y-2">
                <Label htmlFor="grazingPercentage">Grazing Percentage</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="grazingPercentage"
                    type="number"
                    className="w-20"
                    min="1"
                    max="100"
                    value={newQuestion.grazingPercentage?.toString() || "50"}
                    onChange={(e) => setNewQuestion({
                      ...newQuestion,
                      grazingPercentage: Number.parseInt(e.target.value) || 50
                    })}
                  />
                  <span>%</span>
                </div>
                <p className="text-xs text-gray-500">
                  When "No" is selected, this percentage of points will be deducted instead of losing all points.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Button onClick={handleAddQuestion} className="w-full">
        Add Parameter
      </Button>
    </div>
  );

  const renderFormPreview = () => (
    <div className="p-4 bg-white border rounded-lg shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">Form Preview: {formName}</h3>
        <Button variant="outline" onClick={() => setShowPreview(false)}>
          Back to Editor
        </Button>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <h4 className="font-medium text-md border-b pb-2">{section.name}</h4>
            {section.questions.length > 0 ? (
              section.questions.map((question, qIdx) => (
                <div key={qIdx} className="p-3 border rounded-md">
                  <div className="font-medium">
                    {qIdx + 1}. {question.text}
                    {question.mandatory && <span className="text-red-500 ml-1">*</span>}
                    {question.isFatal && <span className="ml-2 text-xs text-red-500 font-normal">(Fatal)</span>}
                  </div>
                  
                  {question.type === "dropdown" && (
                    <div className="mt-2">
                      <Select disabled>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {question.options?.split(',').map((option, oIdx) => (
                            <SelectItem key={oIdx} value={option.trim()}>
                              {option.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {question.type === "partner" && (
                    <div className="mt-2">
                      <Select disabled>
                        <SelectTrigger className="w-60">
                          <SelectValue placeholder="Select Partner..." />
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
                      <div className="text-xs text-gray-500 mt-1">
                        Partner selection - does not affect scoring
                      </div>
                    </div>
                  )}
                  
                  {question.type === "text" && (
                    <div className="mt-2">
                      <Input disabled placeholder="Text response" />
                    </div>
                  )}
                  
                  {question.enableRemarks && (
                    <div className="mt-2">
                      <Label className="text-sm text-gray-500">Remarks</Label>
                      <Textarea
                        disabled
                        placeholder="Remarks will be entered here"
                        className="mt-1 min-h-[60px]"
                      />
                    </div>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-500 flex justify-between">
                    <span>Weightage: {question.weightage} points</span>
                    {question.grazingLogic && (
                      <span>Grazing: {question.grazingPercentage}% for "No"</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">No questions in this section</div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t flex justify-between items-center">
        <div>
          <span className="font-medium">Maximum Possible Score:</span> {calculateTotalScore()} points
        </div>
        <div>
          <span className="font-medium">Sections:</span> {sections.length}
        </div>
        <div>
          <span className="font-medium">Questions:</span> {sections.reduce((sum, s) => sum + s.questions.length, 0)}
        </div>
      </div>
    </div>
  );

  const renderFormsList = () => (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <h3 className="font-medium text-lg mb-4">Saved Forms</h3>
      
      {forms.length > 0 ? (
        <div className="space-y-4">
          {forms.map((form, idx) => (
            <div key={idx} className="p-3 border rounded-md flex justify-between items-center">
              <div>
                <h4 className="font-medium">{form.name}</h4>
                <div className="text-xs text-gray-500">
                  Created: {new Date(form.createdAt).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  Sections: {form.sections.length} | 
                  Questions: {form.sections.reduce((sum, s) => sum + s.questions.length, 0)}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditForm(form)}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          No forms have been created yet.
        </div>
      )}
    </div>
  );

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Audit Form Builder</h1>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <Input
            className="w-72"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Enter form name"
          />
        </div>
        
        <div className="flex space-x-2">
          {editingForm ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveForm}>
                Update Form
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={resetFormBuilder}>
                Clear
              </Button>
              <Button onClick={handleSaveForm}>
                Save as New Form
              </Button>
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {showPreview ? (
            renderFormPreview()
          ) : (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>
                  {editingForm ? `Editing: ${editingForm.name}` : "Create New Audit Form"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="flex justify-between items-center mb-4">
                    <TabsList className="mr-2">
                      {sections.map((section) => (
                        <TabsTrigger key={section.name} value={section.name}>
                          {section.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={addSection}>
                        Add Section
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                      >
                        Preview Form
                      </Button>
                    </div>
                  </div>
                  
                  {sections.map((section, sectionIndex) => (
                    <TabsContent key={section.name} value={section.name}>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`section-name-${sectionIndex}`}>Section Name:</Label>
                            <Input
                              id={`section-name-${sectionIndex}`}
                              value={section.name}
                              onChange={(e) => handleRenameSection(section.name, e.target.value)}
                              className="w-48"
                            />
                          </div>
                          
                          {sections.length > 1 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSection(section.name)}
                            >
                              Delete Section
                            </Button>
                          )}
                        </div>
                        
                        {section.questions.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="font-medium">Parameters in this Section</h3>
                            {section.questions.map((question, qIdx) => (
                              <div key={qIdx} className="p-3 border rounded-md">
                                <div className="flex justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {qIdx + 1}. {question.text}
                                      {question.mandatory && <span className="text-red-500 ml-1">*</span>}
                                      {question.isFatal && <span className="ml-2 text-xs text-red-500 font-normal">(Fatal)</span>}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      Type: {question.type} | 
                                      Points: {question.weightage}
                                      {question.grazingLogic && ` | Grazing: ${question.grazingPercentage}%`}
                                    </div>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteQuestion(sectionIndex, qIdx)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="pt-4 border-t">
                          {renderQuestionForm()}
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="lg:col-span-1">
          {renderFormsList()}
          
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Form Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium">Total Forms</div>
                    <div className="text-2xl font-bold">{forms.length}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium">Current Form</div>
                    <div className="text-lg font-bold">{formName || "Unnamed Form"}</div>
                    <div className="mt-2 text-sm">
                      <div>Sections: {sections.length}</div>
                      <div>Questions: {sections.reduce((sum, s) => sum + s.questions.length, 0)}</div>
                      <div>Maximum Score: {calculateTotalScore()}</div>
                    </div>
                  </div>
                  
                  <div className="pt-2 text-xs text-gray-500">
                    <p>
                      <span className="font-medium">Note:</span> Be sure to include a mix of mandatory and optional questions.
                    </p>
                    <p className="mt-1">
                      Fatal parameters offer a "Fatal" option that, when selected, will cause the entire audit to score 0%. 
                      When answered with "No", they only deduct points based on weightage.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}