import { useMemo } from 'react';
import { Boxes } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useOntologyStore } from '@/stores/ontologyStore';
import SearchBar from '@/components/shared/SearchBar';
import { ObjectTable } from '@/components/ontology/ObjectTable';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  OBJECT_TYPE_DEFINITIONS,
  MOCK_OBJECTS,
} from '@/data/mock';
import {
  Server,
  ShieldAlert,
  Network,
  Cpu,
  Package,
  Scan,
  Route,
  ClipboardCheck,
  Component,
  User,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Server, ShieldAlert, Network, Cpu, Package, Scan, Route, ClipboardCheck, Component, User,
};

export default function OntologyExplorer() {
  const { selectedTypeId, selectType, searchQuery, setSearch } = useOntologyStore();

  // Count objects per type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const obj of MOCK_OBJECTS) {
      counts[obj.typeId] = (counts[obj.typeId] ?? 0) + 1;
    }
    return counts;
  }, []);

  // Current type definition
  const currentTypeDef = useMemo(
    () => OBJECT_TYPE_DEFINITIONS.find((t) => t.id === selectedTypeId),
    [selectedTypeId]
  );

  // Filtered objects
  const filteredObjects = useMemo(() => {
    let objs = MOCK_OBJECTS;
    if (selectedTypeId) {
      objs = objs.filter((o) => o.typeId === selectedTypeId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      objs = objs.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          Object.values(o.properties).some((v) =>
            String(v ?? '').toLowerCase().includes(q)
          )
      );
    }
    return objs;
  }, [selectedTypeId, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <Boxes className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Ontology Explorer</h1>
          <p className="text-xs text-content-secondary">
            Browse and search all object types and instances
          </p>
        </div>
        <Badge variant="info" className="ml-auto">
          {MOCK_OBJECTS.length} objects
        </Badge>
      </div>

      {/* Search */}
      <SearchBar
        placeholder="Search objects by name, property, or value..."
        onSearch={setSearch}
      />

      {/* Two-panel layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left panel: Type list */}
        <div className="col-span-4 space-y-2">
          <button
            type="button"
            onClick={() => selectType(null)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors',
              !selectedTypeId
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border-default bg-surface-card text-content-secondary hover:bg-surface-hover'
            )}
          >
            <Boxes size={16} />
            <span className="flex-1 font-medium">All Types</span>
            <span className="text-xs text-content-tertiary">{MOCK_OBJECTS.length}</span>
          </button>

          {OBJECT_TYPE_DEFINITIONS.map((typeDef) => {
            const Icon = ICON_MAP[typeDef.icon] ?? Component;
            const count = typeCounts[typeDef.id] ?? 0;
            const isSelected = selectedTypeId === typeDef.id;

            return (
              <button
                key={typeDef.id}
                type="button"
                onClick={() => selectType(typeDef.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-border-default bg-surface-card hover:bg-surface-hover'
                )}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                  style={{ color: typeDef.color, backgroundColor: `${typeDef.color}20` }}
                >
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', isSelected ? 'text-accent' : 'text-content-primary')}>
                    {typeDef.name}
                  </p>
                  <p className="truncate text-[11px] text-content-tertiary">
                    {typeDef.description}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-content-secondary">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right panel: Object table */}
        <div className="col-span-8">
          <Card>
            <CardHeader
              title={currentTypeDef ? `${currentTypeDef.name} Objects` : 'All Objects'}
              action={
                <span className="text-xs text-content-tertiary">
                  {filteredObjects.length} result{filteredObjects.length !== 1 ? 's' : ''}
                </span>
              }
            />
            <CardContent className="p-0">
              <ObjectTable
                objects={filteredObjects}
                typeDefinition={currentTypeDef}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
