import React from 'react';
import { useAuth } from '@/context/auth-context';

interface AccessControlProps {
  children: React.ReactNode;
  requiredRights: string[];
  orMode?: boolean; // When true, user needs ANY of the required rights, when false they need ALL
  fallback?: React.ReactNode; // Optional element to render if user doesn't have access
}

/**
 * A component that conditionally renders its children based on user permissions
 * If orMode is true (default), user needs ANY of the requiredRights
 * If orMode is false, user needs ALL of the requiredRights
 */
const AccessControl: React.FC<AccessControlProps> = ({ 
  children, 
  requiredRights, 
  orMode = true,
  fallback = null
}) => {
  const { user } = useAuth();
  
  // If no required rights, render children
  if (!requiredRights || requiredRights.length === 0) {
    return <>{children}</>;
  }
  
  // If user has no rights or is not logged in, render fallback
  if (!user || !user.rights) {
    return <>{fallback}</>;
  }
  
  // Parse rights data if needed (from JSON string or array)
  const userRights = Array.isArray(user.rights) 
    ? user.rights 
    : (typeof user.rights === 'string' 
        ? (user.rights.startsWith('[') ? JSON.parse(user.rights) : [user.rights])
        : []);
  
  // Admin has access to everything
  if (userRights.includes('admin')) {
    return <>{children}</>;
  }
  
  // Check user rights
  const hasRequiredRights = orMode
    ? requiredRights.some(right => userRights.includes(right)) // ANY of the rights
    : requiredRights.every(right => userRights.includes(right)); // ALL of the rights
  
  if (hasRequiredRights) {
    return <>{children}</>;
  } else {
    return <>{fallback}</>;
  }
};

export default AccessControl;