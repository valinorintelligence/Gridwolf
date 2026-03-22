import { useState, useMemo } from 'react';
import { Component, GitBranch, Scale, AlertTriangle, ChevronRight, ChevronDown, Package } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import SearchBar from '@/components/shared/SearchBar';
import ChartWidget from '@/components/dashboard/ChartWidget';
import StatCard from '@/components/dashboard/StatCard';
import { MOCK_OBJECTS, MOCK_LINKS } from '@/data/mock';
import { cn } from '@/lib/cn';

const components = MOCK_OBJECTS.filter((o) => o.typeId === 'type-component');

const licenseData = (() => {
  const counts: Record<string, number> = {};
  for (const c of components) {
    const lic = (c.properties.license as string) || 'Unknown';
    counts[lic] = (counts[lic] || 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
})();

const licenseColors = [
  { key: 'value', color: '#14b8a6' },
  { key: 'value', color: '#3b82f6' },
  { key: 'value', color: '#8b5cf6' },
  { key: 'value', color: '#f59e0b' },
];

interface DepNode {
  id: string;
  title: string;
  children: DepNode[];
}

function buildTree(): DepNode[] {
  const products = MOCK_OBJECTS.filter((o) => o.typeId === 'type-product');
  return products.map((prod) => {
    const depLinks = MOCK_LINKS.filter((l) => l.sourceId === prod.id && l.linkType === 'DEPENDS_ON');
    const children: DepNode[] = depLinks
      .map((link) => {
        const comp = MOCK_OBJECTS.find((o) => o.id === link.targetId);
        return comp ? { id: comp.id, title: `${comp.properties.packageName}@${comp.properties.version}`, children: [] } : null;
      })
      .filter(Boolean) as DepNode[];
    return { id: prod.id, title: prod.title, children };
  });
}

function TreeNode({ node, depth = 0 }: { node: DepNode; depth?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-hover/50 cursor-pointer text-sm',
          depth === 0 ? 'text-content-primary font-medium' : 'text-content-secondary'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => setOpen(!open)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-content-tertiary" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
        ) : (
          <span className="w-3.5" />
        )}
        {depth === 0 ? <Package className="h-3.5 w-3.5 shrink-0 text-accent" /> : <Component className="h-3.5 w-3.5 shrink-0 text-teal-400" />}
        <span className="truncate">{node.title}</span>
      </div>
      {open && hasChildren && node.children.map((child) => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  );
}

export default function SBOM() {
  const [search, setSearch] = useState('');
  const tree = useMemo(() => buildTree(), []);

  const filtered = useMemo(() => {
    if (!search) return components;
    const q = search.toLowerCase();
    return components.filter(
      (c) =>
        (c.properties.packageName as string).toLowerCase().includes(q) ||
        (c.properties.license as string)?.toLowerCase().includes(q)
    );
  }, [search]);

  const vulnCount = components.filter((c) => c.properties.isVulnerable).length;
  const ecosystems = new Set(components.map((c) => c.properties.ecosystem as string));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-400">
            <Component className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Software Bill of Materials</h1>
            <p className="text-sm text-content-secondary">Component inventory, licenses, and dependency analysis</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<GitBranch className="h-4 w-4" />}>
          Export SBOM
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Component className="h-5 w-5" />} label="Total Components" value={components.length} />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Vulnerable" value={vulnCount} severity="critical" />
        <StatCard icon={<Scale className="h-5 w-5" />} label="License Types" value={licenseData.length} />
        <StatCard icon={<Package className="h-5 w-5" />} label="Ecosystems" value={ecosystems.size} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Component Table */}
        <div className="col-span-8">
          <Card>
            <CardHeader
              title="Components"
              action={<SearchBar placeholder="Search components..." onSearch={setSearch} className="w-56" />}
            />
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Ecosystem</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium font-mono text-xs">{comp.properties.packageName as string}</TableCell>
                      <TableCell className="font-mono text-xs text-content-secondary">{comp.properties.version as string}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{comp.properties.ecosystem as string}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="info">{comp.properties.license as string}</Badge>
                      </TableCell>
                      <TableCell>
                        {comp.properties.isVulnerable ? (
                          <Badge variant="critical" dot>Vulnerable</Badge>
                        ) : (
                          <Badge variant="low" dot>Clean</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-content-secondary">
                        No components match your search
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* License Distribution */}
        <div className="col-span-4 space-y-4">
          <ChartWidget
            type="donut"
            title="License Distribution"
            data={licenseData}
            dataKeys={licenseColors}
            height={220}
          />

          {/* Dependency Tree */}
          <Card>
            <CardHeader title="Dependency Tree" />
            <CardContent className="max-h-[300px] overflow-y-auto p-0">
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
