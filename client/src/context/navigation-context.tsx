import React, { createContext, useContext, useState } from 'react';

type View = 'dashboard' | 'audits' | 'reports' | 'ata' | 'forms' | 'users' | 'help' | 'documentation' | 'contact' | 'profile' | 'settings';

interface NavigationContextType {
  activeView: View;
  setActiveView: (view: View) => void;
  navigateTo: (view: View, params?: Record<string, string>) => void;
  viewParams: Record<string, string>;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [viewParams, setViewParams] = useState<Record<string, string>>({});

  // Function to navigate to a different view
  const navigateTo = (view: View, params: Record<string, string> = {}) => {
    // Update the view state
    setActiveView(view);
    setViewParams(params);
    
    // Dispatch a custom event for other components to listen for navigation changes
    const event = new CustomEvent('change-view', {
      detail: { view, ...params }
    });
    window.dispatchEvent(event);
    
    // Update the URL hash
    const queryString = Object.keys(params).length > 0 
      ? '?' + new URLSearchParams(params).toString() 
      : '';
    window.location.hash = `#/${view}${queryString}`;
  };

  return (
    <NavigationContext.Provider value={{ activeView, setActiveView, navigateTo, viewParams }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
}

// Keep the original function for backward compatibility
export function useNavigation() {
  return useNavigationContext();
}
