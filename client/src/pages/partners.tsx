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

  // Mutation for creating/updating rebuttals
  const rebuttalMutation = useMutation({
    mutationFn: async (data: RebuttalAction) => {
      const response = await fetch('/api/rebuttals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to process rebuttal action');
      return response.json();
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
    const rebuttal = rebuttals.find(r => r.auditReportId === reportId);
    return rebuttal?.status || 'none';
  };

  // Get rebuttal type for a report
  const getRebuttalType = (reportId: number) => {
    const rebuttal = rebuttals.find(r => r.auditReportId === reportId);
    return rebuttal?.rebuttalType || null;
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
    
    // Determine action based on authoritative report status
    let action: string;
    if (report.status === 'completed' || !report.status) {
      action = 'rebuttal';
    } else if (report.status === 'rebuttal_rejected') {
      action = 're_rebuttal';
    } else {
      toast({ 
        title: "Error", 
        description: "Invalid action for current report status",
        variant: "destructive" 
      });
      return;
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
                <Badge variant={
                  rebuttalStatus === 'accepted' ? 'default' : 
                  rebuttalStatus === 'rejected' ? 'destructive' : 'secondary'
                }>
                  {rebuttalStatus === 'pending' ? 'Pending Review' : 
                   rebuttalStatus === 'accepted' ? 'Accepted' : 'Rejected'}
                </Badge>
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
                      <h4 className="font-medium mb-2">Audit Details:</h4>
                      <pre className="bg-gray-100 p-3 rounded text-sm max-h-64 overflow-y-auto">
                        {JSON.stringify(report.sectionAnswers, null, 2)}
                      </pre>
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
    return <div>Please log in to access the partner dashboard.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Partner Dashboard</h1>
        <p className="text-gray-600">
          Welcome, {user.username}. Manage your assigned audit reports and rebuttals.
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
                All audit reports where you have been selected as the partner
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
                  <p>No audit reports assigned to you yet.</p>
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