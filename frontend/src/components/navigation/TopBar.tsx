import { useState, useRef, useEffect } from 'react';
import { Bell, Search, ChevronDown, User, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  className?: string;
}

export default function TopBar({ className }: TopBarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-surface-card/80 px-6 backdrop-blur-xl',
        className
      )}
    >
      {/* Left - Breadcrumb placeholder */}
      <div className="flex items-center text-sm text-content-secondary">
        <span className="font-medium text-gradient">Gridwolf</span>
      </div>

      {/* Center - Search */}
      <div className="relative mx-8 w-full max-w-[420px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
        <input
          type="text"
          placeholder="Search... (Cmd+K)"
          className="w-full rounded-lg border border-border-default bg-bg-primary py-1.5 pl-9 pr-12 text-sm text-content-primary placeholder-content-tertiary outline-none transition-colors focus:border-accent"
          readOnly
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true })
            );
          }}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border-default bg-bg-secondary px-1.5 py-0.5 text-[10px] text-content-tertiary">
          {'\u2318'}K
        </kbd>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative rounded-lg p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-severity-critical text-[10px] font-bold text-white">
            3
          </span>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-border-default" />

        {/* User avatar with dropdown */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-content-secondary transition-colors hover:bg-surface-hover">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
              <User className="h-4 w-4" />
            </div>
            <span className="hidden font-medium text-content-primary sm:inline">
              {user?.fullName || user?.username || 'Admin'}
            </span>
            <ChevronDown className="h-3 w-3 text-content-tertiary" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border-default bg-surface-card shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-border-default">
                <p className="text-xs font-medium text-content-primary">{user?.fullName || user?.username}</p>
                <p className="text-[10px] text-content-tertiary">{user?.email}</p>
              </div>
              <button onClick={() => { setUserMenuOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-content-secondary hover:bg-surface-hover">
                <Settings size={12} /> Settings
              </button>
              <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-surface-hover">
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
