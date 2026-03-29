import { Bell, Search, ChevronDown, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import ThemeToggle from '@/components/shared/ThemeToggle';

interface TopBarProps {
  className?: string;
}

export default function TopBar({ className }: TopBarProps) {
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

        {/* User avatar */}
        <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-content-secondary transition-colors hover:bg-surface-hover">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden font-medium text-content-primary sm:inline">
            Admin
          </span>
          <ChevronDown className="h-3 w-3 text-content-tertiary" />
        </button>
      </div>
    </header>
  );
}
