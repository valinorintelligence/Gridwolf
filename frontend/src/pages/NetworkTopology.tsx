import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  Network, Server, ArrowRightLeft, Layers, Search, ZoomIn, ZoomOut,
  Maximize2, RotateCcw, Download, X, Filter, Play, Pause, SkipForward,
  ChevronRight, Eye, Grid3X3, Clock, MonitorDot,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import StatCard from '@/components/dashboard/StatCard';
import { PURDUE_LEVELS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { api } from '@/services/api';

// ---------------------------------------------------------------------------
// Purdue level colors
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<string, string> = {
  L0: '#ef4444',
  L1: '#f97316',
  L2: '#eab308',
  L3: '#22c55e',
  DMZ: '#8b5cf6',
  L4: '#3b82f6',
  L5: '#06b6d4',
};

// ---------------------------------------------------------------------------
// Topology types — data loaded from backend API
// ---------------------------------------------------------------------------

interface TopoNode {
  id: string;
  ip: string;
  hostname: string;
  label: string;
  purdueLevel: string;
  subnet: string;
  vendor: string;
  model: string;
  deviceType: string;
  x: number;
  y: number;
}

interface TopoEdge {
  id: string;
  source: string;
  target: string;
  protocol: string;
  packets: number;
  bytes: number;
  observed: boolean;
  firstSeen: string;
}

interface SwitchNode {
  id: string;
  name: string;
  vendor: string;
  model: string;
  ports: number;
  connections: { port: number; deviceId: string; speed: string }[];
}

function getSubnet(ip: string): string {
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

// Module-level mutable state — populated by fetchTopologyData()
let TOPO_NODES: TopoNode[] = [];
let ALL_EDGES: TopoEdge[] = [];
let SWITCHES: SwitchNode[] = [];

interface MatrixCell {
  sourceIp: string;
  destIp: string;
  protocol: string;
  packets: number;
  bytes: number;
}
let MATRIX_DATA: MatrixCell[] = [];

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'node_discovered' | 'edge_established';
  nodeId?: string;
  edgeId?: string;
  label: string;
}
let TIMELINE_EVENTS: TimelineEvent[] = [];

let ALL_PROTOCOLS: string[] = [];
let ALL_SUBNETS: string[] = [];
let ALL_LEVELS: string[] = [];

async function fetchTopologyData(): Promise<boolean> {
  try {
    const [topoRes, devicesRes] = await Promise.allSettled([
      api.get('/ics/devices/topology'),
      api.get('/ics/devices/'),
    ]);

    const topo = topoRes.status === 'fulfilled' ? topoRes.value.data : { nodes: [], edges: [] };
    const devices = devicesRes.status === 'fulfilled' ? devicesRes.value.data : [];

    if (topo.nodes.length === 0 && devices.length === 0) return false;

    // Build nodes from topology or devices
    const rawNodes = topo.nodes.length > 0 ? topo.nodes : devices;
    TOPO_NODES = rawNodes.map((n: Record<string, unknown>, i: number) => ({
      id: (n.id || `node-${i}`) as string,
      ip: (n.ip || n.ip_address || '') as string,
      hostname: (n.hostname || n.label || '') as string,
      label: (n.label || n.hostname || n.ip || n.ip_address || `Device ${i + 1}`) as string,
      purdueLevel: (n.purdue_level || n.purdueLevel || 'UNKNOWN') as string,
      subnet: getSubnet((n.ip || n.ip_address || '0.0.0.0') as string),
      vendor: (n.vendor || '') as string,
      model: (n.model || '') as string,
      deviceType: (n.type || n.device_type || 'UNKNOWN') as string,
      x: 100 + (i % 4) * 200,
      y: 80 + Math.floor(i / 4) * 160,
    }));

    // Build edges
    ALL_EDGES = (topo.edges || []).map((e: Record<string, unknown>, i: number) => ({
      id: `edge-${i}`,
      source: (e.source || '') as string,
      target: (e.target || '') as string,
      protocol: (e.protocol || '') as string,
      packets: (e.packet_count || 0) as number,
      bytes: (e.byte_count || 0) as number,
      observed: true,
      firstSeen: new Date().toISOString(),
    })).filter((e: TopoEdge) => e.source && e.target);

    // Matrix data from edges
    MATRIX_DATA = ALL_EDGES.map((e) => {
      const src = TOPO_NODES.find((n) => n.id === e.source);
      const dst = TOPO_NODES.find((n) => n.id === e.target);
      return {
        sourceIp: src?.ip ?? e.source,
        destIp: dst?.ip ?? e.target,
        protocol: e.protocol,
        packets: e.packets,
        bytes: e.bytes,
      };
    });

    // Timeline events
    TIMELINE_EVENTS = [
      ...TOPO_NODES.map((n, i) => ({
        id: `te-node-${i}`,
        timestamp: new Date(Date.now() - (TOPO_NODES.length - i) * 7200000).toISOString(),
        type: 'node_discovered' as const,
        nodeId: n.id,
        label: `Discovered ${n.label} (${n.ip})`,
      })),
      ...ALL_EDGES.map((e, i) => ({
        id: `te-edge-${i}`,
        timestamp: e.firstSeen,
        type: 'edge_established' as const,
        edgeId: e.id,
        label: `Connection: ${e.protocol} flow established`,
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Filters
    ALL_PROTOCOLS = [...new Set(ALL_EDGES.map((e) => e.protocol).filter(Boolean))];
    ALL_SUBNETS = [...new Set(TOPO_NODES.map((n) => n.subnet))];
    ALL_LEVELS = [...new Set(TOPO_NODES.map((n) => n.purdueLevel))];

    // Switches — empty for now (no backend endpoint)
    SWITCHES = [];

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar({
  searchQuery,
  onSearchChange,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onExport,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border-default px-4 py-2 bg-surface-card">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-tertiary" />
        <input
          type="text"
          placeholder="Search by IP or hostname..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-md border border-border-default bg-surface-hover pl-8 pr-3 py-1.5 text-xs text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <ToolbarButton icon={<ZoomIn className="h-3.5 w-3.5" />} title="Zoom In" onClick={onZoomIn} />
        <ToolbarButton icon={<ZoomOut className="h-3.5 w-3.5" />} title="Zoom Out" onClick={onZoomOut} />
        <ToolbarButton icon={<Maximize2 className="h-3.5 w-3.5" />} title="Fit to Screen" onClick={onFit} />
        <ToolbarButton icon={<RotateCcw className="h-3.5 w-3.5" />} title="Reset Layout" onClick={onReset} />
        <div className="w-px h-5 bg-border-default mx-1" />
        <ToolbarButton icon={<Download className="h-3.5 w-3.5" />} title="Export as PNG" onClick={onExport} />
      </div>
    </div>
  );
}

function ToolbarButton({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-content-secondary hover:bg-surface-hover hover:text-content-primary transition-colors"
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Node Popup
// ---------------------------------------------------------------------------

function NodePopup({ node, onClose }: { node: TopoNode; onClose: () => void }) {
  const connectedEdges = ALL_EDGES.filter((e) => e.source === node.id || e.target === node.id);
  return (
    <div className="absolute right-4 top-4 z-30 w-80 rounded-lg border border-border-default bg-surface-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
        <h4 className="text-sm font-semibold text-content-primary truncate">{node.label}</h4>
        <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-hover text-content-tertiary">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['IP Address', node.ip],
            ['Hostname', node.hostname],
            ['Purdue Level', node.purdueLevel],
            ['Subnet', node.subnet],
            ['Vendor', node.vendor],
            ['Model', node.model],
            ['Device Type', node.deviceType],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">{label}</p>
              <p className="text-content-primary">{value || '-'}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-1">
            Connections ({connectedEdges.length})
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {connectedEdges.map((e) => {
              const peer = TOPO_NODES.find((n) => n.id === (e.source === node.id ? e.target : e.source));
              return (
                <div key={e.id} className="flex items-center gap-2 text-xs text-content-secondary">
                  <span className={cn('h-1.5 w-1.5 rounded-full', e.observed ? 'bg-emerald-400' : 'bg-amber-400')} />
                  <span className="font-mono">{peer?.ip ?? '?'}</span>
                  <Badge variant="outline">{e.protocol}</Badge>
                  <span className="ml-auto text-content-muted">{e.packets.toLocaleString()} pkts</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Sidebar
// ---------------------------------------------------------------------------

function FilterSidebar({
  protocolFilters,
  levelFilters,
  subnetFilters,
  onToggleProtocol,
  onToggleLevel,
  onToggleSubnet,
  onClearAll,
}: {
  protocolFilters: Set<string>;
  levelFilters: Set<string>;
  subnetFilters: Set<string>;
  onToggleProtocol: (p: string) => void;
  onToggleLevel: (l: string) => void;
  onToggleSubnet: (s: string) => void;
  onClearAll: () => void;
}) {
  const hasFilters = protocolFilters.size > 0 || levelFilters.size > 0 || subnetFilters.size > 0;
  return (
    <div className="w-56 border-r border-border-default bg-surface-card overflow-y-auto shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-content-primary">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </span>
        {hasFilters && (
          <button onClick={onClearAll} className="text-[10px] text-accent hover:underline">
            Clear All
          </button>
        )}
      </div>

      <FilterGroup title="Protocol" items={ALL_PROTOCOLS} selected={protocolFilters} onToggle={onToggleProtocol} />
      <FilterGroup title="Purdue Level" items={ALL_LEVELS} selected={levelFilters} onToggle={onToggleLevel} colorMap={LEVEL_COLORS} />
      <FilterGroup title="Subnet" items={ALL_SUBNETS} selected={subnetFilters} onToggle={onToggleSubnet} />
    </div>
  );
}

function FilterGroup({
  title,
  items,
  selected,
  onToggle,
  colorMap,
}: {
  title: string;
  items: string[];
  selected: Set<string>;
  onToggle: (item: string) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="px-3 py-2 border-b border-border-default">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-1.5">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <label key={item} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.has(item)}
              onChange={() => onToggle(item)}
              className="h-3 w-3 rounded border-border-default accent-accent"
            />
            {colorMap && colorMap[item] && (
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorMap[item] }} />
            )}
            <span className="text-xs text-content-secondary group-hover:text-content-primary truncate">{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logical View (SVG Graph)
// ---------------------------------------------------------------------------

function LogicalView({
  searchQuery,
  zoom,
  selectedNode,
  onSelectNode,
  protocolFilters,
  levelFilters,
  subnetFilters,
}: {
  searchQuery: string;
  zoom: number;
  selectedNode: TopoNode | null;
  onSelectNode: (n: TopoNode | null) => void;
  protocolFilters: Set<string>;
  levelFilters: Set<string>;
  subnetFilters: Set<string>;
}) {
  const filteredNodes = useMemo(() => {
    let nodes = TOPO_NODES;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter((n) => n.ip.includes(q) || n.hostname.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
    }
    if (levelFilters.size > 0) {
      nodes = nodes.filter((n) => levelFilters.has(n.purdueLevel));
    }
    if (subnetFilters.size > 0) {
      nodes = nodes.filter((n) => subnetFilters.has(n.subnet));
    }
    return nodes;
  }, [searchQuery, levelFilters, subnetFilters]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    let edges = ALL_EDGES.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    if (protocolFilters.size > 0) {
      edges = edges.filter((e) => protocolFilters.has(e.protocol));
    }
    return edges;
  }, [filteredNodes, protocolFilters]);

  // Group nodes by subnet for compound nodes
  const subnetGroups = useMemo(() => {
    const groups: Record<string, TopoNode[]> = {};
    for (const node of filteredNodes) {
      (groups[node.subnet] ??= []).push(node);
    }
    return groups;
  }, [filteredNodes]);

  // Layout: arrange nodes by Purdue level (y) and within level (x)
  const layoutNodes = useMemo(() => {
    const levelOrder = ['L5', 'L4', 'DMZ', 'L3', 'L2', 'L1', 'L0'];
    const byLevel: Record<string, TopoNode[]> = {};
    for (const n of filteredNodes) {
      (byLevel[n.purdueLevel] ??= []).push(n);
    }
    const positioned: Record<string, { x: number; y: number }> = {};
    let yOffset = 60;
    for (const level of levelOrder) {
      const levelNodes = byLevel[level] ?? [];
      if (levelNodes.length === 0) continue;
      const startX = (900 - levelNodes.length * 160) / 2 + 80;
      levelNodes.forEach((n, i) => {
        positioned[n.id] = { x: startX + i * 160, y: yOffset };
      });
      yOffset += 120;
    }
    return positioned;
  }, [filteredNodes]);

  const svgHeight = Math.max(500, Object.values(layoutNodes).reduce((max, p) => Math.max(max, p.y), 0) + 100);

  return (
    <div className="relative">
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${900 / zoom} ${svgHeight / zoom}`}
        className="bg-surface-card"
      >
        {/* Subnet backgrounds */}
        {Object.entries(subnetGroups).map(([subnet, nodes]) => {
          const positions = nodes.map((n) => layoutNodes[n.id]).filter(Boolean);
          if (positions.length === 0) return null;
          const minX = Math.min(...positions.map((p) => p.x)) - 50;
          const minY = Math.min(...positions.map((p) => p.y)) - 30;
          const maxX = Math.max(...positions.map((p) => p.x)) + 50;
          const maxY = Math.max(...positions.map((p) => p.y)) + 30;
          return (
            <g key={subnet}>
              <rect
                x={minX} y={minY}
                width={maxX - minX} height={maxY - minY}
                rx={8} ry={8}
                fill="var(--color-surface-hover)" fillOpacity={0.3}
                stroke="var(--color-border)" strokeWidth={1} strokeDasharray="4 2"
              />
              <text x={minX + 6} y={minY + 14} fontSize={10} fill="var(--color-text-secondary)" fontFamily="monospace">
                {subnet}
              </text>
            </g>
          );
        })}

        {/* Edges */}
        {filteredEdges.map((edge) => {
          const src = layoutNodes[edge.source];
          const dst = layoutNodes[edge.target];
          if (!src || !dst) return null;
          const midX = (src.x + dst.x) / 2;
          const midY = (src.y + dst.y) / 2 - 8;
          return (
            <g key={edge.id}>
              <line
                x1={src.x} y1={src.y} x2={dst.x} y2={dst.y}
                stroke={edge.observed ? 'var(--color-accent)' : '#f59e0b'}
                strokeWidth={Math.min(3, 1 + edge.packets / 5000)}
                strokeDasharray={edge.observed ? undefined : '6 3'}
                opacity={0.6}
              />
              <text
                x={midX} y={midY}
                fontSize={9} fill="var(--color-text-secondary)"
                textAnchor="middle" fontFamily="monospace"
              >
                {edge.protocol}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {filteredNodes.map((node) => {
          const pos = layoutNodes[node.id];
          if (!pos) return null;
          const color = LEVEL_COLORS[node.purdueLevel] ?? '#6b7280';
          const isSelected = selectedNode?.id === node.id;
          return (
            <g
              key={node.id}
              onClick={() => onSelectNode(isSelected ? null : node)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={pos.x} cy={pos.y} r={isSelected ? 26 : 22}
                fill={color} fillOpacity={0.15}
                stroke={color} strokeWidth={isSelected ? 2.5 : 1.5}
              />
              {isSelected && (
                <circle cx={pos.x} cy={pos.y} r={30} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              )}
              <text x={pos.x} y={pos.y - 2} textAnchor="middle" fontSize={10} fontWeight="bold" fill="var(--color-text-primary)">
                {node.purdueLevel}
              </text>
              <text x={pos.x} y={pos.y + 10} textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">
                {node.deviceType}
              </text>
              <text x={pos.x} y={pos.y + 38} textAnchor="middle" fontSize={9} fill="var(--color-text-secondary)" fontFamily="monospace">
                {node.ip}
              </text>
              <text x={pos.x} y={pos.y + 50} textAnchor="middle" fontSize={8} fill="var(--color-text-tertiary)">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {selectedNode && <NodePopup node={selectedNode} onClose={() => onSelectNode(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Physical View
// ---------------------------------------------------------------------------

function PhysicalView({ searchQuery }: { searchQuery: string }) {
  const [selectedPort, setSelectedPort] = useState<{ switchId: string; port: number } | null>(null);

  const filteredSwitches = useMemo(() => {
    if (!searchQuery) return SWITCHES;
    const q = searchQuery.toLowerCase();
    return SWITCHES.filter(
      (sw) =>
        sw.name.toLowerCase().includes(q) ||
        sw.vendor.toLowerCase().includes(q) ||
        sw.connections.some((c) => {
          const dev = TOPO_NODES.find((n) => n.id === c.deviceId);
          return dev && (dev.ip.includes(q) || dev.hostname.toLowerCase().includes(q));
        })
    );
  }, [searchQuery]);

  return (
    <div className="p-4 space-y-6">
      {filteredSwitches.map((sw) => (
        <Card key={sw.id}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MonitorDot className="h-4 w-4 text-cyan-400" />
                {sw.name}
                <span className="text-xs font-normal text-content-tertiary">
                  {sw.vendor} {sw.model}
                </span>
              </span>
            }
            action={<Badge variant="info">{sw.connections.length}/{sw.ports} ports</Badge>}
          />
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: sw.ports }, (_, i) => i + 1).map((portNum) => {
                const conn = sw.connections.find((c) => c.port === portNum);
                const device = conn ? TOPO_NODES.find((n) => n.id === conn.deviceId) : null;
                const isSelected = selectedPort?.switchId === sw.id && selectedPort?.port === portNum;
                return (
                  <button
                    key={portNum}
                    onClick={() => setSelectedPort(isSelected ? null : { switchId: sw.id, port: portNum })}
                    className={cn(
                      'relative flex flex-col items-center rounded-md border px-3 py-2 min-w-[72px] transition-all',
                      conn
                        ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20'
                        : 'border-border-default bg-surface-hover/30 opacity-50',
                      isSelected && 'ring-2 ring-accent'
                    )}
                  >
                    <span className="text-[10px] font-mono text-content-tertiary">P{portNum}</span>
                    {conn && device ? (
                      <>
                        <span className={cn('h-2 w-2 rounded-full mt-1', 'bg-emerald-400')} />
                        <span className="text-[10px] font-medium text-content-primary mt-0.5 truncate max-w-[60px]">
                          {device.deviceType}
                        </span>
                      </>
                    ) : (
                      <span className="h-2 w-2 rounded-full mt-1 bg-content-muted/30" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Connected device detail */}
            {selectedPort?.switchId === sw.id && (() => {
              const conn = sw.connections.find((c) => c.port === selectedPort.port);
              const device = conn ? TOPO_NODES.find((n) => n.id === conn.deviceId) : null;
              if (!device || !conn) return null;
              return (
                <div className="mt-4 rounded-md border border-border-default bg-surface-hover/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-semibold text-content-primary">{device.label}</h5>
                    <Badge variant="info">Port {selectedPort.port} - {conn.speed}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] text-content-tertiary uppercase">IP</p>
                      <p className="font-mono text-content-primary">{device.ip}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-content-tertiary uppercase">Type</p>
                      <p className="text-content-primary">{device.deviceType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-content-tertiary uppercase">Vendor</p>
                      <p className="text-content-primary">{device.vendor}</p>
                    </div>
                  </div>
                  {/* Lines to indicate connection type */}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary">
                      <span className="w-6 border-t-2 border-solid border-emerald-400" />
                      Observed
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary">
                      <span className="w-6 border-t-2 border-dashed border-amber-400" />
                      Inferred
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mesh View (Connection Matrix)
// ---------------------------------------------------------------------------

function MeshView({ searchQuery: _searchQuery }: { searchQuery: string }) {
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const ips = useMemo(() => {
    const ipSet = new Set<string>();
    MATRIX_DATA.forEach((m) => { ipSet.add(m.sourceIp); ipSet.add(m.destIp); });
    return [...ipSet].sort();
  }, []);

  const filteredMatrix = useMemo(() => {
    if (protocolFilter === 'all') return MATRIX_DATA;
    return MATRIX_DATA.filter((m) => m.protocol === protocolFilter);
  }, [protocolFilter]);

  const maxPackets = useMemo(
    () => Math.max(1, ...filteredMatrix.map((m) => m.packets)),
    [filteredMatrix]
  );

  const getCell = useCallback(
    (srcIp: string, dstIp: string) => filteredMatrix.find((m) => m.sourceIp === srcIp && m.destIp === dstIp),
    [filteredMatrix]
  );

  // Detect asymmetric
  const isAsymmetric = useCallback(
    (srcIp: string, dstIp: string) => {
      const forward = filteredMatrix.find((m) => m.sourceIp === srcIp && m.destIp === dstIp);
      const reverse = filteredMatrix.find((m) => m.sourceIp === dstIp && m.destIp === srcIp);
      return (forward && !reverse) || (!forward && reverse);
    },
    [filteredMatrix]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-xs text-content-secondary">Protocol:</label>
        <select
          value={protocolFilter}
          onChange={(e) => setProtocolFilter(e.target.value)}
          className="rounded-md border border-border-default bg-surface-hover px-2 py-1 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="all">All Protocols</option>
          {ALL_PROTOCOLS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-content-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-accent/60" />
            High traffic
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-accent/20" />
            Low traffic
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-amber-400" />
            Asymmetric
          </span>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 text-content-tertiary font-mono text-[10px] sticky left-0 bg-surface-card z-10">Src \ Dst</th>
              {ips.map((ip) => (
                <th key={ip} className="p-1.5 text-content-tertiary font-mono text-[10px] min-w-[80px] writing-mode-vertical" style={{ writingMode: 'vertical-lr' }}>
                  {ip}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ips.map((srcIp, rowIdx) => (
              <tr key={srcIp}>
                <td className="p-1.5 text-content-secondary font-mono text-[10px] whitespace-nowrap sticky left-0 bg-surface-card z-10 border-r border-border-default">
                  {srcIp}
                </td>
                {ips.map((dstIp, colIdx) => {
                  const cell = getCell(srcIp, dstIp);
                  const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                  const asymmetric = cell ? isAsymmetric(srcIp, dstIp) : false;
                  const intensity = cell ? cell.packets / maxPackets : 0;
                  return (
                    <td
                      key={dstIp}
                      className="p-0 relative"
                      onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className={cn(
                          'h-10 w-full min-w-[80px] flex items-center justify-center text-[10px] transition-all',
                          srcIp === dstIp && 'bg-surface-hover/50',
                          cell && 'cursor-pointer',
                          asymmetric && 'ring-1 ring-inset ring-amber-400/60',
                        )}
                        style={cell ? { backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.6})` } : undefined}
                      >
                        {cell ? (
                          <span className="font-mono text-content-primary">{cell.packets.toLocaleString()}</span>
                        ) : srcIp === dstIp ? (
                          <span className="text-content-muted">--</span>
                        ) : null}
                      </div>
                      {/* Tooltip */}
                      {isHovered && cell && (
                        <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 rounded-md border border-border-default bg-surface-card p-2 shadow-lg pointer-events-none">
                          <p className="font-mono text-content-primary">{srcIp} &rarr; {dstIp}</p>
                          <p className="text-content-secondary mt-0.5">Protocol: {cell.protocol}</p>
                          <p className="text-content-secondary">Packets: {cell.packets.toLocaleString()}</p>
                          <p className="text-content-secondary">Bytes: {(cell.bytes / 1024).toFixed(1)} KB</p>
                          {asymmetric && (
                            <p className="text-amber-400 mt-0.5 font-semibold">Asymmetric communication</p>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline View
// ---------------------------------------------------------------------------

function TimelineView() {
  const [progress, setProgress] = useState(100); // 0-100
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timeRange = useMemo(() => {
    const timestamps = TIMELINE_EVENTS.map((e) => new Date(e.timestamp).getTime());
    return { min: Math.min(...timestamps), max: Math.max(...timestamps) };
  }, []);

  const currentTime = useMemo(() => {
    return timeRange.min + (progress / 100) * (timeRange.max - timeRange.min);
  }, [progress, timeRange]);

  const visibleEvents = useMemo(() => {
    return TIMELINE_EVENTS.filter((e) => new Date(e.timestamp).getTime() <= currentTime);
  }, [currentTime]);

  const visibleNodeCount = visibleEvents.filter((e) => e.type === 'node_discovered').length;
  const visibleEdgeCount = visibleEvents.filter((e) => e.type === 'edge_established').length;

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return Math.min(100, prev + 0.5 * speed);
        });
      }, 50);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed]);

  const handlePlayPause = useCallback(() => {
    if (progress >= 100) setProgress(0);
    setIsPlaying((p) => !p);
  }, [progress]);

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-md border border-border-default bg-surface-hover/30 px-3 py-2 text-center">
          <p className="text-lg font-bold text-content-primary">{visibleNodeCount}</p>
          <p className="text-[10px] text-content-tertiary">Nodes Discovered</p>
        </div>
        <div className="rounded-md border border-border-default bg-surface-hover/30 px-3 py-2 text-center">
          <p className="text-lg font-bold text-content-primary">{visibleEdgeCount}</p>
          <p className="text-[10px] text-content-tertiary">Connections</p>
        </div>
        <div className="rounded-md border border-border-default bg-surface-hover/30 px-3 py-2 text-center">
          <p className="text-lg font-bold text-content-primary">{TOPO_NODES.length}</p>
          <p className="text-[10px] text-content-tertiary">Total Nodes</p>
        </div>
        <div className="rounded-md border border-border-default bg-surface-hover/30 px-3 py-2 text-center">
          <p className="text-lg font-bold text-accent">{Math.round(progress)}%</p>
          <p className="text-[10px] text-content-tertiary">Capture Analyzed</p>
        </div>
      </div>

      {/* Event Log */}
      <Card>
        <CardHeader title="Discovery Timeline" action={<Badge variant="info">{visibleEvents.length} events</Badge>} />
        <CardContent className="p-0 max-h-[360px] overflow-y-auto">
          <div className="relative pl-8 py-3">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border-default" />

            {visibleEvents.map((event) => (
              <div key={event.id} className="relative mb-3 last:mb-0">
                {/* Dot */}
                <div
                  className={cn(
                    'absolute left-[-22px] top-1 h-3 w-3 rounded-full border-2',
                    event.type === 'node_discovered'
                      ? 'bg-cyan-400 border-cyan-400/30'
                      : 'bg-violet-400 border-violet-400/30'
                  )}
                />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-content-primary">{event.label}</p>
                    <p className="text-[10px] text-content-muted mt-0.5">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={event.type === 'node_discovered' ? 'info' : 'outline'}>
                    {event.type === 'node_discovered' ? 'Node' : 'Edge'}
                  </Badge>
                </div>
              </div>
            ))}

            {visibleEvents.length === 0 && (
              <p className="text-xs text-content-muted text-center py-4">
                Press play to begin timeline playback
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="rounded-lg border border-border-default bg-surface-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayPause}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <div className="flex items-center gap-1.5">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-medium rounded',
                  speed === s ? 'bg-accent/20 text-accent' : 'text-content-tertiary hover:text-content-primary'
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="flex-1 mx-3">
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              onChange={(e) => {
                setProgress(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-accent bg-surface-hover"
            />
          </div>

          <span className="text-xs font-mono text-content-secondary min-w-[48px] text-right">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 w-full rounded-full bg-surface-hover overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NetworkTopology() {
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<TopoNode | null>(null);

  useEffect(() => {
    fetchTopologyData().then((ok) => {
      setHasData(ok);
      setLoading(false);
    });
  }, []);

  // Filters
  const [protocolFilters, setProtocolFilters] = useState<Set<string>>(new Set());
  const [levelFilters, setLevelFilters] = useState<Set<string>>(new Set());
  const [subnetFilters, setSubnetFilters] = useState<Set<string>>(new Set());

  const toggleFilter = useCallback((_set: Set<string>, item: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setProtocolFilters(new Set());
    setLevelFilters(new Set());
    setSubnetFilters(new Set());
  }, []);

  // Stats
  const totalNodes = TOPO_NODES.length;
  const totalEdges = ALL_EDGES.length;
  const totalSubnets = ALL_SUBNETS.length;

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(2, z + 0.15)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.4, z - 0.15)), []);
  const handleFit = useCallback(() => setZoom(1), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setSearchQuery('');
    clearAllFilters();
    setSelectedNode(null);
  }, [clearAllFilters]);
  const handleExport = useCallback(() => {
    // Placeholder: in production, would use html-to-image or canvas export
    alert('Export to PNG: functionality available when Cytoscape.js is integrated');
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
            <Network className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Network Topology</h1>
            <p className="text-xs text-content-secondary">ICS/SCADA network topology visualization and analysis</p>
          </div>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-12 text-center">
          <Network className="mx-auto h-12 w-12 text-content-tertiary mb-4" />
          <h2 className="text-lg font-semibold text-content-primary mb-2">No Topology Data</h2>
          <p className="text-sm text-content-secondary mb-4">Upload a PCAP file to discover network topology.</p>
          <a href="/pcap" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">Go to PCAP Analysis</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <Network className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Network Topology</h1>
          <p className="text-xs text-content-secondary">
            ICS/SCADA network topology visualization and analysis
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Server size={20} />} label="Network Nodes" value={totalNodes} />
        <StatCard icon={<ArrowRightLeft size={20} />} label="Connections" value={totalEdges} />
        <StatCard icon={<Layers size={20} />} label="Subnets Discovered" value={totalSubnets} />
        <StatCard icon={<Network size={20} />} label="ICS Protocols" value={ALL_PROTOCOLS.length} />
      </div>

      {/* Tabbed Topology Views */}
      <Tabs defaultValue="logical">
        <TabList>
          <Tab value="logical">
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Logical View
            </span>
          </Tab>
          <Tab value="physical">
            <span className="flex items-center gap-1.5">
              <MonitorDot className="h-3.5 w-3.5" />
              Physical View
            </span>
          </Tab>
          <Tab value="mesh">
            <span className="flex items-center gap-1.5">
              <Grid3X3 className="h-3.5 w-3.5" />
              Mesh View
            </span>
          </Tab>
          <Tab value="timeline">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Timeline View
            </span>
          </Tab>
        </TabList>

        <TabPanel value="logical" className="py-0">
          <Card className="overflow-hidden">
            <Toolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFit={handleFit}
              onReset={handleReset}
              onExport={handleExport}
            />
            <div className="flex">
              <FilterSidebar
                protocolFilters={protocolFilters}
                levelFilters={levelFilters}
                subnetFilters={subnetFilters}
                onToggleProtocol={(p) => toggleFilter(protocolFilters, p, setProtocolFilters)}
                onToggleLevel={(l) => toggleFilter(levelFilters, l, setLevelFilters)}
                onToggleSubnet={(s) => toggleFilter(subnetFilters, s, setSubnetFilters)}
                onClearAll={clearAllFilters}
              />
              <div className="flex-1 overflow-auto">
                <LogicalView
                  searchQuery={searchQuery}
                  zoom={zoom}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                  protocolFilters={protocolFilters}
                  levelFilters={levelFilters}
                  subnetFilters={subnetFilters}
                />
              </div>
            </div>
          </Card>
        </TabPanel>

        <TabPanel value="physical" className="py-0">
          <Card className="overflow-hidden">
            <Toolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFit={handleFit}
              onReset={handleReset}
              onExport={handleExport}
            />
            <PhysicalView searchQuery={searchQuery} />
          </Card>
        </TabPanel>

        <TabPanel value="mesh" className="py-0">
          <Card className="overflow-hidden">
            <Toolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFit={handleFit}
              onReset={handleReset}
              onExport={handleExport}
            />
            <MeshView searchQuery={searchQuery} />
          </Card>
        </TabPanel>

        <TabPanel value="timeline" className="py-0">
          <Card className="overflow-hidden">
            <TimelineView />
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
}
