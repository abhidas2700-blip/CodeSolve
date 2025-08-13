import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Types
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<Omit<User, "password">, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<Omit<User, "password">, Error, RegisterData>;
  checkPermission: (requiredRight: string | string[]) => boolean;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  rights: string[];
};

// Create the context
export const AuthContext = createContext<AuthContextType | null>(null);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [checkCount, setCheckCount] = useState(0);

  // Fetch the current user
  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<Omit<User, "password"> | null, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user");
        if (response.status === 401) {
          return null;
        }
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }
        return await response.json();
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("An unknown error occurred");
      }
    },
  });

  // Login mutation
  const loginMutation = useMutation<Omit<User, "password">, Error, LoginData>({
    mutationFn: async (credentials: LoginData) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Login failed");
      }

      return await response.json();
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register mutation (for user creation)
  const registerMutation = useMutation<Omit<User, "password">, Error, RegisterData>({
    mutationFn: async (userData: RegisterData) => {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Registration failed");
      }

      return await response.json();
    },
    onSuccess: (userData) => {
      // Don't automatically set the user (don't log in as the created user)
      // New user was created, but current user should stay logged in
      toast({
        title: "User created successfully",
        description: `User ${userData.username} has been created.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "User creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if a user has the required permission
  const checkPermission = (requiredRight: string | string[]) => {
    if (!user) return false;
    
    const rightsList = Array.isArray(requiredRight) ? requiredRight : [requiredRight];
    
    // Parse rights data if needed (from JSON string or array)
    const userRights = Array.isArray(user.rights) 
      ? user.rights 
      : (typeof user.rights === 'string' 
          ? (user.rights.startsWith('[') ? JSON.parse(user.rights) : [user.rights])
          : []);
    
    // Admin has all rights
    if (userRights.includes("admin")) return true;
    
    // Check if user has any of the required rights
    return rightsList.some(right => userRights.includes(right));
  };

  // Poll for session status every minute to handle session timeouts
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCheckCount(prev => prev + 1);
      refetch();
    }, 60000); // Poll every minute

    return () => clearInterval(intervalId);
  }, [refetch]);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        checkPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook for using the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}