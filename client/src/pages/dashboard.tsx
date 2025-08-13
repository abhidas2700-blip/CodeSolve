import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit, Users, Activity, FileText, Clock, Award, BarChart, PieChart, User as UserIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import AccessControl from '@/components/AccessControl';

interface AuditSummary {
  id: string;
  agent: string;
  auditor?: string;
  form: string;
  score: number;
  date: number;
  status: 'completed' | 'pending' | 'critical';
}

interface FormPerformance {
  name: string;
  score: number;
}

interface AuditorPerformance {
  name: string;
  count: number;
  averageScore: number;
}

interface AgentPerformance {
  name: string;
  auditsReceived: number;
  averageScore: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalAudits: 0,
    averageScore: 0,
    pendingReviews: 0,
    formsCreated: 0,
    userAudits: 0,
    userAvgScore: 0,
  });
  const [recentAudits, setRecentAudits] = useState<AuditSummary[]>([]);
  const [formPerformance, setFormPerformance] = useState<FormPerformance[]>([]);
  const [auditorPerformance, setAuditorPerformance] = useState<AuditorPerformance[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);

  // Get user role for dashboard customization
  const getUserRole = (): string => {
    if (!user?.rights) return 'User';
    
    if (user.rights.includes('admin')) return 'Administrator';
    if (user.rights.includes('masterAuditor')) return 'Master Auditor';
    if (user.rights.includes('buildForm')) return 'Form Builder';
    if (user.rights.includes('audit') && user.rights.includes('createLowerUsers')) return 'Team Leader';
    if (user.rights.includes('reports') && user.rights.includes('dashboard') && user.rights.includes('createLowerUsers')) return 'Manager';
    if (user.rights.includes('audit')) return 'Auditor';
    
    return 'User';
  };

  const userRole = getUserRole();
  const isAuditor = user?.rights?.includes('audit') && !user?.rights?.includes('admin') && !user?.rights?.includes('createLowerUsers');
  const isAdmin = user?.rights?.includes('admin');
  const isManager = userRole === 'Manager' || userRole === 'Team Leader';

  useEffect(() => {
    // Load data from localStorage
    loadStats();
    loadRecentAudits();
    loadFormPerformance();
    loadAuditorPerformance();
    loadAgentPerformance();
  }, [user]);

  const loadStats = () => {
    const audits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
    const forms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
    
    // Calculate overall stats
    const totalAudits = audits.length;
    
    let avgScore = 0;
    if (totalAudits > 0) {
      avgScore = audits.reduce((sum: number, audit: any) => sum + (audit.score / audit.maxScore) * 100, 0) / totalAudits;
    }
    
    // Count pending reviews
    const pendingReviews = audits.filter((a: any) => a.status === 'pending').length;

    // Calculate user-specific stats for auditors
    let userAudits = 0;
    let userTotalScore = 0;

    if (isAuditor) {
      // Filter audits done by the current user
      const userAuditsList = audits.filter((audit: any) => 
        (audit.auditor && user?.username && audit.auditor.toLowerCase() === user.username.toLowerCase())
      );
      
      userAudits = userAuditsList.length;
      
      if (userAudits > 0) {
        userTotalScore = userAuditsList.reduce((sum: number, audit: any) => 
          sum + (audit.score / audit.maxScore) * 100, 0
        );
      }
    }
    
    setStats({
      totalAudits,
      averageScore: parseFloat(avgScore.toFixed(1)),
      pendingReviews,
      formsCreated: forms.length,
      userAudits,
      userAvgScore: userAudits > 0 ? parseFloat((userTotalScore / userAudits).toFixed(1)) : 0
    });
  };

  const loadRecentAudits = () => {
    const audits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
    
    // For auditors, only show their own audits
    // For admin/managers/team leaders, show all audits
    const filteredAudits = isAuditor && user?.username
      ? audits.filter((audit: any) => 
          (audit.auditor && audit.auditor.toLowerCase() === user.username.toLowerCase())
        )
      : audits;
    
    // Transform to summary format and sort by date (newest first)
    const summaries: AuditSummary[] = filteredAudits
      .map((audit: any) => {
        // Determine if this audit contains answers in the answers field or sectionAnswers field
        // Sometimes they're stored in different properties depending on where they came from
        const answersField = audit.answers ? 'answers' : (audit.sectionAnswers ? 'sectionAnswers' : null);
        
        // Create a copy for processing with properly mapped fields for consistency
        const processedAudit = {
          ...audit,
          sectionAnswers: answersField === 'answers' ? audit.answers : 
                         (answersField === 'sectionAnswers' ? audit.sectionAnswers : [])
        };
        
        return {
          id: audit.id,
          agent: audit.agent,
          auditor: audit.auditor,
          form: audit.formName,
          score: Math.round((audit.score / audit.maxScore) * 100),
          date: audit.timestamp,
          status: getAuditStatus(processedAudit),
        };
      })
      .sort((a: AuditSummary, b: AuditSummary) => b.date - a.date)
      .slice(0, 5); // Get only the 5 most recent
    
    setRecentAudits(summaries);
  };

  const getAuditStatus = (audit: any): 'completed' | 'pending' | 'critical' => {
    // Check for fatal questions marked with "Fatal" answer
    if (audit.hasFatal === true) return 'critical';
    
    // Double-check for fatal answers in case hasFatal flag wasn't properly set
    if (audit.sectionAnswers && Array.isArray(audit.sectionAnswers)) {
      for (const section of audit.sectionAnswers) {
        // Check for answers array (first format)
        if (section.answers && Array.isArray(section.answers)) {
          for (const answer of section.answers) {
            if (answer.isFatal === true && answer.answer === 'Fatal') {
              return 'critical';
            }
          }
        }
        
        // Check for questions array (second format)
        if (section.questions && Array.isArray(section.questions)) {
          for (const question of section.questions) {
            if (question.isFatal === true && question.answer === 'Fatal') {
              return 'critical';
            }
          }
        }
      }
    }
    
    // Also check the answers array directly for some audit formats
    if (audit.answers && Array.isArray(audit.answers)) {
      for (const section of audit.answers) {
        // Check for regular questions format
        if (section.questions && Array.isArray(section.questions)) {
          for (const question of section.questions) {
            if (question.isFatal === true && question.answer === 'Fatal') {
              return 'critical';
            }
          }
        }
      }
    }
    
    // Check for score below threshold
    const score = (audit.score / (audit.maxScore || 100)) * 100;
    if (score < 70) return 'critical';
    
    return 'completed';
  };

  const loadFormPerformance = () => {
    const audits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
    
    // For auditors, only analyze their own audits
    const filteredAudits = isAuditor && user?.username
      ? audits.filter((audit: any) => 
          (audit.auditor && audit.auditor.toLowerCase() === user.username.toLowerCase())
        )
      : audits;
    
    // Group audits by form name and calculate average scores
    const formScores: Record<string, number[]> = {};
    
    filteredAudits.forEach((audit: any) => {
      const formName = audit.formName;
      const score = (audit.score / audit.maxScore) * 100;
      
      if (!formScores[formName]) {
        formScores[formName] = [];
      }
      
      formScores[formName].push(score);
    });
    
    const performance = Object.entries(formScores).map(([name, scores]) => ({
      name,
      score: parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
    }));
    
    setFormPerformance(performance);
  };

  // Load performance metrics by auditor (for admin/managers)
  const loadAuditorPerformance = () => {
    if (!isAdmin && !isManager) return;

    const audits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
    
    // Group by auditor
    const auditorMetrics: Record<string, { counts: number, scores: number[] }> = {};
    
    audits.forEach((audit: any) => {
      if (!audit.auditor) return;
      
      const auditorName = audit.auditor;
      const score = (audit.score / audit.maxScore) * 100;
      
      if (!auditorMetrics[auditorName]) {
        auditorMetrics[auditorName] = { counts: 0, scores: [] };
      }
      
      auditorMetrics[auditorName].counts += 1;
      auditorMetrics[auditorName].scores.push(score);
    });
    
    const performance = Object.entries(auditorMetrics).map(([name, data]) => ({
      name,
      count: data.counts,
      averageScore: parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)),
    }));
    
    setAuditorPerformance(performance);
  };

  // Load performance metrics by agent (for admin/managers)
  const loadAgentPerformance = () => {
    if (!isAdmin && !isManager) return;

    const audits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
    
    // Group by agent
    const agentMetrics: Record<string, { counts: number, scores: number[] }> = {};
    
    audits.forEach((audit: any) => {
      if (!audit.agent) return;
      
      const agentName = audit.agent;
      const score = (audit.score / audit.maxScore) * 100;
      
      if (!agentMetrics[agentName]) {
        agentMetrics[agentName] = { counts: 0, scores: [] };
      }
      
      agentMetrics[agentName].counts += 1;
      agentMetrics[agentName].scores.push(score);
    });
    
    const performance = Object.entries(agentMetrics).map(([name, data]) => ({
      name,
      auditsReceived: data.counts,
      averageScore: parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)),
    }));
    
    setAgentPerformance(performance);
  };

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">
        <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">ThorEye</span> - Quality Assurance Dashboard
        {isAuditor && <span className="ml-2 text-md font-medium text-muted-foreground">({userRole} View)</span>}
      </h1>
      
      {/* Top stats cards - different views based on role */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* For regular auditors, show personal stats */}
        {isAuditor ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Your Audits</CardTitle>
                <Edit className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.userAudits}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.userAudits > 0 ? `${stats.userAudits} audits completed` : 'No audits completed yet'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Your Average Score</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.userAvgScore}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats.userAvgScore > 0 ? 'Based on your completed audits' : 'No scores available'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Average</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.averageScore}%</div>
                <p className="text-xs text-muted-foreground">
                  Overall team performance
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Forms Available</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.formsCreated}</div>
                <p className="text-xs text-muted-foreground">
                  Available for audit submissions
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          // For admin, managers, team leaders - show overall stats
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAudits}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalAudits > 0 ? '+12% from last month' : 'No audits completed yet'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.averageScore}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats.averageScore > 0 ? '+2.3% from last month' : 'No scores yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingReviews}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.pendingReviews > 0 ? `${stats.pendingReviews} awaiting review` : 'No pending reviews'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Forms Created</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.formsCreated}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.formsCreated > 0 ? '+1 new this week' : 'No forms created yet'}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main content area - tables, charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 mt-6">
        <div className="col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {isAuditor ? 'Your Recent Audits' : 'Recent Audits'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isAuditor ? 'Your latest audit submissions' : 'Overview of the latest audits performed'}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b transition-colors hover:bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Audit ID</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Agent</th>
                      {!isAuditor && (
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Auditor</th>
                      )}
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Form</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Score</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAudits.length > 0 ? (
                      recentAudits.map((audit) => (
                        <tr key={audit.id} className="border-b transition-colors hover:bg-muted/50">
                          <td className="p-4 align-middle">{audit.id}</td>
                          <td className="p-4 align-middle">{audit.agent}</td>
                          {!isAuditor && (
                            <td className="p-4 align-middle">{audit.auditor || 'Unknown'}</td>
                          )}
                          <td className="p-4 align-middle">{audit.form}</td>
                          <td className="p-4 align-middle">{audit.score}%</td>
                          <td className="p-4 align-middle">{formatDate(audit.date)}</td>
                          <td className="p-4 align-middle">
                            <Badge variant={audit.status === 'completed' ? 'active' : audit.status === 'pending' ? 'pending' : 'critical'}>
                              {audit.status === 'completed' ? 'Completed' : audit.status === 'pending' ? 'Under Review' : 'Needs Improvement'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isAuditor ? 6 : 7} className="p-4 text-center text-muted-foreground">
                          No audits have been completed yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Form</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isAuditor ? 'Your average scores by form type' : 'Overall average scores by form type'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {formPerformance.length > 0 ? (
                formPerformance.map((form) => (
                  <div key={form.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{form.name}</span>
                      <span className="text-sm font-medium">{form.score}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${form.score >= 80 ? 'bg-green-500' : form.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${form.score}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No audit data available for form performance metrics.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Management/Admin specific reports */}
      {(isAdmin || isManager) && (
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          {/* Auditor Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Auditor Performance</CardTitle>
              <p className="text-sm text-muted-foreground">Comparison of auditor productivity and scoring</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {auditorPerformance.length > 0 ? (
                  auditorPerformance.map((auditor) => (
                    <div key={auditor.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <UserIcon className="h-5 w-5 mr-2 text-muted-foreground" />
                          <span className="font-medium">{auditor.name}</span>
                        </div>
                        <span className="text-sm">{auditor.count} audits</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Average Score:</span>
                        <span className={`text-sm font-medium ${auditor.averageScore >= 80 ? 'text-green-500' : auditor.averageScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {auditor.averageScore}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${auditor.averageScore >= 80 ? 'bg-green-500' : auditor.averageScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${auditor.averageScore}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No auditor performance data available yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agent Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <p className="text-sm text-muted-foreground">Overview of agent quality scores</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {agentPerformance.length > 0 ? (
                  agentPerformance.map((agent) => (
                    <div key={agent.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <UserIcon className="h-5 w-5 mr-2 text-muted-foreground" />
                          <span className="font-medium">{agent.name}</span>
                        </div>
                        <span className="text-sm">{agent.auditsReceived} audits</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Average Score:</span>
                        <span className={`text-sm font-medium ${agent.averageScore >= 80 ? 'text-green-500' : agent.averageScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {agent.averageScore}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${agent.averageScore >= 80 ? 'bg-green-500' : agent.averageScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${agent.averageScore}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No agent performance data available yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
