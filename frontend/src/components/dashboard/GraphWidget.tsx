import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { GraphData } from '@/types/ontology';
import { cn } from '@/lib/cn';

interface GraphWidgetProps {
  data: GraphData;
  title?: string;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export default function GraphWidget({
  data,
  title,
  height = 300,
  onNodeClick,
  className,
}: GraphWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...data.nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.label,
            color: n.color,
          },
        })),
        ...data.edges.map((e) => ({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': 'data(color)',
            color: '#d1d5db',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 24,
            height: 24,
            'border-width': 2,
            'border-color': '#374151',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#4b5563',
            'target-arrow-color': '#4b5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '8px',
            color: '#6b7280',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
          },
        },
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 20,
      },
      userZoomingEnabled: false,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    if (onNodeClick) {
      cy.on('tap', 'node', (evt) => {
        onNodeClick(evt.target.id());
      });
    }

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [data, onNodeClick]);

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        className
      )}
    >
      {title && (
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
      )}
      <div
        ref={containerRef}
        className="w-full rounded bg-[var(--color-bg)]"
        style={{ height }}
      />
    </div>
  );
}
