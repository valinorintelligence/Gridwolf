import { useState, useMemo } from 'react';
import { Server, Monitor, Cpu, Shield } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import StatCard from '@/components/dashboard/StatCard';
import SearchBar from '@/components/shared/SearchBar';
import { ObjectTable } from '@/components/ontology/ObjectTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MOCK_OBJECTS, OBJECT_TYPE_DEFINITIONS } from '@/data/mock';
// import { SEVERITY_ORDER } from '@/lib/constants';

export default function AssetInventory() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const hosts = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-host'),
    []
  );

  const products = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-product'),
    []
  );

  const scanners = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-scanner'),
    []
  );

  const components = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-component'),
    []
  );

  const hostTypeDef = useMemo(
    () => OBJECT_TYPE_DEFINITIONS.find((t) => t.id === 'type-host'),
    []
  );

  // Filter hosts
  const filteredHosts = useMemo(() => {
    let result = hosts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          String(h.properties.ip ?? '').toLowerCase().includes(q) ||
          String(h.properties.hostname ?? '').toLowerCase().includes(q) ||
          String(h.properties.vendor ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((h) => h.status === statusFilter);
    }
    return result;
  }, [hosts, search, statusFilter]);

  // Count by vendor
  const vendorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const host of hosts) {
      const vendor = String(host.properties.vendor ?? 'Unknown');
      counts[vendor] = (counts[vendor] ?? 0) + 1;
    }
    return counts;
  }, [hosts]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <Server className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Asset Inventory</h1>
          <p className="text-xs text-content-secondary">
            Comprehensive view of all managed assets
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Server size={20} />}
          label="Hosts"
          value={hosts.length}
          trend={{ value: 2, direction: 'up' }}
        />
        <StatCard
          icon={<Monitor size={20} />}
          label="Products"
          value={products.length}
        />
        <StatCard
          icon={<Cpu size={20} />}
          label="Components"
          value={components.length}
        />
        <StatCard
          icon={<Shield size={20} />}
          label="Scanners"
          value={scanners.length}
        />
      </div>

      {/* Vendor breakdown */}
      <Card>
        <CardHeader title="Assets by Vendor" />
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(vendorCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([vendor, count]) => (
                <div
                  key={vendor}
                  className="flex items-center gap-2 rounded-md border border-border-default bg-surface-hover px-3 py-1.5"
                >
                  <span className="text-sm font-medium text-content-primary">{vendor}</span>
                  <Badge variant="info">{count}</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-2.5">
          <SearchBar
            placeholder="Search hosts by name, IP, hostname, or vendor..."
            onSearch={setSearch}
            className="flex-1 min-w-[200px]"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-secondary">Status:</span>
            {['all', 'active', 'resolved', 'mitigated'].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Host Table */}
      <Card>
        <CardHeader
          title="Host Assets"
          action={
            <span className="text-xs text-content-tertiary">
              {filteredHosts.length} of {hosts.length} hosts
            </span>
          }
        />
        <CardContent className="p-0">
          <ObjectTable
            objects={filteredHosts}
            typeDefinition={hostTypeDef}
          />
        </CardContent>
      </Card>
    </div>
  );
}
