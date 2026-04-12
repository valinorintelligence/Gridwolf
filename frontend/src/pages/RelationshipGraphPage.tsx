import { useState, useMemo, useEffect } from 'react';
import { GitFork, Filter } from 'lucide-react';
import { RelationshipGraph } from '@/components/ontology/RelationshipGraph';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/services/api';
import type { GraphData, GraphNode, GraphEdge, ObjectTypeDefinition } from '@/types/ontology';

export default function RelationshipGraphPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [typeDefinitions, setTypeDefinitions] = useState<ObjectTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<string>('cose');

  useEffect(() => {
    async function fetchData() {
      try {
        const [graphRes, typesRes] = await Promise.all([
          api.get('/ontology/graph').catch(() => ({ data: { nodes: [], edges: [] } })),
          api.get('/ontology/types').catch(() => ({ data: [] })),
        ]);
        const gd = graphRes.data ?? { nodes: [], edges: [] };
        const nodes = (gd.nodes ?? []).map((n: Record<string, unknown>) => ({
          id: String(n.id ?? ''),
          label: String(n.label ?? n.id ?? ''),
          type: String(n.type ?? 'default'),
          color: String(n.color ?? '#8b5cf6'),
        })) as GraphNode[];
        const edges = (gd.edges ?? []).map((e: Record<string, unknown>) => ({
          id: String(e.id ?? `${e.source}-${e.target}`),
          source: String(e.source ?? ''),
          target: String(e.target ?? ''),
          label: String(e.label ?? ''),
        })) as GraphEdge[];
        setGraphData({ nodes, edges });
        const types = Array.isArray(typesRes.data) ? typesRes.data : typesRes.data?.results ?? [];
        setTypeDefinitions(types as ObjectTypeDefinition[]);
        setEnabledTypes(new Set((types as ObjectTypeDefinition[]).map((t) => t.name)));
      } catch {
        setGraphData({ nodes: [], edges: [] });
        setTypeDefinitions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleType = (typeName: string) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  };

  // Filter graph data based on selected types
  const filteredGraphData = useMemo(() => {
    const filteredNodes = graphData.nodes.filter((n) => enabledTypes.has(n.type));
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = graphData.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [enabledTypes, graphData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <GitFork className="h-12 w-12 text-content-muted" />
        <h2 className="mt-4 text-lg font-semibold text-content-primary">No Data Yet</h2>
        <p className="mt-1 text-sm text-content-secondary">The relationship graph will populate once objects and their connections are discovered.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <GitFork className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Relationship Graph</h1>
          <p className="text-xs text-content-secondary">
            Explore connections between all ontology objects
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="info">
            {filteredGraphData.nodes.length} nodes / {filteredGraphData.edges.length} edges
          </Badge>
          <Button
            variant={showFilters ? 'primary' : 'outline'}
            size="sm"
            icon={<Filter size={14} />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="flex items-center gap-4 py-2">
          <span className="text-xs font-medium text-content-secondary">Layout:</span>
          {['cose', 'circle', 'grid', 'breadthfirst'].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayout(l)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                layout === l
                  ? 'bg-accent text-white'
                  : 'bg-surface-hover text-content-secondary hover:text-content-primary'
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-4">
        {/* Filters sidebar */}
        {showFilters && (
          <Card className="w-60 shrink-0">
            <CardHeader title="Object Types" />
            <CardContent className="space-y-2">
              {typeDefinitions.map((typeDef) => (
                <label
                  key={String(typeDef.id)}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={enabledTypes.has(String(typeDef.name ?? ''))}
                    onChange={() => toggleType(String(typeDef.name ?? ''))}
                    className="accent-accent"
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: String(typeDef.color ?? '#6b7280') }}
                  />
                  <span className="text-content-primary">{String(typeDef.name ?? '')}</span>
                  <span className="ml-auto text-xs text-content-tertiary">
                    {graphData.nodes.filter((n) => n.type === typeDef.name).length}
                  </span>
                </label>
              ))}

              <div className="border-t border-border-default pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setEnabledTypes(new Set(typeDefinitions.map((t) => t.name)))
                  }
                  className="text-xs text-accent hover:underline"
                >
                  Select All
                </button>
                <span className="mx-2 text-content-muted">|</span>
                <button
                  type="button"
                  onClick={() => setEnabledTypes(new Set())}
                  className="text-xs text-accent hover:underline"
                >
                  Clear All
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Graph */}
        <div className="flex-1">
          <RelationshipGraph
            data={filteredGraphData}
            height="calc(100vh - 260px)"
          />
        </div>
      </div>
    </div>
  );
}
