import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/auth-context';

interface PrivateRouteProps {
  children: React.ReactNode;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation('/login');
      } else {
        setAuthorized(true);
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
