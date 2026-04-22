import { useState, useRef, useEffect } from 'react';
import { Bell, Search, ChevronDown, User, LogOut, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';

interface TopBarProps {
  className?: string;
}

// A single finding surfaced as a notification. Shape matches the subset of
// /api/v1/ics/findings/ response fields we actually render.
interface NotificationItem {
  id: string | number;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  created_at?: string;
  status?: string;
}

export default function TopBar({ className }: TopBarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Poll the findings endpoint so the bell badge reflects real open work.
  // Critical + high + open findings are what warrant the red dot.
  async function fetchNotifications() {
    setNotifLoading(true);
    try {
      const res = await api.get('/ics/findings/', {
        params: { limit: 20 },
      }).catch(() => ({ data: [] }));
      const raw = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const mapped: NotificationItem[] = raw
        .filter((f: any) => (f.status ?? 'open') !== 'resolved')
        .sort((a: any, b: any) => (sevRank[a.severity] ?? 4) - (sevRank[b.severity] ?? 4))
        .slice(0, 10)
        .map((f: any) => ({
          id: f.id,
          title: f.title ?? 'Untitled finding',
          severity: f.severity ?? 'medium',
          created_at: f.created_at,
          status: f.status,
        }));
      setNotifications(mapped);
    } finally {
      setNotifLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(iv);
  }, []);

  const unreadCount = notifications.filter(
    (n) => n.severity === 'critical' || n.severity === 'high',
  ).length;

  const severityDot: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-sky-500',
  };
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-surface-card/80 px-6 backdrop-blur-xl relative',
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

      <div className="bus-shimmer h-px absolute bottom-0 left-0 right-0" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-lg p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-severity-critical px-1 text-[10px] font-bold text-white font-numeric">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-border-default bg-surface-card shadow-lg z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
                <p className="text-xs font-semibold text-content-primary">Notifications</p>
                {notifications.length > 0 && (
                  <button
                    onClick={() => { setNotifOpen(false); navigate('/vulnerabilities'); }}
                    className="text-[10px] text-accent hover:underline"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifLoading && notifications.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-content-tertiary">Loading...</p>
                ) : notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs text-content-tertiary">No open findings.</p>
                    <p className="mt-1 text-[10px] text-content-tertiary">
                      Run a scan or import a PCAP to generate alerts.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setNotifOpen(false);
                        navigate('/vulnerabilities');
                      }}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-hover border-b border-border-default/50 last:border-0"
                    >
                      <span className={cn('mt-1 h-2 w-2 flex-shrink-0 rounded-full', severityDot[n.severity] || 'bg-slate-400')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-content-primary truncate">{n.title}</p>
                        <p className="mt-0.5 text-[10px] text-content-tertiary">
                          <span className="uppercase">{n.severity}</span>
                          {n.created_at && ` · ${new Date(n.created_at).toLocaleString()}`}
                        </p>
                      </div>
                      {(n.severity === 'critical' || n.severity === 'high') && (
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
