import { useState, useMemo } from 'react';
import { History, Filter, Calendar } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import SearchBar from '@/components/shared/SearchBar';
import TimelineWidget from '@/components/dashboard/TimelineWidget';
import { MOCK_DASHBOARD_STATS } from '@/data/mock';

const ALL_EVENTS = [
  ...MOCK_DASHBOARD_STATS.recentEvents,
  { id: 'evt-006', objectId: 'cc-002', objectTitle: 'NIST 800-82 - Access Control', objectType: 'ComplianceControl', action: 'compliance_check_failed', details: { framework: 'NIST-800-82' }, timestamp: '2024-12-14T10:00:00Z' },
  { id: 'evt-007', objectId: 'h-001', objectTitle: 'PLC-SIEMENS-01', objectType: 'Host', action: 'scan_initiated', details: { scanner: 'Nessus' }, timestamp: '2024-12-13T22:00:00Z' },
  { id: 'evt-008', objectId: 'v-007', objectTitle: 'Weak TLS Configuration on SCADA Server', objectType: 'Vulnerability', action: 'status_changed', details: { from: 'active', to: 'mitigated' }, timestamp: '2024-12-12T15:00:00Z' },
  { id: 'evt-009', objectId: 'u-001', objectTitle: 'jchen (OT Admin)', objectType: 'Identity', action: 'login', details: { source: '10.1.3.15' }, timestamp: '2024-12-12T08:30:00Z' },
  { id: 'evt-010', objectId: 'sc-002', objectTitle: 'Trivy SCA', objectType: 'Scanner', action: 'scan_completed', details: { findings: 128 }, timestamp: '2024-12-11T04:00:00Z' },
  { id: 'evt-011', objectId: 'ap-002', objectTitle: 'Compromised EWS - Historian Data Exfil', objectType: 'AttackPath', action: 'risk_recalculated', details: { previousScore: 72, newScore: 78 }, timestamp: '2024-12-10T09:00:00Z' },
  { id: 'evt-012', objectId: 'cmp-001', objectTitle: 'lodash', objectType: 'Component', action: 'vulnerability_detected', details: { cve: 'CVE-2024-38876' }, timestamp: '2024-12-09T16:30:00Z' },
  { id: 'evt-013', objectId: 'h-006', objectTitle: 'FIREWALL-DMZ-01', objectType: 'Host', action: 'config_changed', details: { field: 'ACL rules' }, timestamp: '2024-12-08T11:00:00Z' },
  { id: 'evt-014', objectId: 'v-006', objectTitle: 'Outdated OpenSSL on Engineering Workstation', objectType: 'Vulnerability', action: 'assigned', details: { assignee: 'asmith' }, timestamp: '2024-12-07T09:15:00Z' },
  { id: 'evt-015', objectId: 'pr-001', objectTitle: 'SCADA HMI Platform', objectType: 'Product', action: 'updated', details: { field: 'version' }, timestamp: '2024-12-06T14:00:00Z' },
];

const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'scan_completed', label: 'Scan Completed' },
  { value: 'risk_recalculated', label: 'Risk Recalculated' },
  { value: 'login', label: 'Login' },
  { value: 'assigned', label: 'Assigned' },
];

const OBJECT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'Vulnerability', label: 'Vulnerability' },
  { value: 'Host', label: 'Host' },
  { value: 'Scanner', label: 'Scanner' },
  { value: 'AttackPath', label: 'Attack Path' },
  { value: 'ComplianceControl', label: 'Compliance' },
  { value: 'Identity', label: 'Identity' },
  { value: 'Component', label: 'Component' },
  { value: 'Product', label: 'Product' },
];

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDetails(details?: Record<string, unknown>): string {
  if (!details) return '';
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

export default function Timeline() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [objectTypeFilter, setObjectTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    return ALL_EVENTS.filter((evt) => {
      if (typeFilter !== 'all' && evt.action !== typeFilter) return false;
      if (objectTypeFilter !== 'all' && evt.objectType !== objectTypeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(evt.objectTitle ?? '').toLowerCase().includes(q) && !evt.action.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, typeFilter, objectTypeFilter]);

  const timelineEvents = filtered.map((evt) => ({
    id: evt.id,
    timestamp: evt.timestamp,
    action: formatAction(evt.action),
    objectType: (evt.objectType ?? '').toLowerCase(),
    objectTitle: evt.objectTitle ?? '',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Event Timeline</h1>
          <p className="text-sm text-content-secondary">Audit log of all security events, changes, and system actions</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-content-secondary shrink-0" />
            <SearchBar placeholder="Search events..." onSearch={setSearch} className="flex-1 max-w-xs" />
            <Select
              options={EVENT_TYPES}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-44"
            />
            <Select
              options={OBJECT_TYPES}
              value={objectTypeFilter}
              onChange={(e) => setObjectTypeFilter(e.target.value)}
              className="w-44"
            />
            <div className="ml-auto text-xs text-content-secondary">
              {filtered.length} events
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* Timeline Widget */}
        <div className="col-span-5">
          <TimelineWidget events={timelineEvents} maxEvents={15} />
        </div>

        {/* Detail Table */}
        <div className="col-span-7">
          <Card>
            <CardHeader title="Event Details" />
            <CardContent className="p-0">
              <div className="divide-y divide-border-default max-h-[600px] overflow-y-auto">
                {filtered.map((evt) => (
                  <div key={evt.id} className="px-4 py-3 hover:bg-surface-hover/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{evt.objectType}</Badge>
                          <span className="text-sm font-medium text-content-primary truncate">{evt.objectTitle}</span>
                        </div>
                        <p className="text-sm text-content-secondary">
                          <span className="font-medium text-accent">{formatAction(evt.action)}</span>
                          {evt.details && (
                            <span className="ml-2 text-content-tertiary">{formatDetails(evt.details as Record<string, unknown>)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Calendar className="h-3.5 w-3.5 text-content-tertiary" />
                        <span className="text-xs text-content-secondary whitespace-nowrap">{formatTimestamp(evt.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-sm text-content-secondary">No events match the current filters</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
