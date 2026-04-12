import { useState, useMemo, useEffect } from 'react';
import { History, Filter, Calendar } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import SearchBar from '@/components/shared/SearchBar';
import TimelineWidget from '@/components/dashboard/TimelineWidget';
import { api } from '@/services/api';

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

interface TimelineEvent {
  id: string;
  objectId: string;
  objectTitle: string;
  objectType: string;
  action: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export default function Timeline() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [objectTypeFilter, setObjectTypeFilter] = useState('all');
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [findingsRes, sessionsRes] = await Promise.all([
          api.get('/ics/findings/').catch(() => ({ data: [] })),
          api.get('/ics/sessions/').catch(() => ({ data: [] })),
        ]);
        const findings = Array.isArray(findingsRes.data) ? findingsRes.data : findingsRes.data?.results ?? [];
        const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : sessionsRes.data?.results ?? [];

        const events: TimelineEvent[] = [
          ...findings.map((f: Record<string, unknown>, i: number) => ({
            id: `finding-${f.id ?? i}`,
            objectId: String(f.id ?? ''),
            objectTitle: String(f.title ?? 'Finding'),
            objectType: String(f.finding_type ?? 'Vulnerability'),
            action: 'finding_created',
            details: { severity: f.severity },
            timestamp: String(f.created_at ?? new Date().toISOString()),
          })),
          ...sessions.map((s: Record<string, unknown>, i: number) => ({
            id: `session-${s.id ?? i}`,
            objectId: String(s.id ?? ''),
            objectTitle: String(s.name ?? 'Session'),
            objectType: 'Session',
            action: 'session_created',
            details: { device_count: s.device_count },
            timestamp: String(s.created_at ?? new Date().toISOString()),
          })),
        ];
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAllEvents(events);
      } catch {
        setAllEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return allEvents.filter((evt) => {
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (allEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <History className="h-12 w-12 text-content-muted" />
        <h2 className="mt-4 text-lg font-semibold text-content-primary">No Data Yet</h2>
        <p className="mt-1 text-sm text-content-secondary">Timeline events will appear here as findings and sessions are created.</p>
      </div>
    );
  }

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
