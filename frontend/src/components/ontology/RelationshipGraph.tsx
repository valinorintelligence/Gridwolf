import { useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type cytoscape from 'cytoscape';
import { Maximize, ZoomIn, ZoomOut, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { GraphData } from '@/types/ontology';

/* ------------------------------------------------------------------ */
/*  Node shapes by object type                                        */
/* ------------------------------------------------------------------ */

const TYPE_SHAPE_MAP: Record<string, string> = {
  Host: 'ellipse',
  Vulnerability: 'diamond',
  NetworkFlow: 'hexagon',
  Protocol: 'round-rectangle',
  Product: 'rectangle',
  Scanner: 'octagon',
  AttackPath: 'triangle',
  ComplianceControl: 'round-rectangle',
  Component: 'barrel',
  User: 'ellipse',
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface RelationshipGraphProps {
  data: GraphData;
  onNodeClick?: (nodeId: string) => void;
  height?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function RelationshipGraph({
  data,
  onNodeClick,
  height = '500px',
  className,
}: RelationshipGraphProps) {
  const cyRef = useRef<cytoscape.Core | null>(null);

  /* Convert GraphData to Cytoscape elements */
  const elements: cytoscape.ElementDefinition[] = [
    ...data.nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        color: node.color || 'var(--accent)',
        shape: TYPE_SHAPE_MAP[node.type] ?? 'ellipse',
      },
    })),
    ...data.edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
      },
    })),
  ];

  /* Stylesheet */
  const stylesheet: cytoscape.Stylesheet[] = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'background-color': 'data(color)',
        shape: 'data(shape)' as unknown as cytoscape.Css.NodeShape,
        width: 36,
        height: 36,
        'font-size': '10px',
        color: '#f1f5f9',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-outline-width': 2,
        'text-outline-color': '#0a0e17',
        'border-width': 2,
        'border-color': '#1e293b',
      },
    },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        'line-color': '#475569',
        'target-arrow-color': '#475569',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        width: 1.5,
        'font-size': '8px',
        color: '#94a3b8',
        'text-rotation': 'autorotate',
        'text-outline-width': 2,
        'text-outline-color': '#0a0e17',
      },
    },
    {
      selector: 'node:active',
      style: {
        'overlay-color': '#3b82f6',
        'overlay-opacity': 0.15,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-color': '#3b82f6',
        'border-width': 3,
      },
    },
  ];

  /* Layout */
  const layout = { name: 'cose', animate: true, animationDuration: 400 };

  const handleCyInit = useCallback(
    (cy: cytoscape.Core) => {
      cyRef.current = cy;
      cy.on('tap', 'node', (evt) => {
        const nodeId = evt.target.id();
        onNodeClick?.(nodeId);
      });
    },
    [onNodeClick],
  );

  /* Toolbar actions */
  const fitView = () => cyRef.current?.fit(undefined, 40);
  const zoomIn = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const zoomOut = () => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const reLayout = () => {
    cyRef.current?.layout({ name: 'cose', animate: true, animationDuration: 400 } as cytoscape.LayoutOptions).run();
  };

  return (
    <div className={cn('relative rounded-md border border-border-default bg-bg-primary', className)} style={{ height }}>
      {/* Toolbar */}
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        {[
          { icon: Maximize, action: fitView, title: 'Fit view' },
          { icon: ZoomIn, action: zoomIn, title: 'Zoom in' },
          { icon: ZoomOut, action: zoomOut, title: 'Zoom out' },
          { icon: LayoutGrid, action: reLayout, title: 'Re-layout' },
        ].map(({ icon: BtnIcon, action, title }) => (
          <button
            key={title}
            type="button"
            onClick={action}
            title={title}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded border border-border-default',
              'bg-bg-secondary text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary',
            )}
          >
            <BtnIcon size={14} />
          </button>
        ))}
      </div>

      <CytoscapeComponent
        elements={elements}
        stylesheet={stylesheet}
        layout={layout as cytoscape.LayoutOptions}
        cy={handleCyInit}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
