import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Determine API base URL based on environment and deployment platform
 * - For local development: use relative URLs
 * - For Netlify: use /.netlify/functions/api
 * - For other deployments: adapt as needed
 */
const getApiBaseUrl = () => {
  // Check if we're in Netlify environment
  const isNetlify = 
    typeof window !== 'undefined' && (
      window.location.hostname.includes('netlify.app') || 
      window.location.hostname.includes('netlify.com')
    );

  // In development or if not in Netlify, use relative URLs
  if (import.meta.env.DEV || !isNetlify) {
    return '';
  }
  
  // In Netlify production environment
  return '/.netlify/functions/api';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Helper function to handle API errors
 * Throws a formatted error if response is not ok
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Try to parse the error as JSON first
    let errorMessage: string;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorData.message || res.statusText;
    } catch {
      // If not JSON, get as text
      errorMessage = (await res.text()) || res.statusText;
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

/**
 * Prepends API path for Netlify functions when needed
 * Handles different URL formats to ensure proper routing
 */
function getFullUrl(url: string): string {
  // If it's already a full URL or it already includes the Netlify functions path
  if (url.startsWith('http') || url.startsWith('/.netlify/functions/')) {
    return url;
  }
  
  // Check if the URL already starts with '/api'
  if (url.startsWith('/api')) {
    return `${API_BASE_URL}${url}`;
  }
  
  // Otherwise, assume we need to add /api prefix
  return `${API_BASE_URL}/api${url.startsWith('/') ? url : `/${url}`}`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = getFullUrl(url);
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = getFullUrl(url);
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
