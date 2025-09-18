import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Search, Eye, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';

export function Header() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', searchQuery);
    // Implement search functionality
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.getElementById('user-dropdown');
      const button = document.getElementById('user-dropdown-button');

      if (dropdown && button && !dropdown.contains(event.target as Node) && !button.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (path: string) => {
    return location === path;
  };

  // CSS for navigation links
  const linkClass = (path: string) => 
    `transition-colors ${isActive(path) ? 'text-primary font-semibold' : 'hover:text-primary'}`;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center">
          <div className="mr-6 flex items-center space-x-2">
            <Link href="/">
              <span className="font-bold text-xl cursor-pointer">SolveXtra</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="/">
              <span className={`cursor-pointer ${linkClass('/')}`}>Dashboard</span>
            </Link>
            
            {user?.rights?.includes('audit') && (
              <Link href="/audits">
                <span className={`cursor-pointer ${linkClass('/audits')}`}>Audits</span>
              </Link>
            )}
            
            {user?.rights?.includes('reports') && (
              <Link href="/reports">
                <span className={`cursor-pointer ${linkClass('/reports')}`}>Reports</span>
              </Link>
            )}
            
            {user?.rights?.includes('masterAuditor') && (
              <Link href="/ata">
                <span className={`cursor-pointer ${linkClass('/ata')}`}>ATA</span>
              </Link>
            )}
            
            {user?.rights?.includes('buildForm') && (
              <Link href="/forms">
                <span className={`cursor-pointer ${linkClass('/forms')}`}>Forms</span>
              </Link>
            )}
            
            {user?.rights?.includes('admin') && (
              <Link href="/users">
                <span className={`cursor-pointer ${linkClass('/users')}`}>Users</span>
              </Link>
            )}
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <form onSubmit={handleSearch} className="relative hidden md:flex">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-[200px] pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          
          <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span>Theme</span>
          </Button>
          
          <div className="relative">
            <Button
              id="user-dropdown-button"
              variant="outline"
              size="sm"
              onClick={toggleDropdown}
              className="flex items-center gap-2"
            >
              <span>{user?.username || 'User'}</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-4 w-4"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </Button>
            
            {isDropdownOpen && (
              <div
                id="user-dropdown"
                className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
              >
                <div className="py-1">
                  <Link href="/profile">
                    <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      Profile
                    </span>
                  </Link>
                  <Link href="/settings">
                    <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      Settings
                    </span>
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
