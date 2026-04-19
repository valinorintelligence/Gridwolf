import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Copy, Trash2, Plus, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { api } from '@/services/api';

interface APIKey {
  id: string;
  name: string;
  prefix: string;
  environment: string;
  permissions: string;
  created_at: string;
  last_used_at: string | null;
  status: 'active' | 'revoked';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().split('T')[0]; } catch { return iso; }
}

function ToggleSwitch({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      onClick={onChange}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer"
      style={{ backgroundColor: enabled ? 'var(--color-accent)' : 'var(--color-border)' }}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-4' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border-default last:border-0">
      <div>
        <p className="text-sm font-medium text-content-primary">{label}</p>
        {description && <p className="text-xs text-content-secondary mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </div>
  );
}

export default function Settings() {
  const [orgName, setOrgName] = useState('ACME Industrial Corp');
  const [darkMode, setDarkMode] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [twoFA, setTwoFA] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [slackNotifs, setSlackNotifs] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live');
  const [newKeyPerms, setNewKeyPerms] = useState<'read' | 'write' | 'admin'>('read');
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const loadKeys = async () => {
    setKeysLoading(true);
    setKeysError(null);
    try {
      const { data } = await api.get<APIKey[]>('/api-keys');
      setApiKeys(data);
    } catch (e: any) {
      setKeysError(e?.response?.data?.detail || 'Failed to load API keys');
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => { loadKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/api-keys', {
        name: newKeyName.trim(),
        environment: newKeyEnv,
        permissions: newKeyPerms,
      });
      setFreshToken(data.token);
      setNewKeyName('');
      await loadKeys();
    } catch (e: any) {
      setKeysError(e?.response?.data?.detail || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await api.delete(`/api-keys/${id}`);
      await loadKeys();
    } catch (e: any) {
      setKeysError(e?.response?.data?.detail || 'Failed to revoke key');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-500/15 text-gray-400">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Settings</h1>
          <p className="text-sm text-content-secondary">Manage your organization, security, notifications, and API access</p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabList>
          <Tab value="general">General</Tab>
          <Tab value="security">Security</Tab>
          <Tab value="notifications">Notifications</Tab>
          <Tab value="api-keys">API Keys</Tab>
        </TabList>

        {/* General */}
        <TabPanel value="general">
          <Card>
            <CardHeader title="General Settings" />
            <CardContent>
              <SettingRow label="Organization Name" description="Your organization's display name across the platform">
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-64" inputSize="sm" />
              </SettingRow>
              <SettingRow label="Theme" description="Toggle between dark and light interface themes">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-content-secondary">{darkMode ? 'Dark' : 'Light'}</span>
                  <ToggleSwitch enabled={darkMode} onChange={() => setDarkMode(!darkMode)} label="Theme toggle" />
                </div>
              </SettingRow>
              <SettingRow label="Language" description="Interface display language">
                <Select
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'es', label: 'Spanish' },
                    { value: 'fr', label: 'French' },
                    { value: 'de', label: 'German' },
                  ]}
                  value="en"
                  className="w-36"
                />
              </SettingRow>
              <SettingRow label="Time Zone" description="All timestamps will be displayed in this zone">
                <Select
                  options={[
                    { value: 'utc', label: 'UTC' },
                    { value: 'est', label: 'US Eastern' },
                    { value: 'pst', label: 'US Pacific' },
                    { value: 'cet', label: 'Central European' },
                  ]}
                  value="utc"
                  className="w-40"
                />
              </SettingRow>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Security */}
        <TabPanel value="security">
          <Card>
            <CardHeader title="Security Settings" />
            <CardContent>
              <SettingRow label="Session Timeout" description="Automatically log out after period of inactivity">
                <Select
                  options={[
                    { value: '15', label: '15 minutes' },
                    { value: '30', label: '30 minutes' },
                    { value: '60', label: '1 hour' },
                    { value: '120', label: '2 hours' },
                  ]}
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="w-36"
                />
              </SettingRow>
              <SettingRow label="Two-Factor Authentication" description="Require 2FA for all user logins">
                <div className="flex items-center gap-2">
                  <Badge variant={twoFA ? 'default' : 'outline'} dot>{twoFA ? 'Enabled' : 'Disabled'}</Badge>
                  <ToggleSwitch enabled={twoFA} onChange={() => setTwoFA(!twoFA)} label="2FA toggle" />
                </div>
              </SettingRow>
              <SettingRow label="Password Policy" description="Minimum password strength requirements">
                <Badge variant="info">Strong (12+ chars, mixed case, symbols)</Badge>
              </SettingRow>
              <SettingRow label="IP Allowlist" description="Restrict platform access to specific IP ranges">
                <Button variant="secondary" size="sm">Configure</Button>
              </SettingRow>
              <SettingRow label="Audit Logging" description="Log all administrative actions and data access">
                <Badge variant="default" dot>Active</Badge>
              </SettingRow>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Notifications */}
        <TabPanel value="notifications">
          <Card>
            <CardHeader title="Notification Preferences" />
            <CardContent>
              <SettingRow label="Email Notifications" description="Receive security alerts via email">
                <ToggleSwitch enabled={emailNotifs} onChange={() => setEmailNotifs(!emailNotifs)} label="Email notifications" />
              </SettingRow>
              <SettingRow label="Slack Notifications" description="Push alerts to connected Slack channels">
                <ToggleSwitch enabled={slackNotifs} onChange={() => setSlackNotifs(!slackNotifs)} label="Slack notifications" />
              </SettingRow>
              <SettingRow label="Critical Alerts" description="Immediate notification for critical severity findings">
                <ToggleSwitch enabled={criticalAlerts} onChange={() => setCriticalAlerts(!criticalAlerts)} label="Critical alerts" />
              </SettingRow>
              <SettingRow label="Weekly Digest" description="Weekly summary of security posture and changes">
                <ToggleSwitch enabled={weeklyDigest} onChange={() => setWeeklyDigest(!weeklyDigest)} label="Weekly digest" />
              </SettingRow>
              <SettingRow label="SLA Breach Alerts" description="Notify when vulnerabilities breach remediation SLA">
                <Badge variant="default" dot>Active</Badge>
              </SettingRow>
              <SettingRow label="Notification Channels" description="Manage email addresses and webhook endpoints">
                <Button variant="secondary" size="sm">Manage</Button>
              </SettingRow>
            </CardContent>
          </Card>
        </TabPanel>

        {/* API Keys */}
        <TabPanel value="api-keys">
          <Card>
            <CardHeader
              title="API Keys"
              action={
                <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setNewKeyModal(true)}>
                  Create Key
                </Button>
              }
            />
            <CardContent className="p-0">
              {keysError && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/30">
                  <AlertCircle className="h-3.5 w-3.5" /> {keysError}
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center text-xs text-content-tertiary py-6">Loading API keys…</TableCell></TableRow>
                  )}
                  {!keysLoading && apiKeys.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-xs text-content-tertiary py-6">No API keys yet. Click “Create Key” to issue one.</TableCell></TableRow>
                  )}
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium text-sm">{key.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-content-secondary bg-surface-hover px-2 py-0.5 rounded">{key.prefix}</code>
                          <button
                            onClick={() => navigator.clipboard?.writeText(key.prefix)}
                            className="text-content-tertiary hover:text-content-primary transition-colors"
                            title="Copy prefix"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-content-secondary">{formatDate(key.created_at)}</TableCell>
                      <TableCell className="text-xs text-content-secondary">{formatDate(key.last_used_at)}</TableCell>
                      <TableCell>
                        {key.status === 'active' ? (
                          <Badge variant="default" dot>Active</Badge>
                        ) : (
                          <Badge variant="outline">Revoked</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(key.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Revoke key"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>

      {/* New Key Modal */}
      <Modal
        isOpen={newKeyModal}
        onClose={() => { setNewKeyModal(false); setFreshToken(null); }}
        title={freshToken ? 'API Key Created' : 'Create API Key'}
        footer={
          freshToken ? (
            <Button variant="primary" size="sm" onClick={() => { setNewKeyModal(false); setFreshToken(null); }}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setNewKeyModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!newKeyName.trim() || creating}
                onClick={handleCreate}
              >
                {creating ? 'Creating…' : 'Create Key'}
              </Button>
            </>
          )
        }
      >
        {freshToken ? (
          <div className="space-y-3">
            <p className="text-sm text-content-primary">
              Copy this token now — you won’t be able to see it again.
            </p>
            <div className="flex items-center gap-2 p-3 rounded bg-surface-hover border border-border-default">
              <code className="flex-1 text-xs font-mono text-content-primary break-all">{freshToken}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(freshToken)}
                className="text-content-tertiary hover:text-content-primary"
                title="Copy token"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-red-400">
              Treat it like a password. Rotate immediately if leaked.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Key Name"
              placeholder="e.g., Production Scanner"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <Select
              label="Environment"
              value={newKeyEnv}
              onChange={(e) => setNewKeyEnv(e.target.value as 'live' | 'test')}
              options={[
                { value: 'live', label: 'Production (gw_live_)' },
                { value: 'test', label: 'Development (gw_test_)' },
              ]}
            />
            <Select
              label="Permissions"
              value={newKeyPerms}
              onChange={(e) => setNewKeyPerms(e.target.value as 'read' | 'write' | 'admin')}
              options={[
                { value: 'read', label: 'Read Only' },
                { value: 'write', label: 'Read & Write' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
            <p className="text-xs text-content-tertiary">
              The API key will be shown once after creation. Store it securely.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
