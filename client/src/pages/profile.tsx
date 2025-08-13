import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [stats, setStats] = useState({
    totalAudits: 0,
    averageScore: 0,
    pendingReviews: 0,
  });

  useEffect(() => {
    if (user) {
      // In a real app, we would fetch user stats from the API
      // For now, we'll use mock data
      const audits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
      
      // Filter audits by current user (if they were the auditor)
      const userAudits = audits.filter((audit: any) => 
        audit.auditorName === user.username || audit.auditor === user.username
      );
      
      setStats({
        totalAudits: userAudits.length,
        averageScore: userAudits.length > 0 
          ? Math.round(userAudits.reduce((sum: number, audit: any) => 
              sum + (audit.score / audit.maxScore) * 100, 0
            ) / userAudits.length) 
          : 0,
        pendingReviews: userAudits.filter((a: any) => a.status === 'pending').length,
      });
    }
  }, [user]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !user.id) {
      toast({
        title: "Error",
        description: "You must be logged in to change your password.",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "The new password and confirmation password do not match.",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call the API to change the password
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
        throw new Error(data.error || 'Failed to update password');
      }
      
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Show success message
      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
                Please log in to view your profile.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Profile</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              View and manage your account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              
              <div>
                <h2 className="text-2xl font-semibold">{user.username}</h2>
                <p className="text-muted-foreground">User ID: {user.id}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {user.rights.includes('admin') && (
                    <Badge variant="admin">Admin</Badge>
                  )}
                  {user.rights.includes('masterAuditor') && (
                    <Badge variant="masterAuditor">Master Auditor</Badge>
                  )}
                  {user.rights.includes('audit') && (
                    <Badge variant="auditor">Auditor</Badge>
                  )}
                  {user.rights.includes('buildForm') && (
                    <Badge variant="formBuilder">Form Builder</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm">Total Audits</p>
                    <p className="text-3xl font-bold">{stats.totalAudits}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm">Average Score</p>
                    <p className="text-3xl font-bold">{stats.averageScore}%</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm">Pending Reviews</p>
                    <p className="text-3xl font-bold">{stats.pendingReviews}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}