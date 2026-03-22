import { useState, useCallback } from 'react';
import { X, Pencil, Save, Ban } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { OntologyObject, ObjectTypeDefinition } from '@/types/ontology';
import { getTypeIcon, getTypeColor } from './ObjectCard';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface PropertyPanelProps {
  object: OntologyObject;
  typeDefinition?: ObjectTypeDefinition;
  editable?: boolean;
  onSave?: (properties: Record<string, unknown>) => void;
  onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PropertyPanel({
  object,
  typeDefinition,
  editable = false,
  onSave,
  onClose,
}: PropertyPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...object.properties });

  const Icon = getTypeIcon(object.typeName);
  const typeColor = getTypeColor(object.typeName);

  const schema = typeDefinition?.propertiesSchema;

  const handleSave = useCallback(() => {
    onSave?.(draft);
    setEditing(false);
  }, [draft, onSave]);

  const handleCancel = useCallback(() => {
    setDraft({ ...object.properties });
    setEditing(false);
  }, [object.properties]);

  const updateField = (key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  /* Build property rows from schema or raw keys */
  const propertyKeys: { key: string; label: string; type: string; enumValues?: string[] }[] =
    schema
      ? schema.map((s) => ({ key: s.key, label: s.label, type: s.type, enumValues: s.enumValues }))
      : Object.keys(object.properties).map((k) => ({ key: k, label: k, type: 'string' }));

  return (
    <div className="flex h-full w-80 flex-col border-l border-border-default bg-surface-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border-default px-4 py-3">
        <span style={{ color: typeColor }}>
          <Icon size={18} />
        </span>
        <span className="flex-1 truncate text-sm font-semibold text-content-primary">
          {object.title}
        </span>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-6 w-6 items-center justify-center rounded text-content-tertiary hover:text-content-primary"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-content-tertiary hover:text-content-primary"
            title="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {propertyKeys.map(({ key, label, type, enumValues }) => {
            const value = editing ? draft[key] : object.properties[key];

            return (
              <div key={key}>
                <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-content-tertiary">
                  {label}
                </label>

                {editing ? (
                  /* Edit mode inputs */
                  type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => updateField(key, e.target.checked)}
                      className="accent-accent"
                    />
                  ) : type === 'enum' && enumValues ? (
                    <select
                      value={String(value ?? '')}
                      onChange={(e) => updateField(key, e.target.value)}
                      className={cn(
                        'w-full rounded border border-border-default bg-bg-secondary px-2 py-1 text-sm text-content-primary',
                        'focus:border-accent focus:outline-none',
                      )}
                    >
                      <option value="">--</option>
                      {enumValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : type === 'number' ? (
                    <input
                      type="number"
                      value={value != null ? Number(value) : ''}
                      onChange={(e) => updateField(key, e.target.valueAsNumber)}
                      className={cn(
                        'w-full rounded border border-border-default bg-bg-secondary px-2 py-1 text-sm text-content-primary',
                        'focus:border-accent focus:outline-none',
                      )}
                    />
                  ) : (
                    <input
                      type="text"
                      value={value != null ? String(value) : ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      className={cn(
                        'w-full rounded border border-border-default bg-bg-secondary px-2 py-1 text-sm text-content-primary',
                        'focus:border-accent focus:outline-none',
                      )}
                    />
                  )
                ) : (
                  /* Read mode */
                  <p className="text-sm text-content-primary">
                    {value != null ? String(value) : <span className="text-content-muted">--</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer actions in edit mode */}
      {editing && (
        <div className="flex gap-2 border-t border-border-default px-4 py-3">
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white',
              'transition-colors hover:bg-accent-hover',
            )}
          >
            <Save size={13} /> Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded border border-border-default px-3 py-1.5 text-xs font-medium',
              'text-content-secondary transition-colors hover:bg-surface-hover',
            )}
          >
            <Ban size={13} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}
