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
        'fixed right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 px-6 backdrop-blur',
        className
      )}
    >
      {/* Left - Breadcrumb placeholder */}
      <div className="flex items-center text-sm text-[var(--color-text-secondary)]">
        <span className="text-[var(--color-text-primary)] font-medium">
          Gridwolf
        </span>
      </div>

      {/* Center - Search */}
      <div className="relative w-full max-w-[400px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
        <input
          type="text"
          placeholder="Search... (Cmd+K)"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-accent)]"
          readOnly
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true })
            );
          }}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
          {'\u2318'}K
        </kbd>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            3
          </span>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User avatar */}
        <button className="flex items-center gap-2 rounded-lg p-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden text-[var(--color-text-primary)] sm:inline">
            Admin
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </header>
  );
}
