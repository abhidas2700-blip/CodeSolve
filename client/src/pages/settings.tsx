import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, Trash2 } from 'lucide-react';
import { ClearDataButton } from '@/components/ClearDataButton';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [auditReminders, setAuditReminders] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [theme, setTheme] = useState('light');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [language, setLanguage] = useState('en');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Password change states
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Sessions states
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [isTerminatingSession, setIsTerminatingSession] = useState(false);
  const [isTerminatingAllSessions, setIsTerminatingAllSessions] = useState(false);

  const handleSaveSettings = () => {
    setIsSubmitting(true);
    
    // In a real app, this would make an API call to save settings
    setTimeout(() => {
      setIsSubmitting(false);
      
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    }, 1000);
  };

  const handleResetSettings = () => {
    setEmailNotifications(true);
    setAuditReminders(true);
    setCriticalAlerts(true);
    setWeeklyReports(false);
    setTheme('light');
    setDateFormat('MM/DD/YYYY');
    setLanguage('en');
    
    toast({
      title: "Settings Reset",
      description: "Your preferences have been reset to default values.",
    });
  };
  
  // Session management functions
  const loadSessions = async () => {
    setIsLoadingSessions(true);
    setSessionError('');
    
    try {
      const response = await fetch('/api/sessions', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch sessions');
      }
      
      const sessionsData = await response.json();
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  };
  
  const terminateSession = async (sessionId: string) => {
    // Skip if this is an offline session
    if (sessionId.startsWith('offline-')) {
      toast({
        title: "Cannot Terminate",
        description: "This user doesn't have an active session to terminate.",
        variant: "destructive"
      });
      return;
    }
    
    setIsTerminatingSession(true);
    setSessionError('');
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to terminate session');
      }
      
      // Refresh the sessions list
      await loadSessions();
      
      toast({
        title: "Session Terminated",
        description: "The session has been successfully terminated.",
      });
    } catch (error) {
      console.error('Error terminating session:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to terminate session');
    } finally {
      setIsTerminatingSession(false);
    }
  };
  
  const terminateAllOtherSessions = async () => {
    if (!user || !user.id) return;
    
    // Filter only active sessions (not offline placeholder sessions)
    const activeSessions = sessions.filter(
      s => !s.isCurrentSession && !s.id.startsWith('offline-')
    );
    
    if (activeSessions.length === 0) {
      toast({
        title: "No Active Sessions",
        description: "There are no other active sessions to terminate.",
      });
      return;
    }
    
    setIsTerminatingAllSessions(true);
    setSessionError('');
    
    try {
      const response = await fetch(`/api/sessions/user/${user.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to terminate sessions');
      }
      
      const result = await response.json();
      
      // Refresh the sessions list
      await loadSessions();
      
      toast({
        title: "Sessions Terminated",
        description: result.message || `${result.sessionsDeleted} active sessions terminated successfully.`,
      });
    } catch (error) {
      console.error('Error terminating all sessions:', error);
      setSessionError(error instanceof Error ? error.message : 'Failed to terminate all sessions');
    } finally {
      setIsTerminatingAllSessions(false);
    }
  };
  
  // Load sessions when dialog opens
  useEffect(() => {
    if (showSessionsDialog && user?.rights?.includes('admin')) {
      loadSessions();
    }
  }, [showSessionsDialog, user]);

  const handleOpenChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowChangePasswordDialog(true);
  };
  
  const handleChangePassword = async () => {
    try {
      // Form validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError('Please fill in all password fields');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        setPasswordError('New password and confirmation do not match');
        return;
      }
      
      if (newPassword.length < 6) {
        setPasswordError('Password must be at least 6 characters long');
        return;
      }
      
      if (!user || !user.id) {
        setPasswordError('You must be logged in to change your password');
        return;
      }
      
      // Call backend API to change password
      const response = await fetch(`/api/users/password/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPassword: currentPassword,
          newPassword: newPassword
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setPasswordError(data.error || 'Failed to change password');
        return;
      }
      
      // Close dialog and show success notification
      setShowChangePasswordDialog(false);
      
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
      
      // Reset form values
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('An unexpected error occurred. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <h2 className="text-lg font-medium">Not Logged In</h2>
              <p className="mt-2 text-muted-foreground">
                Please log in to access settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Control how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications" className="font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="audit-reminders" className="font-medium">Audit Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get reminders about pending audits
                  </p>
                </div>
                <Switch
                  id="audit-reminders"
                  checked={auditReminders}
                  onCheckedChange={setAuditReminders}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="critical-alerts" className="font-medium">Critical Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for critical audit issues
                  </p>
                </div>
                <Switch
                  id="critical-alerts"
                  checked={criticalAlerts}
                  onCheckedChange={setCriticalAlerts}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="weekly-reports" className="font-medium">Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly summary reports
                  </p>
                </div>
                <Switch
                  id="weekly-reports"
                  checked={weeklyReports}
                  onCheckedChange={setWeeklyReports}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Password</Label>
                  <p className="text-sm text-muted-foreground">
                    Change your account password
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenChangePassword}>
                  Change Password
                </Button>
              </div>
            
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable two-factor authentication for added security
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Setup 2FA
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Session Management</Label>
                  <p className="text-sm text-muted-foreground">
                    Manage your active sessions across devices
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowSessionsDialog(true)}>
                  View Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance and Localization</CardTitle>
              <CardDescription>
                Customize your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger id="date-format">
                    <SelectValue placeholder="Select a date format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Data and Privacy</CardTitle>
              <CardDescription>
                Manage your data preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button variant="outline" className="w-full">Download My Data</Button>
                <p className="text-xs text-muted-foreground">
                  Download a copy of all your data stored in ThorEye
                </p>
              </div>
              
              <div className="space-y-2">
                <Button variant="outline" className="w-full">Delete My Account</Button>
                <p className="text-xs text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>

              {/* Admin and testing tools have been removed from the production version */}
            </CardContent>
          </Card>

          <div className="flex justify-between mt-6">
            <Button onClick={handleResetSettings} variant="outline">
              Reset to Default
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {passwordError && (
              <div className="text-sm text-red-500 p-2 bg-red-50 rounded">
                {passwordError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input 
                id="current-password" 
                type="password" 
                placeholder="Enter current password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input 
                id="new-password" 
                type="password" 
                placeholder="Enter new password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                placeholder="Confirm new password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePasswordDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleChangePassword}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Sessions Management Dialog */}
      <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Manage Active Sessions</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {sessionError && (
              <div className="text-sm text-red-500 p-2 bg-red-50 rounded mb-4">
                {sessionError}
              </div>
            )}
            
            {/* Only show sessions management for admin users */}
            {user && user.rights && Array.isArray(user.rights) && user.rights.includes('admin') ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Active sessions across all users. As an admin, you can terminate any session.
                  </p>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => loadSessions()}
                    disabled={isLoadingSessions}
                  >
                    {isLoadingSessions ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>
                
                <div className="border rounded-md mb-4 overflow-hidden">
                  <div className="bg-muted p-3 flex font-medium text-sm">
                    <div className="w-1/4">Username</div>
                    <div className="w-1/4">Last Activity</div>
                    <div className="w-1/3">Browser / IP</div>
                    <div className="w-1/6">Actions</div>
                  </div>
                  
                  {isLoadingSessions ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <div className="animate-pulse">Loading sessions...</div>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No active sessions found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {sessions.map((session) => (
                        <div key={session.id} className="p-3 flex text-sm hover:bg-muted/50">
                          <div className="w-1/4 overflow-hidden text-ellipsis">
                            {session.username}
                            <div className="flex items-center gap-1 mt-1">
                              {session.isCurrentSession && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  Current
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded ${session.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                {session.status === 'online' ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                          <div className="w-1/4">
                            {session.lastActive ? (
                              <>
                                <div>{new Date(session.lastActive).toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {session.status === 'online' ? 'Last activity' : 'Last login'}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground italic">Never logged in</span>
                            )}
                          </div>
                          <div className="w-1/3 text-xs text-muted-foreground">
                            {session.userAgent !== 'N/A' ? (
                              <>
                                <div className="truncate">{session.userAgent}</div>
                                <div>{session.ip}</div>
                              </>
                            ) : (
                              <div className="italic">No session data available</div>
                            )}
                          </div>
                          <div className="w-1/6">
                            {!session.isCurrentSession && (
                              session.status === 'offline' && session.id.startsWith('offline-') ? (
                                <span className="text-xs text-muted-foreground italic">
                                  No active session
                                </span>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => terminateSession(session.id)}
                                  disabled={isTerminatingSession}
                                >
                                  Terminate
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    Note: Terminating a session will force the user to log in again
                  </p>
                  
                  <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={sessions.filter(s => !s.isCurrentSession && !s.id.startsWith('offline-')).length === 0 || isTerminatingAllSessions}
                    onClick={() => terminateAllOtherSessions()}
                  >
                    {isTerminatingAllSessions ? 'Processing...' : 'Terminate All Other Sessions'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  Only administrators can view and manage user sessions.
                </p>
                <p className="text-sm text-muted-foreground">
                  Please contact an administrator if you need assistance with session management.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}