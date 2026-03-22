import { useState } from 'react';
import { Settings as SettingsIcon, Copy, Trash2, Plus } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

interface APIKey {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
  status: 'active' | 'revoked';
}

const API_KEYS: APIKey[] = [
  { id: 'key-001', name: 'CI/CD Pipeline', prefix: 'gw_live_4f8a...', created: '2024-09-15', lastUsed: '2024-12-18', status: 'active' },
  { id: 'key-002', name: 'Splunk Integration', prefix: 'gw_live_9c2b...', created: '2024-10-01', lastUsed: '2024-12-18', status: 'active' },
  { id: 'key-003', name: 'Development', prefix: 'gw_test_7d3e...', created: '2024-08-20', lastUsed: '2024-11-30', status: 'active' },
  { id: 'key-004', name: 'Legacy Scanner', prefix: 'gw_live_1a5f...', created: '2024-06-10', lastUsed: '2024-09-15', status: 'revoked' },
];

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
                  {API_KEYS.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium text-sm">{key.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-content-secondary bg-surface-hover px-2 py-0.5 rounded">{key.prefix}</code>
                          <button className="text-content-tertiary hover:text-content-primary transition-colors">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-content-secondary">{key.created}</TableCell>
                      <TableCell className="text-xs text-content-secondary">{key.lastUsed}</TableCell>
                      <TableCell>
                        {key.status === 'active' ? (
                          <Badge variant="default" dot>Active</Badge>
                        ) : (
                          <Badge variant="outline">Revoked</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.status === 'active' && (
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
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
        onClose={() => setNewKeyModal(false)}
        title="Create API Key"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setNewKeyModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!newKeyName.trim()} onClick={() => { setNewKeyName(''); setNewKeyModal(false); }}>
              Create Key
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Key Name"
            placeholder="e.g., Production Scanner"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <Select
            label="Environment"
            options={[
              { value: 'live', label: 'Production (gw_live_)' },
              { value: 'test', label: 'Development (gw_test_)' },
            ]}
          />
          <Select
            label="Permissions"
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
      </Modal>
    </div>
  );
}
