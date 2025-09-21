import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';
import { Edit, Trash2, KeyRound, Shield, History, UserX, Clock } from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: string;
  email?: string;
  lastActive?: string;
  status: 'active' | 'inactive';
  permissions: string[];
  rights: string[]; // Add rights property for compatibility with auth context
}

interface DeletedUser {
  id: number;
  username: string;
  role: string;
  email?: string;
  permissions: string[];
  deletedBy: string;
  deletedAt: number;
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showDeletionHistory, setShowDeletionHistory] = useState(false);
  const [deletionHistory, setDeletionHistory] = useState<DeletedUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Form states for adding new user
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [formError, setFormError] = useState('');
  
  // Load users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const apiUsers = await response.json();
          
          // Get existing user statuses from localStorage (for backward compatibility)
          const userStatuses = JSON.parse(localStorage.getItem('qa-user-statuses') || '{}');
          
          const formattedUsers = apiUsers.map((user: any) => ({
            id: user.id,
            username: user.username,
            role: getRoleNameFromRights(user.rights),
            email: user.email || `${user.username}@qualithor.com`,
            lastActive: new Date().toISOString().split('T')[0],
            // Check if this user is marked as inactive in the user statuses or in the API response
            status: user.isInactive || userStatuses[user.id] === 'inactive' ? 'inactive' : 'active',
            permissions: user.rights,
            rights: user.rights // Add rights property for compatibility with the auth context
          }));
          setUsers(formattedUsers);
          console.log("Loaded users from API:", formattedUsers.length);
        } else {
          console.error('Failed to fetch users from API:', response.statusText);
          
          // Fallback to localStorage if API fails
          const storedQaUsers = localStorage.getItem('qa-users');
          if (storedQaUsers) {
            const qaUsers = JSON.parse(storedQaUsers);
            const userStatuses = JSON.parse(localStorage.getItem('qa-user-statuses') || '{}');
            
            const formattedUsers = qaUsers.map((user: any) => ({
              id: user.id,
              username: user.username,
              role: getRoleNameFromRights(user.rights),
              email: user.email || `${user.username}@qualithor.com`,
              lastActive: new Date().toISOString().split('T')[0],
              status: userStatuses[user.id] === 'inactive' ? 'inactive' : 'active',
              permissions: user.rights,
              rights: user.rights
            }));
            setUsers(formattedUsers);
            console.log("Loaded users from localStorage (fallback):", formattedUsers.length);
          }
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    
    fetchUsers();
  }, []);
  
  // Load deletion history from localStorage
  useEffect(() => {
    try {
      const storedDeletionHistory = localStorage.getItem('qa-user-deletions');
      if (storedDeletionHistory) {
        const parsedHistory = JSON.parse(storedDeletionHistory);
        setDeletionHistory(parsedHistory);
      }
    } catch (error) {
      console.error('Error loading deletion history:', error);
    }
  }, []);

  // Function to determine role name from rights array
  const getRoleNameFromRights = (rights: string[]) => {
    if (rights.includes('admin')) return 'Administrator';
    if (rights.includes('masterAuditor')) return 'Master Auditor';
    if (rights.includes('buildForm')) return 'Form Builder';
    if (rights.includes('audit') && rights.includes('createLowerUsers')) return 'Team Leader';
    if (rights.includes('audit')) return 'Auditor';
    if (rights.includes('reports') && rights.includes('dashboard') && rights.includes('createLowerUsers')) return 'Manager';
    if (rights.includes('partner')) return 'Partner';
    return 'User';
  };
  
  // Function to get rights array from role name
  const getRightsFromRole = (role: string): string[] => {
    switch(role) {
      case 'administrator':
        return ['admin', 'audit', 'reports', 'edit', 'delete', 'masterAuditor', 
                'buildForm', 'dashboard', 'userManage', 'changePassword', 'deleteUser',
                'createLowerUsers', 'ata', 'manager', 'teamleader'];
      case 'masterAuditor':
        return ['masterAuditor', 'audit', 'reports', 'edit', 'ata'];
      case 'auditor':
        return ['audit', 'reports'];
      case 'formBuilder':
        return ['buildForm', 'reports'];
      case 'manager':
        return ['reports', 'dashboard', 'createLowerUsers', 'userManage', 'manager'];
      case 'teamLeader':
        return ['audit', 'reports', 'dashboard', 'createLowerUsers', 'userManage', 'teamleader'];
      case 'partner':
        return ['partner'];
      default:
        return [];
    }
  };

  // Filter users based on search query and active tab
  const getFilteredUsers = () => {
    let filteredUsers = users;
    
    // Filter by status if tab is not 'all'
    if (activeTab === 'active') {
      filteredUsers = filteredUsers.filter(user => user.status === 'active');
    } else if (activeTab === 'inactive') {
      filteredUsers = filteredUsers.filter(user => user.status === 'inactive');
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredUsers = filteredUsers.filter(
        user => 
          user.username.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query) ||
          (user.email && user.email.toLowerCase().includes(query))
      );
    }
    
    return filteredUsers;
  };

  const handleAddUser = () => {
    // Check if user has permissions to add users
    if (!currentUser?.rights.includes('admin') && 
        !currentUser?.rights.includes('userManage') && 
        !currentUser?.rights.includes('createLowerUsers')) {
      alert('You do not have permission to add new users.');
      return;
    }
    
    // Reset form fields
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('auditor'); // Default role
    setFormError('');
    setShowAddUserDialog(true);
  };
  
  const handleCreateUser = async () => {
    // Check if user has permissions to add users
    if (!currentUser?.rights.includes('admin') && 
        !currentUser?.rights.includes('userManage') && 
        !currentUser?.rights.includes('createLowerUsers')) {
      setFormError('You do not have permission to add new users.');
      return;
    }
    
    // Validate form
    if (!newUsername || !newPassword || !newRole) {
      setFormError('Please fill in all required fields');
      return;
    }
    
    // Get rights array from role name
    const rights = getRightsFromRole(newRole);
    
    try {
      // Use backend API to create user
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          rights: rights
        }),
        credentials: 'include'  // This is crucial to send the session cookie
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setFormError(errorData.error || 'Failed to create user');
        return;
      }
      
      const newUser = await response.json();
      
      // Add to users state
      const newUserFormatted: User = {
        id: newUser.id,
        username: newUser.username,
        role: getRoleNameFromRights(rights),
        email: newEmail || newUser.email || `${newUser.username}@qualithor.com`,
        lastActive: new Date().toISOString().split('T')[0],
        status: 'active',
        permissions: rights,
        rights: rights // Add rights property for compatibility with auth context
      };
      
      setUsers([...users, newUserFormatted]);
      setShowAddUserDialog(false);
      
      // Refresh user list from API
      try {
        const refreshResponse = await fetch('/api/users', {
          credentials: 'include'
        });
        
        if (refreshResponse.ok) {
          const apiUsers = await refreshResponse.json();
          
          // Get existing user statuses
          const userStatuses = JSON.parse(localStorage.getItem('qa-user-statuses') || '{}');
          
          const formattedUsers = apiUsers.map((user: any) => ({
            id: user.id,
            username: user.username,
            role: getRoleNameFromRights(user.rights),
            email: user.email || `${user.username}@qualithor.com`,
            lastActive: new Date().toISOString().split('T')[0],
            status: user.isInactive || userStatuses[user.id] === 'inactive' ? 'inactive' : 'active',
            permissions: user.rights,
            rights: user.rights
          }));
          setUsers(formattedUsers);
          console.log("Refreshed users from API:", formattedUsers.length);
        } else {
          console.error('Failed to refresh users from API:', refreshResponse.statusText);
        }
      } catch (error) {
        console.error('Error refreshing users:', error);
      }
      
      // Show success feedback
      alert('User created successfully!');
    } catch (error) {
      console.error('Error creating user:', error);
      setFormError('An error occurred while creating the user. Please try again.');
    }
  };

  const handleEditUser = (user: User) => {
    // Check if user has permissions to edit users
    if (!currentUser?.rights.includes('admin') && 
        !currentUser?.rights.includes('userManage') && 
        !(currentUser?.rights.includes('changePassword') && user.username === currentUser.username)) {
      alert('You do not have permission to edit users.');
      return;
    }
    
    // Prevent admin from editing their own role
    if (currentUser?.username === user.username && currentUser?.rights.includes('admin')) {
      alert('For security reasons, admins cannot change their own permissions or role. Please ask another admin to make these changes.');
      return;
    }
    
    setEditingUser(user);
    setShowEditUserDialog(true);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has permissions to edit users
    if (!currentUser?.rights.includes('admin') && 
        !currentUser?.rights.includes('userManage') && 
        !(currentUser?.rights.includes('changePassword') && editingUser?.username === currentUser.username)) {
      alert('You do not have permission to edit users.');
      setShowEditUserDialog(false);
      return;
    }
    
    const form = e.target as HTMLFormElement;
    const emailInput = form.querySelector('#edit-email') as HTMLInputElement;
    const roleSelect = form.querySelector('#edit-role') as HTMLSelectElement;
    const statusSelect = form.querySelector('#status') as HTMLSelectElement;
    const passwordInput = form.querySelector('#new-password') as HTMLInputElement;
    
    if (!editingUser) return;
    
    // Add debugging for form values
    console.log('Form values:', {
      email: emailInput.value,
      role: roleSelect.value,
      status: statusSelect.value,
      password: passwordInput.value ? '[password set]' : '[no password]'
    });
    
    const newEmail = emailInput.value;
    const newRole = roleSelect.value;
    const newStatus = statusSelect.value as 'active' | 'inactive';
    const newPassword = passwordInput.value;
    
    // Role-based restrictions - prevent creating equal or higher-level roles
    if (!currentUser?.rights.includes('admin')) {
      // Manager can't create another manager
      if (currentUser?.rights.includes('createLowerUsers') && 
          !currentUser?.rights.includes('audit') && 
          newRole === 'manager') {
        alert('You are not authorized to assign this role. Managers can only assign lower-level positions.');
        return;
      }
      
      // Team leader can't create manager or another team leader
      if (currentUser?.rights.includes('createLowerUsers') && 
          currentUser?.rights.includes('audit') && 
          (newRole === 'manager' || newRole === 'teamleader')) {
        alert('You are not authorized to assign this role. Team leaders can only assign lower-level positions.');
        return;
      }
      
      // Can't create admin or master auditor without admin rights
      if (newRole === 'administrator' || newRole === 'masterauditor') {
        alert('Only administrators can assign this role.');
        return;
      }
    }
    
    try {
      // Update rights based on new role
      let rights = getRightsFromRole(newRole);
      
      // Update user data first
      const userUpdateResponse = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rights: rights,
          isInactive: newStatus === 'inactive',
          email: newEmail || editingUser.email
        }),
        credentials: 'include'
      });
      
      if (!userUpdateResponse.ok) {
        const errorData = await userUpdateResponse.json();
        throw new Error(errorData.error || 'Failed to update user');
      }
      
      // If password needs to be updated, make a separate API call
      if (newPassword && (currentUser?.rights.includes('admin') || currentUser?.rights.includes('changePassword'))) {
        const passwordUpdateResponse = await fetch(`/api/users/password/${editingUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newPassword: newPassword,
            // When admin changing others' passwords, no need for oldPassword
            ...(currentUser.id === editingUser.id ? { oldPassword: prompt('Please enter your current password:') || '' } : {})
          }),
          credentials: 'include'
        });
        
        if (!passwordUpdateResponse.ok) {
          const errorData = await passwordUpdateResponse.json();
          throw new Error(errorData.error || 'Failed to update password');
        }
      }
      
      // Update the status in a separate localStorage item to track inactive users
      const userStatus = newStatus as 'active' | 'inactive';
      let userStatuses = JSON.parse(localStorage.getItem('qa-user-statuses') || '{}');
      
      // ENHANCED INACTIVE USER TRACKING: Also track by username to prevent login with changed credentials
      let inactiveUsernames = JSON.parse(localStorage.getItem('qa-inactive-usernames') || '[]');
      
      if (userStatus === 'inactive') {
        // Store as string to ensure consistent type comparison during login check
        userStatuses[String(editingUser.id)] = 'inactive';
        
        // Also track the username in a separate list for more robust checking
        if (!inactiveUsernames.some((name: string) => name.toLowerCase() === editingUser.username.toLowerCase())) {
          inactiveUsernames.push(editingUser.username);
        }
        
        console.log(`Marking user ${editingUser.username} (ID: ${editingUser.id}) as inactive`);
      } else {
        // If status is active, remove from the inactive users list
        delete userStatuses[String(editingUser.id)];
        
        // Also remove from inactive usernames list
        inactiveUsernames = inactiveUsernames.filter((name: string) => 
          name.toLowerCase() !== editingUser.username.toLowerCase()
        );
        
        console.log(`Marking user ${editingUser.username} (ID: ${editingUser.id}) as active`);
      }
      
      localStorage.setItem('qa-user-statuses', JSON.stringify(userStatuses));
      localStorage.setItem('qa-inactive-usernames', JSON.stringify(inactiveUsernames));
      
      // Refresh users list from API
      try {
        const refreshResponse = await fetch('/api/users', {
          credentials: 'include'
        });
        
        if (refreshResponse.ok) {
          const apiUsers = await refreshResponse.json();
          
          // Get existing user statuses
          const userStatuses = JSON.parse(localStorage.getItem('qa-user-statuses') || '{}');
          
          const formattedUsers = apiUsers.map((user: any) => ({
            id: user.id,
            username: user.username,
            role: getRoleNameFromRights(user.rights),
            email: user.email || `${user.username}@qualithor.com`,
            lastActive: new Date().toISOString().split('T')[0],
            status: user.isInactive || userStatuses[user.id] === 'inactive' ? 'inactive' : 'active',
            permissions: user.rights,
            rights: user.rights
          }));
          setUsers(formattedUsers);
          console.log("Refreshed users from API after edit:", formattedUsers.length);
        } else {
          console.error('Failed to refresh users from API after edit:', refreshResponse.statusText);
        }
      } catch (error) {
        console.error('Error refreshing users after edit:', error);
      }
      
      setShowEditUserDialog(false);
      alert('User updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      alert(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleViewPermissions = (user: User) => {
    // Check if user has permissions to edit user permissions
    if (!currentUser?.rights.includes('admin') && !currentUser?.rights.includes('userManage')) {
      alert('You do not have permission to view or edit user permissions.');
      return;
    }
    
    // Prevent admin from editing their own permissions
    if (currentUser?.username === user.username && currentUser?.rights.includes('admin')) {
      alert('For security reasons, admins cannot change their own permissions. Please ask another admin to make these changes.');
      return;
    }
    
    setEditingUser(user);
    setShowPermissionsDialog(true);
  };
  
  // State for managing permissions directly
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);
  
  // Set temp permissions when a user is selected for editing
  useEffect(() => {
    if (editingUser) {
      setTempPermissions(editingUser.permissions || []);
    }
  }, [editingUser]);
  
  // Handle checkbox changes for permissions
  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setTempPermissions(prev => [...prev, permission]);
    } else {
      setTempPermissions(prev => prev.filter(p => p !== permission));
    }
  };
  
  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has permissions to edit user permissions
    if (!currentUser?.rights.includes('admin') && !currentUser?.rights.includes('userManage')) {
      alert('You do not have permission to edit user permissions.');
      setShowPermissionsDialog(false);
      return;
    }
    
    if (!editingUser) return;
    
    // Check if non-admin user is trying to grant deleteUser permission
    if (!currentUser?.rights.includes('admin') && tempPermissions.includes('deleteUser')) {
      alert('Only administrators can grant user deletion rights. This permission has been removed.');
      // Remove deleteUser permission if a non-admin tries to add it
      const filteredPermissions = tempPermissions.filter(p => p !== 'deleteUser');
      setTempPermissions(filteredPermissions);
      return;
    }
    
    // Use the tempPermissions state directly
    const permissions = [...tempPermissions];
    
    try {
      // Call backend API to update permissions
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rights: permissions
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user permissions');
      }
      
      // Create audit trail for permission changes
      const timestamp = new Date().getTime();
      const permissionEditHistory = JSON.parse(localStorage.getItem('qa-permission-edits') || '[]');
      
      permissionEditHistory.push({
        username: editingUser.username,
        editedBy: currentUser.username,
        timestamp: timestamp,
        oldPermissions: editingUser.permissions || [],
        newPermissions: permissions,
      });
      
      localStorage.setItem('qa-permission-edits', JSON.stringify(permissionEditHistory));
      
      // Refresh users list from API
      try {
        const refreshResponse = await fetch('/api/users', {
          credentials: 'include'
        });
        
        if (refreshResponse.ok) {
          const apiUsers = await refreshResponse.json();
          
          // Get existing user statuses
          const userStatuses = JSON.parse(localStorage.getItem('qa-user-statuses') || '{}');
          
          const formattedUsers = apiUsers.map((user: any) => ({
            id: user.id,
            username: user.username,
            role: getRoleNameFromRights(user.rights),
            email: user.email || `${user.username}@qualithor.com`,
            lastActive: new Date().toISOString().split('T')[0],
            status: user.isInactive || userStatuses[user.id] === 'inactive' ? 'inactive' : 'active',
            permissions: user.rights,
            rights: user.rights
          }));
          setUsers(formattedUsers);
          console.log("Refreshed users from API after permission edit:", formattedUsers.length);
        } else {
          console.error('Failed to refresh users from API after permission edit:', refreshResponse.statusText);
        }
      } catch (error) {
        console.error('Error refreshing users after permission edit:', error);
      }
      
      setShowPermissionsDialog(false);
      alert('User permissions updated successfully!');
    } catch (error) {
      console.error('Error updating user permissions:', error);
      alert(`Failed to update user permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteUser = async (user: User) => {
    // Only admin or users with explicit deleteUser permission can delete users
    if (!currentUser?.rights.includes('admin') && !currentUser?.rights.includes('deleteUser')) {
      alert('You do not have permission to delete users. Only administrators and users with explicit delete permission can remove users.');
      return;
    }

    // Check if trying to delete self
    if (user.username === currentUser.username) {
      alert('You cannot delete your own account.');
      return;
    }

    // Confirm deletion
    if (window.confirm(`Are you sure you want to delete the user "${user.username}"? This action cannot be undone.`)) {
      try {
        // Delete user via API
        const response = await fetch(`/api/users/${user.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete user');
        }
        
        // Also remove the user from the status tracking if they exist there
        const userStatuses = JSON.parse(localStorage.getItem('qa-user-statuses') || '{}');
        if (userStatuses[String(user.id)]) {
          delete userStatuses[String(user.id)];
          console.log(`Removing status for deleted user ${user.username} (ID: ${user.id})`);
          localStorage.setItem('qa-user-statuses', JSON.stringify(userStatuses));
        }
        
        // Also remove from inactive usernames list if they're in there
        let inactiveUsernames = JSON.parse(localStorage.getItem('qa-inactive-usernames') || '[]');
        if (inactiveUsernames.some((name: string) => name.toLowerCase() === user.username.toLowerCase())) {
          inactiveUsernames = inactiveUsernames.filter((name: string) => 
            name.toLowerCase() !== user.username.toLowerCase()
          );
          localStorage.setItem('qa-inactive-usernames', JSON.stringify(inactiveUsernames));
          console.log(`Removed ${user.username} from inactive usernames list during user deletion`);
        }
        
        // Update users state
        setUsers(users.filter(u => u.id !== user.id));
        
        // Show success message
        alert('User deleted successfully!');
  
        // Create a comprehensive deletion record for tracking
        const deletedAt = new Date().getTime();
        
        const deletedUser: DeletedUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          permissions: user.permissions,
          deletedBy: currentUser.username,
          deletedAt: deletedAt
        };
  
        // Store deletion record
        const storedDeletionHistory = JSON.parse(localStorage.getItem('qa-user-deletions') || '[]');
        const updatedDeletionHistory = [...storedDeletionHistory, deletedUser];
        localStorage.setItem('qa-user-deletions', JSON.stringify(updatedDeletionHistory));
        
        // Update deletion history state
        setDeletionHistory(updatedDeletionHistory);
        
        // Show deletion history
        setShowDeletionHistory(true);
      } catch (error) {
        console.error('Error deleting user:', error);
        alert(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'administrator':
        return 'destructive';
      case 'master auditor':
        return 'outline';
      case 'form builder':
        return 'secondary';
      case 'manager':
        return 'default';
      default:
        return 'outline';
    }
  };
  
  // Export user roles data to CSV
  const exportUserRolesData = () => {
    // Get the filtered users based on current tab and search
    const filteredUsers = getFilteredUsers();
    if (filteredUsers.length === 0) {
      alert('No users to export');
      return;
    }
    
    // Create header row for user details only
    let csvContent = "Username,Role,Email,Status,Last Active\n";
    
    // Add individual user details
    filteredUsers.forEach(user => {
      csvContent += `"${user.username}","${user.role}","${user.email || ''}","${user.status}","${user.lastActive || 'Never'}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `user-roles-report-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <Button onClick={handleAddUser} disabled={!currentUser?.rights.includes('userManage') && !currentUser?.rights.includes('admin') && !currentUser?.rights.includes('createLowerUsers')}>
          Add New User
          {!currentUser?.rights.includes('userManage') && !currentUser?.rights.includes('admin') && !currentUser?.rights.includes('createLowerUsers') && 
            <span className="ml-2 text-xs text-red-500">(No permission)</span>
          }
        </Button>
      </div>
      
      <div className="flex flex-col gap-6">
        {showDeletionHistory ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle>Deletion History</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowDeletionHistory(false)}
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    Return to Users
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b transition-colors hover:bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Username</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Deleted By</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Deleted On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletionHistory.map((deletedUser, index) => (
                      <tr key={index} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle font-medium">{deletedUser.username}</td>
                        <td className="p-4 align-middle">
                          <Badge variant={getRoleBadgeVariant(deletedUser.role)}>
                            {deletedUser.role}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle">{deletedUser.email}</td>
                        <td className="p-4 align-middle">
                          <Badge variant="outline">{deletedUser.deletedBy}</Badge>
                        </td>
                        <td className="p-4 align-middle">
                          {new Date(deletedUser.deletedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {deletionHistory.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No deletion history found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle>Users</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowDeletionHistory(!showDeletionHistory)}
                    disabled={deletionHistory.length === 0}
                    className={showDeletionHistory ? "bg-muted" : ""}
                  >
                    <History className="h-4 w-4 mr-1" />
                    Deletion History
                    {deletionHistory.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {deletionHistory.length}
                      </Badge>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportUserRolesData}
                    className="bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 border-green-200"
                  >
                    <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export User Roles
                  </Button>
                </div>
                <div className="relative w-64">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="pr-8"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 h-full"
                      onClick={() => setSearchQuery('')}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Users ({users.length})</TabsTrigger>
                  <TabsTrigger value="active">Active ({users.filter(u => u.status === 'active').length})</TabsTrigger>
                  <TabsTrigger value="inactive">Inactive ({users.filter(u => u.status === 'inactive').length})</TabsTrigger>
                </TabsList>
                
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Username</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Last Active</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                        <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredUsers().map(user => (
                        <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                          <td className="p-4 align-middle font-medium">{user.username}</td>
                          <td className="p-4 align-middle">
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle">{user.email}</td>
                          <td className="p-4 align-middle">{user.lastActive || 'Never'}</td>
                          <td className="p-4 align-middle">
                            <Badge variant={user.status === 'active' ? 'outline' : 'secondary'}>
                              {user.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex justify-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!currentUser?.rights.includes('admin') && 
                                          !currentUser?.rights.includes('userManage') && 
                                          !(currentUser?.rights.includes('changePassword') && user.username === currentUser.username)}
                                onClick={() => handleEditUser(user)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                                {(!currentUser?.rights.includes('admin') && 
                                  !currentUser?.rights.includes('userManage') && 
                                  !(currentUser?.rights.includes('changePassword') && user.username === currentUser.username)) && 
                                  <span className="ml-2 text-xs">(No permission)</span>
                                }
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!currentUser?.rights.includes('admin') && 
                                          !currentUser?.rights.includes('userManage')}
                                onClick={() => handleViewPermissions(user)}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                Permissions
                                {(!currentUser?.rights.includes('admin') && 
                                  !currentUser?.rights.includes('userManage')) && 
                                  <span className="ml-2 text-xs">(No permission)</span>
                                }
                              </Button>
                              
                              {user.username !== 'admin' && 
                               (currentUser?.rights.includes('admin') || currentUser?.rights.includes('deleteUser')) && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={user.username === currentUser?.username}
                                  onClick={() => handleDeleteUser(user)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {getFilteredUsers().length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found. {searchQuery ? 'Try a different search term.' : ''}
                    </div>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account with specific permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="text-sm text-red-500 p-2 bg-red-50 rounded">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                placeholder="Enter username" 
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="Enter email" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Enter password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {currentUser?.rights.includes('admin') && (
                    <SelectItem value="administrator">Administrator</SelectItem>
                  )}
                  {currentUser?.rights.includes('admin') && (
                    <SelectItem value="masterAuditor">Master Auditor</SelectItem>
                  )}
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="formBuilder">Form Builder</SelectItem>
                  {(currentUser?.rights.includes('admin') || currentUser?.rights.includes('createLowerUsers')) && (
                    <SelectItem value="manager">Manager</SelectItem>
                  )}
                  {(currentUser?.rights.includes('admin') || currentUser?.rights.includes('createLowerUsers')) && (
                    <SelectItem value="teamLeader">Team Leader</SelectItem>
                  )}
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateUser}>
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
            <DialogDescription>Update user details and role assignment</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveUserEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" defaultValue={editingUser?.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                {/* Using a standard HTML select for better form handling */}
                <select 
                  id="edit-role" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                  defaultValue={editingUser?.role.toLowerCase().replace(/\s+/g, '')}
                >
                  {currentUser?.rights.includes('admin') && (
                    <option value="administrator">Administrator</option>
                  )}
                  {currentUser?.rights.includes('admin') && (
                    <option value="masterAuditor">Master Auditor</option>
                  )}
                  <option value="auditor">Auditor</option>
                  <option value="formBuilder">Form Builder</option>
                  {(currentUser?.rights.includes('admin') || currentUser?.rights.includes('createLowerUsers')) && (
                    <option value="manager">Manager</option>
                  )}
                  {(currentUser?.rights.includes('admin') || currentUser?.rights.includes('createLowerUsers')) && (
                    <option value="teamLeader">Team Leader</option>
                  )}
                  <option value="partner">Partner</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select 
                  id="status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                  defaultValue={editingUser?.status}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Reset Password</Label>
                <div className="flex space-x-2">
                  <Input 
                    id="new-password" 
                    type="password" 
                    placeholder="New password" 
                    className="flex-1" 
                    disabled={!currentUser?.rights.includes('changePassword') && !currentUser?.rights.includes('admin')}
                  />
                  <Button 
                    type="button"
                    variant="outline" 
                    disabled={!currentUser?.rights.includes('changePassword') && !currentUser?.rights.includes('admin')}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Reset
                    {!currentUser?.rights.includes('changePassword') && !currentUser?.rights.includes('admin') && 
                      <span className="ml-2 text-xs text-red-500">(No permission)</span>
                    }
                  </Button>
                </div>
                {!currentUser?.rights.includes('changePassword') && !currentUser?.rights.includes('admin') && (
                  <p className="text-xs text-red-500 mt-1">Only administrators can reset passwords</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditUserDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Permissions Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>User Permissions: {editingUser?.username}</DialogTitle>
            <DialogDescription>Customize user access rights and capabilities</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePermissions}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label className="text-sm font-medium">Administration</Label>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="admin" 
                        checked={tempPermissions.includes('admin')} 
                        disabled={!currentUser?.rights.includes('admin')}
                        onCheckedChange={(checked) => handlePermissionChange('admin', !!checked)}
                      />
                      <Label htmlFor="admin" className="font-medium">Full Administrative Access</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Grants all permissions in the system</p>
                    
                    {!currentUser?.rights.includes('admin') && (
                      <p className="text-xs text-red-500 ml-6">Only administrators can assign admin rights</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Audit Permissions</Label>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="audit" 
                        checked={tempPermissions.includes('audit')} 
                        onCheckedChange={(checked) => handlePermissionChange('audit', !!checked)}
                      />
                      <Label htmlFor="audit">Conduct Audits</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="review" 
                        checked={tempPermissions.includes('review')}
                        onCheckedChange={(checked) => handlePermissionChange('review', !!checked)}
                      />
                      <Label htmlFor="review">Review Audits</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="masterAuditor" 
                        checked={tempPermissions.includes('masterAuditor')} 
                        disabled={!currentUser?.rights.includes('admin')}
                        onCheckedChange={(checked) => handlePermissionChange('masterAuditor', !!checked)}
                      />
                      <Label htmlFor="masterAuditor">Master Auditor (ATA)</Label>
                      {!currentUser?.rights.includes('admin') && (
                        <span className="text-xs text-red-500">(Admin only)</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Form Permissions</Label>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="buildForm" 
                        checked={tempPermissions.includes('buildForm')}
                        onCheckedChange={(checked) => handlePermissionChange('buildForm', !!checked)}
                      />
                      <Label htmlFor="buildForm">Build Forms</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="editForm" 
                        checked={tempPermissions.includes('editForm')}
                        onCheckedChange={(checked) => handlePermissionChange('editForm', !!checked)}
                      />
                      <Label htmlFor="editForm">Edit Forms</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="deleteForm" 
                        checked={tempPermissions.includes('deleteForm')}
                        onCheckedChange={(checked) => handlePermissionChange('deleteForm', !!checked)}
                      />
                      <Label htmlFor="deleteForm">Delete Forms</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Report Permissions</Label>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="reports" 
                        checked={tempPermissions.includes('reports')}
                        onCheckedChange={(checked) => handlePermissionChange('reports', !!checked)}
                      />
                      <Label htmlFor="reports">View Reports</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="exportReports" 
                        checked={tempPermissions.includes('exportReports')}
                        onCheckedChange={(checked) => handlePermissionChange('exportReports', !!checked)}
                      />
                      <Label htmlFor="exportReports">Export Reports</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">System Permissions</Label>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="dashboard" 
                        checked={tempPermissions.includes('dashboard')}
                        onCheckedChange={(checked) => handlePermissionChange('dashboard', !!checked)}
                      />
                      <Label htmlFor="dashboard">Dashboard Access</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="alerts" 
                        checked={tempPermissions.includes('alerts')}
                        onCheckedChange={(checked) => handlePermissionChange('alerts', !!checked)}
                      />
                      <Label htmlFor="alerts">Alert Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="userManage" 
                        checked={tempPermissions.includes('userManage')} 
                        disabled={!currentUser?.rights.includes('admin')}
                        onCheckedChange={(checked) => handlePermissionChange('userManage', !!checked)}
                      />
                      <Label htmlFor="userManage">User Management</Label>
                      {!currentUser?.rights.includes('admin') && (
                        <span className="text-xs text-red-500">(Admin only)</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="changePassword" 
                        checked={tempPermissions.includes('changePassword')}
                        disabled={!currentUser?.rights.includes('admin')}
                        onCheckedChange={(checked) => handlePermissionChange('changePassword', !!checked)}
                      />
                      <Label htmlFor="changePassword">Reset Passwords</Label>
                      {!currentUser?.rights.includes('admin') && (
                        <span className="text-xs text-red-500">(Admin only)</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="createLowerUsers" 
                        checked={tempPermissions.includes('createLowerUsers')}
                        onCheckedChange={(checked) => handlePermissionChange('createLowerUsers', !!checked)}
                      />
                      <Label htmlFor="createLowerUsers">Create Lower-Level Users</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="deleteUser" 
                        checked={tempPermissions.includes('deleteUser')}
                        disabled={!currentUser?.rights.includes('admin')}
                        onCheckedChange={(checked) => handlePermissionChange('deleteUser', !!checked)}
                      />
                      <Label htmlFor="deleteUser">Delete Users</Label>
                      {!currentUser?.rights.includes('admin') && (
                        <span className="text-xs text-red-500">(Admin only)</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Only administrators can grant user deletion rights</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPermissionsDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Permissions
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}