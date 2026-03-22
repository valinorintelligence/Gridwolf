import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  GitBranch,
  Network,
  Server,
  ShieldAlert,
  Crosshair,
  Route,
  ClipboardCheck,
  Package,
  BarChart3,
  Clock,
  TrendingUp,
  History,
  Upload,
  Plug,
  LayoutGrid,
  Bot,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/constants';
import { cn } from '@/lib/cn';

const COLLAPSED_KEY = 'gridwolf_sidebar_collapsed';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Boxes: Database,
  GitFork: GitBranch,
  Network,
  Server,
  ShieldAlert,
  Skull: Crosshair,
  Route,
  ClipboardCheck,
  Package,
  Gauge: BarChart3,
  Timer: Clock,
  BarChart3,
  CalendarClock: History,
  Upload,
  Plug,
  Wrench: LayoutGrid,
  Bot,
  Settings,
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Branding */}
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-4">
        <Shield className="h-6 w-6 flex-shrink-0 text-[var(--color-accent)]" />
        {!collapsed && (
          <span className="text-base font-bold tracking-wider text-[var(--color-text-primary)]">
            GRIDWOLF
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="mb-3">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">
                {group.group}
              </p>
            )}

            {group.items.map((item) => {
              const Icon = iconMap[item.icon] ?? LayoutDashboard;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                      collapsed && 'justify-center',
                      isActive
                        ? 'border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-l-2 border-l-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]'
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
              collapsed && 'justify-center',
              isActive
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )
          }
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
          style={collapsed ? { justifyContent: 'center' } : undefined}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
