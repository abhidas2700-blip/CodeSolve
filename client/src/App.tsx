import React, { useState, useEffect } from "react";
import { setupRecurringPurge } from "@/services/problematic-reports-purge";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth-context";
import { NavigationProvider } from "@/context/navigation-context";
import Dashboard from "@/pages/dashboard";
import Audits from "@/pages/audits";
import Reports from "@/pages/reports";
import Ata from "@/pages/ata";
import Forms from "@/pages/forms";
import Users from "@/pages/users";
import Partners from "@/pages/partners";
import Login from "@/pages/login";
import Help from "@/pages/help";
import Documentation from "@/pages/documentation";
import Contact from "@/pages/contact";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import DatabaseSetup from "@/pages/database-setup";
import MigrationPage from "@/pages/migration";
// Debug page removed from production version
import NotFound from "@/pages/not-found";
import NotAuthorized from "@/pages/not-authorized";
import { ProtectedView } from "@/components/ProtectedView";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

function App() {
  // Set up a global service to purge problematic reports
  useEffect(() => {
    console.log("Setting up global problematic reports purge service");
    // Clean up function will be called when component unmounts
    return setupRecurringPurge(5000);
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <NavigationProvider>
            <Toaster />
            <div className="min-h-screen flex flex-col">
              <AppRouter />
            </div>
          </NavigationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// Simple custom navigation system to avoid routing issues
function AppRouter() {
  const { user, logoutMutation } = useAuth();
  
  const logout = () => {
    logoutMutation.mutate();
  };
  const [currentView, setCurrentView] = useState("dashboard");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [viewParams, setViewParams] = useState<Record<string, string>>({});
  
  // Listen for custom navigation events
  React.useEffect(() => {
    const handleChangeView = (event: CustomEvent) => {
      if (event.detail && event.detail.view) {
        console.log("Changing view via custom event:", event.detail);
        setCurrentView(event.detail.view);
        
        // Store any parameters
        if (event.detail.id) {
          setViewParams({ id: event.detail.id });
        }
      }
    };
    
    window.addEventListener('change-view', handleChangeView as EventListener);
    
    // Handle URL navigation
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/')) {
      const route = hash.substring(2).split('?')[0];
      
      // Convert route to view name if needed
      const viewName = route || 'dashboard';
      
      console.log("URL navigation detected, setting view to:", viewName);
      setCurrentView(viewName);
      
      // Get params if any
      if (hash.includes('?')) {
        const paramStr = hash.split('?')[1];
        const params: Record<string, string> = {};
        new URLSearchParams(paramStr).forEach((value, key) => {
          params[key] = value;
        });
        setViewParams(params);
      }
    }
    
    return () => {
      window.removeEventListener('change-view', handleChangeView as EventListener);
    };
  }, []);
  
  // Helper function to safely check user rights
  const hasRight = (right: string): boolean => {
    if (!user?.rights) return false;
    
    // Parse rights data if needed (from JSON string or array)
    const userRights = Array.isArray(user.rights) 
      ? user.rights 
      : (typeof user.rights === 'string' 
          ? (user.rights.startsWith('[') ? JSON.parse(user.rights) : [user.rights])
          : []);
    
    return userRights.includes(right);
  };
  
  // Determine user's role based on rights
  const getUserRole = (): string => {
    if (!user?.rights) return 'User';
    
    if (hasRight('admin')) return 'Administrator';
    if (hasRight('masterAuditor')) return 'Master Auditor';
    if (hasRight('buildForm')) return 'Form Builder';
    if (hasRight('audit') && hasRight('createLowerUsers')) return 'Team Leader';
    if (hasRight('reports') && hasRight('dashboard') && hasRight('createLowerUsers')) return 'Manager';
    if (hasRight('audit')) return 'Auditor';
    
    return 'User';
  };
  
  // Check if there are any ATA reviews to determine whether to show the ATA tab
  const hasAtaReviews = (): boolean => {
    try {
      const audits = JSON.parse(localStorage.getItem('qa-submitted-audits') || '[]');
      return audits.some((audit: any) => audit.ataReview);
    } catch (error) {
      console.error('Error checking ATA reviews:', error);
      return false;
    }
  };
  
  const userRole = getUserRole();
  const showAtaTab = hasRight('admin') || 
                      hasRight('masterAuditor') || 
                      userRole === 'Manager';

  // Don't render anything until auth state is determined
  if (!user) {
    return <Login />;
  }

  // Define access rights required for each view
  const getViewRequiredRights = (view: string): string[] => {
    switch (view) {
      case "dashboard":
        return ['dashboard']; // Dashboard requires dashboard right
      case "audits":
        return ['audit']; // Audits requires audit right
      case "reports":
        return ['reports']; // Reports requires reports right
      case "partners":
        return ['partner']; // Partners requires partner right
      case "ata":
        return ['masterAuditor', 'admin']; // ATA requires either masterAuditor or admin rights
      case "forms":
        return ['buildForm', 'admin']; // Forms requires form building right
      case "users":
        return ['userManage', 'admin', 'createLowerUsers']; // Users requires user management rights
      case "profile":
      case "settings":
      case "help":
      case "documentation":
      case "contact":
        return []; // Everyone has access to these pages
      default:
        return ['admin']; // Only admins have access to unknown pages
    }
  };

  // Render the correct component based on current view
  const renderView = () => {
    // Get required rights for the current view
    const requiredRights = getViewRequiredRights(currentView);
    
    // Handle common pages that everyone should have access to
    if (currentView === "help" || currentView === "documentation" || 
        currentView === "contact" || currentView === "profile" || 
        currentView === "settings" || currentView === "database-setup" ||
        currentView === "migration") {
      // No protection needed for these basic pages
      switch (currentView) {
        case "help":
          return <Help />;
        case "documentation":
          return <Documentation />;
        case "contact":
          return <Contact />;
        case "profile":
          return <Profile />;
        case "settings":
          return <Settings />;
        case "database-setup":
          return <DatabaseSetup />;
        case "migration":
          return <MigrationPage />;
      }
    }
    
    // Apply protection to all other pages
    let pageComponent;
    switch (currentView) {
      case "dashboard":
        pageComponent = <Dashboard />;
        break;
      case "audits":
        pageComponent = <Audits />;
        break;
      case "reports":
        pageComponent = <Reports />;
        break;
      case "ata":
        pageComponent = <Ata />;
        break;
      case "forms":
        pageComponent = <Forms />;
        break;
      case "users":
        pageComponent = <Users />;
        break;
      case "partners":
        pageComponent = <Partners />;
        break;
      default:
        return <NotFound />;
    }
    
    // Wrap the component with protection
    return (
      <ProtectedView requiredRight={requiredRights}>
        {pageComponent}
      </ProtectedView>
    );
  };

  return (
    <>
      {/* Custom Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            
            <nav className="flex items-center space-x-4">
              <Button 
                variant={currentView === "dashboard" ? "default" : "ghost"} 
                onClick={() => setCurrentView("dashboard")}
              >
                Dashboard
              </Button>
              
              <Button 
                variant={currentView === "audits" ? "default" : "ghost"}
                onClick={() => setCurrentView("audits")}
              >
                Audits
              </Button>
              
              <Button 
                variant={currentView === "reports" ? "default" : "ghost"}
                onClick={() => setCurrentView("reports")}
              >
                Reports
              </Button>
              
              {/* Only show ATA tab to admins, master auditors, and managers */}
              {showAtaTab && (
                <Button 
                  variant={currentView === "ata" ? "default" : "ghost"}
                  onClick={() => setCurrentView("ata")}
                >
                  ATA
                </Button>
              )}
              
              {/* Only show Forms tab to admin, manager, team leader, and form builder roles */}
              {(hasRight('admin') || 
                hasRight('buildForm') || 
                userRole === 'Manager' || 
                userRole === 'Team Leader' || 
                userRole === 'Form Builder') && (
                <Button 
                  variant={currentView === "forms" ? "default" : "ghost"}
                  onClick={() => setCurrentView("forms")}
                >
                  Forms
                </Button>
              )}
              
              {/* Only show Users tab to admins, managers, and users with userManage permission */}
              {(hasRight('admin') || 
                hasRight('userManage') || 
                userRole === 'Manager') && (
                <Button 
                  variant={currentView === "users" ? "default" : "ghost"}
                  onClick={() => setCurrentView("users")}
                >
                  Users
                </Button>
              )}
              
              {/* Show Partners tab only to users with partner rights */}
              {hasRight('partner') && (
                <Button 
                  variant={currentView === "partners" ? "default" : "ghost"}
                  onClick={() => setCurrentView("partners")}
                >
                  Rebuttals
                </Button>
              )}

            </nav>
          </div>
          
          <div className="relative">
            <Button 
              variant="outline" 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              {user.username}
            </Button>
            
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => {
                    setCurrentView("profile");
                    setIsUserMenuOpen(false);
                  }}
                >
                  Profile
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => {
                    setCurrentView("settings");
                    setIsUserMenuOpen(false);
                  }}
                >
                  Settings
                </button>
                {hasRight('admin') && (
                  <>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                      onClick={() => {
                        setCurrentView("migration");
                        setIsUserMenuOpen(false);
                      }}
                    >
                      Database Migration
                    </button>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                      onClick={() => {
                        setCurrentView("database-setup");
                        setIsUserMenuOpen(false);
                      }}
                    >
                      Database Setup
                    </button>
                  </>
                )}
                {/* Debug tools removed from production version */}
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1">
        {renderView()}
      </main>
      
      {/* Simple Footer */}
      <footer className="border-t py-4 bg-gray-50">
        <div className="container text-center text-sm text-gray-500">
          © 2025 Quality Assurance Platform - All rights reserved
        </div>
      </footer>
    </>
  );
}

export default App;
