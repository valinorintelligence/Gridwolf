import { useState, useEffect, useCallback } from 'react';
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
  Activity,
  Layers,
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
  Activity,
  Layers,
};

interface SidebarProps {
  onWidthChange?: (width: number) => void;
}

export default function Sidebar({ onWidthChange }: SidebarProps) {
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
    onWidthChange?.(collapsed ? 64 : 256);
  }, [collapsed, onWidthChange]);

  // Emit initial width
  useEffect(() => {
    onWidthChange?.(collapsed ? 64 : 256);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-surface-card transition-[width] duration-200',
        'border-border-default',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Branding */}
      <div className="flex h-14 items-center gap-3 border-b border-border-default px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold tracking-[0.2em] text-content-primary">
            GRIDWOLF
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="mb-2">
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">
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
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-accent/10 text-accent shadow-sm shadow-accent/5'
                        : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary'
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border-default p-2">
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content-primary',
            collapsed && 'justify-center px-0'
          )}
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
