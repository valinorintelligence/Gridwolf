import { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Ticket,
  ShieldOff,
  Wrench,
  Bell,
  Cog,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ObjectAction } from '@/types/ontology';

/* ------------------------------------------------------------------ */
/*  Action type → icon map                                            */
/* ------------------------------------------------------------------ */

const ACTION_ICON_MAP: Record<string, LucideIcon> = {
  jira: Ticket,
  isolate: ShieldOff,
  remediate: Wrench,
  notify: Bell,
  custom: Cog,
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ActionMenuProps {
  actions: ObjectAction[];
  objectId: string;
  onExecute?: (actionId: string, objectId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ActionMenu({ actions, objectId, onExecute }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (action: ObjectAction) => {
    /* Destructive actions require confirmation */
    if (action.actionType === 'isolate') {
      setConfirmId(action.id);
      return;
    }
    onExecute?.(action.id, objectId);
    setOpen(false);
  };

  const handleConfirm = (actionId: string) => {
    onExecute?.(actionId, objectId);
    setConfirmId(null);
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setConfirmId(null);
        }}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded border border-border-default',
          'text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary',
        )}
        title="Actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-md border border-border-default',
            'bg-bg-secondary shadow-lg',
          )}
        >
          {actions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-content-tertiary">No actions available</p>
          ) : (
            actions.map((action) => {
              const ActionIcon = ACTION_ICON_MAP[action.actionType] ?? Cog;
              const isDestructive = action.actionType === 'isolate';

              /* Confirmation state */
              if (confirmId === action.id) {
                return (
                  <div
                    key={action.id}
                    className="border-b border-border-default bg-severity-critical/5 px-3 py-2"
                  >
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-severity-critical">
                      <AlertTriangle size={12} />
                      <span className="font-medium">Confirm {action.name}?</span>
                    </div>
                    <p className="mb-2 text-[11px] text-content-secondary">
                      This action may be destructive and cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirm(action.id)}
                        className="rounded bg-severity-critical px-2 py-1 text-[11px] font-medium text-white hover:bg-severity-critical/80"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded border border-border-default px-2 py-1 text-[11px] text-content-secondary hover:bg-surface-hover"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleClick(action)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    'hover:bg-surface-hover',
                    isDestructive ? 'text-severity-critical' : 'text-content-primary',
                  )}
                >
                  <ActionIcon size={14} className={isDestructive ? '' : 'text-content-tertiary'} />
                  <span>{action.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
