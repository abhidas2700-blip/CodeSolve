import { ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

// Types
type ProtectedViewProps = {
  children: ReactNode;
  requiredRight?: string | string[];
  fallbackPath?: string;
};

/**
 * Protected View - Secures a component/view by requiring authentication and optional specific rights
 * 
 * @param children - The component/content to render when authentication/authorization passes
 * @param requiredRight - Optional right(s) required to access this view (string or array of strings)
 * @param fallbackPath - Where to redirect if access is denied (defaults to "/auth")
 */
export function ProtectedView({
  children,
  requiredRight,
  fallbackPath = "/auth"
}: ProtectedViewProps) {
  const { user, isLoading, checkPermission } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const [, setLocation] = useLocation();
  
  // If not logged in, redirect to auth page
  if (!user) {
    setLocation(fallbackPath);
    return null;
  }

  // If specific rights are required, check them
  if (requiredRight && !checkPermission(requiredRight)) {
    setTimeout(() => {
      setLocation("/");
    }, 2000);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">
          You don't have permission to access this section.
        </p>
        <p className="text-sm text-muted-foreground">Redirecting to home page...</p>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}

/**
 * Protected Admin View - Specialized ProtectedView requiring admin rights
 */
export function AdminProtectedView({ children }: { children: ReactNode }) {
  return (
    <ProtectedView requiredRight="admin">
      {children}
    </ProtectedView>
  );
}

/**
 * Protected Manager View - Requires manager, team leader or admin rights
 */
export function ManagerProtectedView({ children }: { children: ReactNode }) {
  return (
    <ProtectedView requiredRight={["manager", "teamleader", "admin"]}>
      {children}
    </ProtectedView>
  );
}

/**
 * Protected Auditor View - Requires auditor, manager, team leader or admin rights
 */
export function AuditorProtectedView({ children }: { children: ReactNode }) {
  return (
    <ProtectedView requiredRight={["audit", "manager", "teamleader", "admin"]}>
      {children}
    </ProtectedView>
  );
}

/**
 * Protected ATA View - Requires ATA rights or admin rights
 */
export function ATAProtectedView({ children }: { children: ReactNode }) {
  return (
    <ProtectedView requiredRight={["ata", "admin"]}>
      {children}
    </ProtectedView>
  );
}