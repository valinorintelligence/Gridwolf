import { useState } from 'react';
import { Puzzle, Settings, Plus, Check, X, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import SearchBar from '@/components/shared/SearchBar';
import { cn } from '@/lib/cn';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error';
  icon: string;
  lastSync?: string;
  eventsToday?: number;
}

const INTEGRATIONS: Integration[] = [
  { id: 'int-001', name: 'Jira', description: 'Issue tracking and project management', category: 'Ticketing', status: 'connected', icon: 'JR', lastSync: '2 min ago', eventsToday: 14 },
  { id: 'int-002', name: 'Slack', description: 'Team messaging and alert notifications', category: 'Notifications', status: 'connected', icon: 'SL', lastSync: '1 min ago', eventsToday: 42 },
  { id: 'int-003', name: 'Splunk', description: 'SIEM log aggregation and correlation', category: 'SIEM', status: 'connected', icon: 'SP', lastSync: '5 min ago', eventsToday: 1284 },
  { id: 'int-004', name: 'ServiceNow', description: 'IT service management and workflows', category: 'ITSM', status: 'disconnected', icon: 'SN' },
  { id: 'int-005', name: 'PagerDuty', description: 'Incident response and on-call management', category: 'Incident Response', status: 'connected', icon: 'PD', lastSync: '3 min ago', eventsToday: 3 },
  { id: 'int-006', name: 'Microsoft Teams', description: 'Team collaboration and notifications', category: 'Notifications', status: 'disconnected', icon: 'MT' },
  { id: 'int-007', name: 'GitHub', description: 'Source code management and CI/CD', category: 'DevOps', status: 'connected', icon: 'GH', lastSync: '1 min ago', eventsToday: 67 },
  { id: 'int-008', name: 'AWS Security Hub', description: 'Cloud security posture management', category: 'Cloud', status: 'error', icon: 'AW', lastSync: 'Failed' },
  { id: 'int-009', name: 'Tenable.io', description: 'Vulnerability management platform', category: 'Scanning', status: 'connected', icon: 'TN', lastSync: '15 min ago', eventsToday: 86 },
  { id: 'int-010', name: 'CrowdStrike', description: 'Endpoint detection and response', category: 'EDR', status: 'disconnected', icon: 'CS' },
  { id: 'int-011', name: 'Okta', description: 'Identity and access management', category: 'IAM', status: 'connected', icon: 'OK', lastSync: '8 min ago', eventsToday: 156 },
  { id: 'int-012', name: 'Datadog', description: 'Infrastructure monitoring and APM', category: 'Monitoring', status: 'disconnected', icon: 'DD' },
];

const statusStyles: Record<string, { dot: string; text: string; label: string }> = {
  connected: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Connected' },
  disconnected: { dot: 'bg-gray-400', text: 'text-gray-400', label: 'Disconnected' },
  error: { dot: 'bg-red-400', text: 'text-red-400', label: 'Error' },
};

const iconBgColors: Record<string, string> = {
  JR: 'bg-blue-500/20 text-blue-400',
  SL: 'bg-purple-500/20 text-purple-400',
  SP: 'bg-green-500/20 text-green-400',
  SN: 'bg-teal-500/20 text-teal-400',
  PD: 'bg-emerald-500/20 text-emerald-400',
  MT: 'bg-indigo-500/20 text-indigo-400',
  GH: 'bg-gray-500/20 text-gray-300',
  AW: 'bg-orange-500/20 text-orange-400',
  TN: 'bg-cyan-500/20 text-cyan-400',
  CS: 'bg-red-500/20 text-red-400',
  OK: 'bg-blue-500/20 text-blue-400',
  DD: 'bg-violet-500/20 text-violet-400',
};

export default function Integrations() {
  const [search, setSearch] = useState('');
  const [configModal, setConfigModal] = useState<Integration | null>(null);

  const filtered = search
    ? INTEGRATIONS.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()))
    : INTEGRATIONS;

  const connectedCount = INTEGRATIONS.filter((i) => i.status === 'connected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
            <Puzzle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Integrations</h1>
            <p className="text-sm text-content-secondary">
              {connectedCount} of {INTEGRATIONS.length} integrations connected
            </p>
          </div>
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />}>
          Add Integration
        </Button>
      </div>

      <SearchBar placeholder="Search integrations..." onSearch={setSearch} className="max-w-md" />

      {/* Integration Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((integration) => {
          const st = statusStyles[integration.status];
          return (
            <Card key={integration.id} className="hover:border-border-hover transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold', iconBgColors[integration.icon] || 'bg-gray-500/20 text-gray-400')}>
                      {integration.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-content-primary">{integration.name}</h3>
                      <Badge variant="outline" className="mt-0.5">{integration.category}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', st.dot)} />
                    <span className={cn('text-xs font-medium', st.text)}>{st.label}</span>
                  </div>
                </div>

                <p className="text-xs text-content-secondary mb-3">{integration.description}</p>

                {integration.status === 'connected' && (
                  <div className="flex items-center gap-4 text-xs text-content-tertiary mb-3">
                    <span>Last sync: {integration.lastSync}</span>
                    {integration.eventsToday !== undefined && <span>{integration.eventsToday} events today</span>}
                  </div>
                )}

                {integration.status === 'error' && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400 mb-3">
                    <X className="h-3 w-3" />
                    Authentication failed. Please reconfigure.
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {integration.status === 'connected' ? (
                    <>
                      <Button variant="ghost" size="sm" icon={<Settings className="h-3.5 w-3.5" />} onClick={() => setConfigModal(integration)}>
                        Configure
                      </Button>
                      <Button variant="ghost" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />}>
                        Sync
                      </Button>
                    </>
                  ) : integration.status === 'error' ? (
                    <Button variant="danger" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />}>
                      Reconnect
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" icon={<ExternalLink className="h-3.5 w-3.5" />}>
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config Modal */}
      <Modal
        isOpen={!!configModal}
        onClose={() => setConfigModal(null)}
        title={configModal ? `Configure ${configModal.name}` : ''}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfigModal(null)}>Cancel</Button>
            <Button variant="primary" size="sm">Save Configuration</Button>
          </>
        }
      >
        {configModal && (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              Configure the {configModal.name} integration settings, webhooks, and data synchronization preferences.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border-default p-3">
                <span className="text-sm text-content-primary">Auto-sync enabled</span>
                <Badge variant="default" dot>Active</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border-default p-3">
                <span className="text-sm text-content-primary">Sync interval</span>
                <span className="text-sm text-content-secondary">Every 5 minutes</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border-default p-3">
                <span className="text-sm text-content-primary">Webhook URL</span>
                <span className="text-xs font-mono text-content-tertiary truncate max-w-[200px]">https://api.gridwolf.io/hooks/{configModal.id}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
