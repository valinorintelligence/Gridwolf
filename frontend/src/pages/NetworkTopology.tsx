import { useMemo } from 'react';
import { Network, Server, ArrowRightLeft, Layers } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ObjectCard } from '@/components/ontology/ObjectCard';
import { MOCK_OBJECTS } from '@/data/mock';
import { PURDUE_LEVELS } from '@/lib/constants';
import { cn } from '@/lib/cn';

const LEVEL_COLORS: Record<string, string> = {
  L0: '#ef4444',
  L1: '#f97316',
  L2: '#eab308',
  L3: '#22c55e',
  DMZ: '#8b5cf6',
  L4: '#3b82f6',
  L5: '#06b6d4',
};

export default function NetworkTopology() {
  const hosts = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-host'),
    []
  );

  const flows = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-flow'),
    []
  );

  const protocols = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-protocol'),
    []
  );

  // Group hosts by purdue level
  const hostsByLevel = useMemo(() => {
    const groups: Record<string, typeof hosts> = {};
    for (const host of hosts) {
      const level = String(host.properties.purdueLevel ?? 'Unknown');
      (groups[level] ??= []).push(host);
    }
    return groups;
  }, [hosts]);

  // Flow stats
  const totalBytes = useMemo(
    () => flows.reduce((sum, f) => sum + Number(f.properties.bytes ?? 0), 0),
    [flows]
  );
  const totalPackets = useMemo(
    () => flows.reduce((sum, f) => sum + Number(f.properties.packets ?? 0), 0),
    [flows]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <Network className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Network Topology</h1>
          <p className="text-xs text-content-secondary">
            ICS/SCADA Purdue Model network visualization
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Server size={20} />}
          label="Network Hosts"
          value={hosts.length}
        />
        <StatCard
          icon={<ArrowRightLeft size={20} />}
          label="Active Flows"
          value={flows.length}
        />
        <StatCard
          icon={<Layers size={20} />}
          label="ICS Protocols"
          value={protocols.length}
        />
        <StatCard
          icon={<Network size={20} />}
          label="Total Traffic"
          value={`${(totalBytes / (1024 * 1024)).toFixed(1)} MB`}
        />
      </div>

      {/* Flow stats detail */}
      <Card>
        <CardHeader title="Network Flow Summary" />
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-content-primary">{flows.length}</p>
              <p className="text-xs text-content-secondary">Active Flows</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">
                {totalPackets.toLocaleString()}
              </p>
              <p className="text-xs text-content-secondary">Total Packets</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">
                {(totalBytes / (1024 * 1024)).toFixed(2)} MB
              </p>
              <p className="text-xs text-content-secondary">Total Bytes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purdue Model Levels */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-content-primary">
          Purdue Model Hierarchy
        </h2>

        {PURDUE_LEVELS.map((pLevel) => {
          const levelKey =
            pLevel.level === 3.5 ? 'DMZ' : `L${pLevel.level}`;
          const levelHosts = hostsByLevel[levelKey] ?? [];

          return (
            <Card
              key={pLevel.level}
              accentColor={LEVEL_COLORS[levelKey] ?? '#6b7280'}
            >
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: LEVEL_COLORS[levelKey] ?? '#6b7280' }}
                    />
                    {pLevel.name}
                  </span>
                }
                action={
                  <Badge variant="info">{levelHosts.length} host{levelHosts.length !== 1 ? 's' : ''}</Badge>
                }
              />
              <CardContent>
                {levelHosts.length === 0 ? (
                  <p className="text-xs text-content-muted">No hosts at this level</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {levelHosts.map((host) => (
                      <ObjectCard key={host.id} object={host} compact />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Protocols */}
      <Card>
        <CardHeader title="ICS Protocols Observed" />
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {protocols.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-border-default bg-surface-hover px-3 py-2"
              >
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span className="text-sm font-medium text-content-primary">
                  {p.title}
                </span>
                <span className="text-xs text-content-tertiary">
                  Port {String(p.properties.port)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
