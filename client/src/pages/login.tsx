import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';
import { Loader2 } from 'lucide-react';
import logoImage from '@assets/IMG_3463-removebg-preview_1758466252112.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { loginMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Get loading and error state from the mutation
  const isLoading = loginMutation.isPending;

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  // We no longer need to initialize users in localStorage as we're using the database/sessions

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-emerald-500/10 animate-in fade-in duration-1000">
      <div className="absolute inset-0 bg-grid-white/20 mask-fade-out pointer-events-none"></div>
      <div className="relative z-10">
        <Card className="w-[400px] border-opacity-50 shadow-xl animate-in slide-in-from-bottom-10 duration-700">
          <CardHeader className="pb-6">
            <div className="w-full flex justify-center mb-4 animate-in zoom-in-50 duration-1000">
              <div className="h-28 w-28 flex items-center justify-center">
                <img 
                  src={logoImage} 
                  alt="SolveXtra Logo" 
                  className="h-24 w-24 object-contain"
                />
              </div>
            </div>
            <CardTitle className="text-center text-2xl bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent animate-in fade-in-25 duration-1000 delay-300">
              SolveXtra
            </CardTitle>
            <CardDescription className="text-center animate-in fade-in-50 duration-1000 delay-500">
              Sign in to your quality assurance platform
            </CardDescription>
          </CardHeader>
          <CardContent className="animate-in fade-in-50 duration-1000 delay-700">
            <form onSubmit={handleSubmit} className="space-y-4">
              {loginMutation.error && (
                <div className="text-sm text-red-500 p-2 bg-red-50 rounded">
                  {loginMutation.error.message}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all duration-300 shadow-md hover:shadow-lg" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
