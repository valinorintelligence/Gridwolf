import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/constants';
import { cn } from '@/lib/cn';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  label: string;
  path: string;
  group: string;
  type: 'page';
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const allPages: SearchResult[] = useMemo(
    () =>
      NAV_GROUPS.flatMap((g) =>
        g.items.map((item) => ({
          label: item.label,
          path: item.path,
          group: g.group,
          type: 'page' as const,
        }))
      ),
    []
  );

  const results = useMemo(() => {
    if (!query.trim()) return allPages;
    const q = query.toLowerCase();
    return allPages.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q)
    );
  }, [query, allPages]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    results.forEach((r) => {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    });
    return map;
  }, [results]);

  const flatResults = useMemo(() => results, [results]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.path);
      onClose();
    },
    [navigate, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatResults[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [flatResults, selectedIndex, handleSelect, onClose]
  );

  if (!isOpen) return null;

  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <Search className="h-5 w-5 flex-shrink-0 text-[var(--color-text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none"
          />
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {flatResults.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              No results found
            </p>
          )}

          {Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">
                {group}
              </p>
              {items.map((item) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      idx === selectedIndex
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]'
                    )}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-secondary)]">
          <span>
            <kbd className="mr-1 rounded border border-[var(--color-border)] px-1">{'\u2191'}</kbd>
            <kbd className="mr-1 rounded border border-[var(--color-border)] px-1">{'\u2193'}</kbd>
            Navigate
          </span>
          <span>
            <kbd className="mr-1 rounded border border-[var(--color-border)] px-1">{'\u21B5'}</kbd>
            Open
          </span>
        </div>
      </div>
    </div>
  );
}
