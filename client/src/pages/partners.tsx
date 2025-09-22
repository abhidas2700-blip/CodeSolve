import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth-context';
import { CheckCircle, XCircle, MessageSquare, Eye, AlertTriangle, ThumbsUp } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";

// Type definitions
interface AuditReport {
  id: number;
  auditId: string;
  formName: string;
  agent: string;
  agentId: string;
  auditorName: string;
  partnerId?: number;
  partnerName?: string;
  score: number;
  maxScore: number;
  hasFatal: boolean;
  timestamp: string;
  status: string;
  sectionAnswers: any;
}

interface Rebuttal {
  id: number;
  auditReportId: number;
  partnerId: number;
  partnerName: string;
  rebuttalText: string;
  rebuttalType: 'rebuttal' | 're_rebuttal';
  status: 'pending' | 'accepted' | 'rejected';
  handledBy?: number;
  handledByName?: string;
  handlerResponse?: string;
  handledAt?: string;
  createdAt: string;
  updatedAt: string;
  auditReport?: AuditReport;
}

interface RebuttalAction {
  auditReportId: number;
  rebuttalText: string;
  action: 'accept' | 'reject' | 'rebuttal' | 're_rebuttal' | 'bod';
  handlerResponse?: string;
}

export default function Partners() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<AuditReport | null>(null);
  const [rebuttalText, setRebuttalText] = useState('');
  const [handlerResponse, setHandlerResponse] = useState('');
  const [activeTab, setActiveTab] = useState('all-reports');
  const [partners, setPartners] = useState<Array<{id: number, username: string}>>([]);

  // Fetch audit reports assigned to current partner
  const { data: assignedReports = [], isLoading: reportsLoading } = useQuery<AuditReport[]>({
    queryKey: ['/api/partners/reports'],
    enabled: !!user?.id,
  });

  // Fetch rebuttals for current partner
  const { data: rebuttals = [], isLoading: rebuttalsLoading } = useQuery<Rebuttal[]>({
    queryKey: ['/api/partners/rebuttals'],
    enabled: !!user?.id,
  });

  // Helper function to resolve partner ID to partner name
  const getPartnerNameById = (partnerId: string | number) => {
    const partner = partners.find(p => String(p.id) === String(partnerId));
    return partner ? partner.username : `Partner ${partnerId}`;
  };

  // Helper function to check if user has management rights
  const isManagement = () => {
    const rights = user?.rights as string[] | undefined;
    return rights?.includes('admin') || 
           rights?.includes('manager') || 
           rights?.includes('teamleader') ||
           rights?.includes('createLowerUsers');
  };

  // Helper function to check if user is partner only
  const isPartnerOnly = () => {
    const rights = user?.rights as string[] | undefined;
    return rights?.includes('partner') && !isManagement();
  };

  // Helper function to format section answers for display
  const formatSectionAnswers = (sectionAnswers: any) => {
    if (!sectionAnswers || typeof sectionAnswers !== 'object') return null;

    const sections = [];
    for (const [key, section] of Object.entries(sectionAnswers)) {
      if (section && typeof section === 'object' && (section as any).sectionName) {
        sections.push({
          name: (section as any).sectionName,
          questions: (section as any).answers || []
        });
      }
    }
    return sections;
  };

  // Fetch partners data
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/partners', {
          credentials: 'include'
        });
        if (response.ok) {
          const partnersData = await response.json();
          setPartners(partnersData);
        }
      } catch (error) {
        console.error('Error fetching partners:', error);
      }
    };
    
    fetchPartners();
  }, []);

  // Get the latest rebuttal for a report (for management actions)
  const getLatestRebuttal = (reportId: number) => {
    const reportRebuttals = rebuttals.filter(r => r.auditReportId === reportId);
    return reportRebuttals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  };

  // Mutation for creating/updating rebuttals
  const rebuttalMutation = useMutation({
    mutationFn: async (data: RebuttalAction) => {
      // Use action type alone to determine endpoint - let backend enforce permissions
      const isManagementAction = ['accept', 'reject', 'bod'].includes(data.action);
      
      if (isManagementAction) {
        // Management actions use PATCH endpoint - find rebuttal from all rebuttals
        const rebuttal = getLatestRebuttal(data.auditReportId);
        if (!rebuttal) {
          throw new Error('No rebuttal found for this report');
        }
        
        const response = await fetch(`/api/rebuttals/${rebuttal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            status: data.action === 'accept' ? 'accepted' : data.action === 'bod' ? 'accepted' : 'rejected',
            handledBy: user?.id,
            handledByName: user?.username,
            handlerResponse: data.rebuttalText || (data.action === 'bod' ? 'Benefit of Doubt applied' : '')
          }),
        });
        if (!response.ok) throw new Error('Failed to process rebuttal action');
        return response.json();
      } else {
        // Partner actions use POST endpoint
        const response = await fetch('/api/rebuttals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to process rebuttal action');
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partners/reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partners/rebuttals'] });
      setSelectedReport(null);
      setRebuttalText('');
      setHandlerResponse('');
      toast({ title: "Success", description: "Rebuttal action processed successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: `Failed to process rebuttal: ${error.message}`,
        variant: "destructive" 
      });
    }
  });

  // Helper functions to categorize reports based on audit report status
  const getAcceptedReports = () => {
    return assignedReports.filter(report => 
      report.status === 'accepted'
    );
  };

  const getRejectedReports = () => {
    return assignedReports.filter(report => 
      report.status === 'under_rebuttal'
    );
  };

  const getReRebuttalReports = () => {
    return assignedReports.filter(report => 
      report.status === 'rebuttal_rejected' || report.status === 'under_re_rebuttal'
    );
  };

  // Get rebuttal status for a report
  const getRebuttalStatus = (reportId: number) => {
    const rebuttal = getLatestRebuttal(reportId);
    return rebuttal?.status || 'none';
  };

  // Get rebuttal type for a report
  const getRebuttalType = (reportId: number) => {
    const rebuttal = getLatestRebuttal(reportId);
    return rebuttal?.rebuttalType || null;
  };

  // Get rebuttal handler information
  const getRebuttalHandler = (reportId: number) => {
    const rebuttal = getLatestRebuttal(reportId);
    if (!rebuttal || !rebuttal.handledByName) return null;
    
    return {
      handledBy: rebuttal.handledByName,
      handledAt: rebuttal.handledAt,
      status: rebuttal.status
    };
  };

  // Get formatted handler text
  const getHandlerText = (reportId: number) => {
    const handler = getRebuttalHandler(reportId);
    console.log(`🔍 Handler info for report ${reportId}:`, handler);
    if (!handler) return null;
    
    if (handler.status === 'accepted') {
      return `Accepted by ${handler.handledBy}`;
    } else if (handler.status === 'rejected') {
      return `Rejected by ${handler.handledBy}`;
    }
    return null;
  };

  // Handle rebuttal actions
  const handleAccept = (report: AuditReport) => {
    rebuttalMutation.mutate({
      auditReportId: report.id,
      rebuttalText: '',
      action: 'accept'
    });
  };

  const handleReject = (report: AuditReport) => {
    if (!rebuttalText.trim()) {
      toast({ 
        title: "Error", 
        description: "Please provide a reason for the rebuttal",
        variant: "destructive" 
      });
      return;
    }
    
    // Check if this is a management user (for UI context)
    const rights = user?.rights as string[] | undefined;
    const isManagementUser = rights?.includes('admin') || 
                            rights?.includes('manager') || 
                            rights?.includes('teamleader');
    
    let action: 'rebuttal' | 're_rebuttal' | 'reject';
    
    if (isManagementUser) {
      // Management users always use 'reject' action for consistency
      action = 'reject';
    } else {
      // Partner users: determine action based on report status
      if (report.status === 'completed' || !report.status) {
        action = 'rebuttal';
      } else if (report.status === 'rebuttal_rejected') {
        action = 're_rebuttal';
      } else {
        // Partners should not reach the reject action for unexpected statuses
        toast({ 
          title: "Error", 
          description: "Invalid action for current report status",
          variant: "destructive" 
        });
        return;
      }
    }
    
    rebuttalMutation.mutate({
      auditReportId: report.id,
      rebuttalText,
      action
    });
  };

  const handleBOD = (report: AuditReport) => {
    rebuttalMutation.mutate({
      auditReportId: report.id,
      rebuttalText: 'Benefit of Doubt applied',
      action: 'bod'
    });
  };

  // Render report card
  const renderReportCard = (report: AuditReport, showActions: boolean = true) => {
    const rebuttalStatus = getRebuttalStatus(report.id);
    const rebuttalType = getRebuttalType(report.id);
    const rebuttal = rebuttals.find(r => r.auditReportId === report.id);
    const isReRebuttal = rebuttalType === 're_rebuttal';

    return (
      <Card key={report.id} className="mb-4">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{report.formName}</CardTitle>
              <p className="text-sm text-gray-600">
                Agent: {report.agent} | Auditor: {report.auditorName}
              </p>
              <p className="text-sm text-gray-500">
                Audit ID: {report.auditId} | Date: {new Date(report.timestamp).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <Badge variant={report.hasFatal ? "destructive" : report.score >= 80 ? "default" : "secondary"}>
                Score: {report.score}%
              </Badge>
              {rebuttalStatus !== 'none' && (
                <div className="flex flex-col items-end space-y-1">
                  <Badge variant={
                    rebuttalStatus === 'accepted' ? 'default' : 
                    rebuttalStatus === 'rejected' ? 'destructive' : 'secondary'
                  }>
                    {rebuttalStatus === 'pending' ? 'Pending Review' : 
                     rebuttalStatus === 'accepted' ? 'Accepted' : 'Rejected'}
                  </Badge>
                  {getHandlerText(report.id) && (
                    <span className="text-xs text-gray-500">
                      {getHandlerText(report.id)}
                    </span>
                  )}
                </div>
              )}
              {isReRebuttal && (
                <Badge variant="outline">Re-Rebuttal</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {rebuttal && rebuttal.rebuttalText && (
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <p className="text-sm font-medium text-blue-900">Your Rebuttal:</p>
              <p className="text-sm text-blue-800">{rebuttal.rebuttalText}</p>
            </div>
          )}
          
          {rebuttal && rebuttal.handlerResponse && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium text-gray-900">
                Admin Response ({rebuttal.handledByName}):
              </p>
              <p className="text-sm text-gray-800">{rebuttal.handlerResponse}</p>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-view-details-${report.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Audit Report Details</DialogTitle>
                  <DialogDescription>
                    Detailed view of audit report for {report.agent}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Form:</strong> {report.formName}</p>
                      <p><strong>Agent:</strong> {report.agent}</p>
                      <p><strong>Auditor:</strong> {report.auditorName}</p>
                    </div>
                    <div>
                      <p><strong>Score:</strong> {report.score}% ({report.score}/{report.maxScore})</p>
                      <p><strong>Fatal Errors:</strong> {report.hasFatal ? 'Yes' : 'No'}</p>
                      <p><strong>Date:</strong> {new Date(report.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  {report.sectionAnswers && (
                    <div>
                      <h4 className="font-medium mb-4">Audit Details:</h4>
                      {formatSectionAnswers(report.sectionAnswers)?.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-blue-50 px-4 py-3 border-b">
                            <h5 className="font-semibold text-blue-900">{section.name}</h5>
                          </div>
                          <div className="p-4 space-y-4">
                            {section.questions?.map((question: any, questionIndex: number) => (
                              <div key={questionIndex} className="grid grid-cols-1 gap-2">
                                {/* Question */}
                                <div className="bg-white p-3 rounded border border-gray-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="text-sm text-gray-500 font-semibold">Question:</span>
                                      <div className="font-medium mt-1">{question.questionText}</div>
                                    </div>
                                    {question.questionType && (
                                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                                        Type: {question.questionType}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Answer */}
                                <div className="bg-white p-3 rounded border border-gray-200">
                                  <span className="text-sm text-gray-500 font-semibold">Auditor's Response:</span>
                                  <div className="font-medium mt-1 flex items-center">
                                    <span className={`inline-flex px-3 py-1 ${
                                      question.answer === 'Yes' ? 'bg-green-100 text-green-800' : 
                                      question.answer === 'No' ? 'bg-red-100 text-red-800' : 
                                      question.answer === 'N/A' || question.answer === 'NA' ? 'bg-gray-100 text-gray-800' : 
                                      question.answer === 'Fatal' ? 'bg-red-100 text-red-800 font-bold' :
                                      'bg-blue-100 text-blue-800'
                                    } rounded-full font-medium`}>
                                      {question.questionType === 'partner' ? getPartnerNameById(question.answer) : question.answer}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            {showActions && (
              <div className="flex space-x-2">
                {/* Actions for new/completed reports */}
                {(report.status === 'completed' || !report.status) && (
                  <>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleAccept(report)}
                      disabled={rebuttalMutation.isPending}
                      data-testid={`button-accept-${report.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => setSelectedReport(report)}
                          data-testid={`button-reject-${report.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Raise Rebuttal</DialogTitle>
                          <DialogDescription>
                            Please provide your reason for raising a rebuttal for this audit report.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Enter your rebuttal reason..."
                          value={rebuttalText}
                          onChange={(e) => setRebuttalText(e.target.value)}
                          rows={4}
                          data-testid={`textarea-rebuttal-${report.id}`}
                        />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setSelectedReport(null)} data-testid={`button-cancel-rebuttal-${report.id}`}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleReject(report)}
                            disabled={rebuttalMutation.isPending}
                            data-testid={`button-submit-rebuttal-${report.id}`}
                          >
                            Submit Rebuttal
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
                
                {/* Actions for under rebuttal reports */}
                {report.status === 'under_rebuttal' && (
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleAccept(report)}
                      disabled={rebuttalMutation.isPending}
                      data-testid={`button-accept-rejected-${report.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleBOD(report)}
                      disabled={rebuttalMutation.isPending}
                      data-testid={`button-bod-${report.id}`}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      BOD
                    </Button>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => setSelectedReport(report)}
                          data-testid={`button-re-rebuttal-${report.id}`}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Re-Rebuttal
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Raise Re-Rebuttal</DialogTitle>
                          <DialogDescription>
                            Please provide your reason for raising a re-rebuttal for this audit report.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Enter your re-rebuttal reason..."
                          value={rebuttalText}
                          onChange={(e) => setRebuttalText(e.target.value)}
                          rows={4}
                          data-testid={`textarea-re-rebuttal-${report.id}`}
                        />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setSelectedReport(null)} data-testid={`button-cancel-re-rebuttal-${report.id}`}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleReject(report)}
                            disabled={rebuttalMutation.isPending}
                            data-testid={`button-submit-re-rebuttal-${report.id}`}
                          >
                            Submit Re-Rebuttal
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
                
                {/* Actions for rebuttal rejected reports */}
                {report.status === 'rebuttal_rejected' && (
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleAccept(report)}
                      disabled={rebuttalMutation.isPending}
                      data-testid={`button-accept-re-rebuttal-${report.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleBOD(report)}
                      disabled={rebuttalMutation.isPending}
                      data-testid={`button-bod-re-rebuttal-${report.id}`}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      BOD
                    </Button>
                  </div>
                )}
                
                {/* Actions for re-rebuttal reports (accept and BOD only) */}
                {report.status === 'under_re_rebuttal' && (
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleAccept(report)}
                      disabled={rebuttalMutation.isPending}
                      data-testid={`button-accept-final-${report.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleBOD(report)}
                      disabled={rebuttalMutation.isPending}
                      data-testid={`button-bod-final-${report.id}`}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      BOD
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!user) {
    return <div>Please log in to access the rebuttal dashboard.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Rebuttal Management</h1>
        <p className="text-gray-600">
          Welcome, {user.username}. Review and manage audit report rebuttals.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all-reports">All Reports</TabsTrigger>
          <TabsTrigger value="accepted">Accepted Reports</TabsTrigger>
          <TabsTrigger value="rejected">Rebuttal Rejected Reports</TabsTrigger>
          <TabsTrigger value="re-rebuttal">Re-Rebuttal Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="all-reports" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Assigned Reports</CardTitle>
              <p className="text-sm text-gray-600">
                All audit reports available for rebuttal review and management
              </p>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="text-gray-500">Loading reports...</div>
                </div>
              ) : assignedReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No audit reports available for rebuttal review.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedReports.map(report => renderReportCard(report, true))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accepted" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Accepted Reports</CardTitle>
              <p className="text-sm text-gray-600">
                Reports that you have accepted or have not yet reviewed
              </p>
            </CardHeader>
            <CardContent>
              {getAcceptedReports().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No accepted reports.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getAcceptedReports().map(report => renderReportCard(report, false))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Rebuttal Rejected Reports</CardTitle>
              <p className="text-sm text-gray-600">
                Reports that you have raised rebuttals for or that have been rejected by admin
              </p>
            </CardHeader>
            <CardContent>
              {getRejectedReports().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No rejected reports.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getRejectedReports().map(report => renderReportCard(report, true))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="re-rebuttal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Re-Rebuttal Reports</CardTitle>
              <p className="text-sm text-gray-600">
                Reports in the re-rebuttal phase - only accept or BOD options available
              </p>
            </CardHeader>
            <CardContent>
              {getReRebuttalReports().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No re-rebuttal reports.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getReRebuttalReports().map(report => renderReportCard(report, true))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}