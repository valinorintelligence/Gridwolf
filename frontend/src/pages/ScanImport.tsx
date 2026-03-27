import { useState } from 'react';
import {
  Upload, FileUp, FileCheck, Clock, CheckCircle, XCircle, AlertCircle,
  File, Monitor, Shield, Terminal, Bug, Cpu, Radar, Eye,
  Loader2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import StatCard from '@/components/dashboard/StatCard';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PcapStage = 'upload' | 'parse_headers' | 'extract_flows' | 'identify_protocols' | 'identify_devices' | 'create_topology';
type PcapFileStatus = 'queued' | 'processing' | 'complete' | 'error';

interface PcapFile {
  id: string;
  filename: string;
  size: string;
  packets: number;
  status: PcapFileStatus;
  currentStage: PcapStage;
  stageProgress: number; // 0-100 for current stage
  results?: {
    devicesDiscovered: number;
    connectionsFound: number;
    protocolsIdentified: number;
    newDevices: number;
    knownDevices: number;
  };
}

interface ExternalToolFile {
  id: string;
  filename: string;
  size: string;
  entries?: number;
  alerts?: number;
  flows?: number;
}

interface ImportHistoryRecord {
  id: string;
  date: string;
  source: string;
  type: string;
  file: string;
  devicesAdded: number;
  findingsGenerated: number;
  status: 'completed' | 'partial' | 'failed';
}

// ---------------------------------------------------------------------------
// PCAP stages config
// ---------------------------------------------------------------------------

const PCAP_STAGES: { key: PcapStage; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'parse_headers', label: 'Parse Headers' },
  { key: 'extract_flows', label: 'Extract Flows' },
  { key: 'identify_protocols', label: 'Identify Protocols' },
  { key: 'identify_devices', label: 'Identify Devices' },
  { key: 'create_topology', label: 'Create Topology' },
];

function stageIndex(stage: PcapStage): number {
  return PCAP_STAGES.findIndex((s) => s.key === stage);
}

// ---------------------------------------------------------------------------
// Mock PCAP files
// ---------------------------------------------------------------------------

const MOCK_PCAP_FILES: PcapFile[] = [
  {
    id: 'pcap-001',
    filename: 'plant_floor_capture_20260320.pcapng',
    size: '248.6 MB',
    packets: 1_842_310,
    status: 'complete',
    currentStage: 'create_topology',
    stageProgress: 100,
    results: { devicesDiscovered: 47, connectionsFound: 312, protocolsIdentified: 8, newDevices: 12, knownDevices: 35 },
  },
  {
    id: 'pcap-002',
    filename: 'scada_dmz_tap.pcap',
    size: '89.2 MB',
    packets: 634_500,
    status: 'processing',
    currentStage: 'identify_protocols',
    stageProgress: 62,
  },
  {
    id: 'pcap-003',
    filename: 'substation_serial_20260318.pcapng',
    size: '512.1 MB',
    packets: 4_210_800,
    status: 'queued',
    currentStage: 'upload',
    stageProgress: 0,
  },
];

// ---------------------------------------------------------------------------
// Mock import history
// ---------------------------------------------------------------------------

const IMPORT_HISTORY: ImportHistoryRecord[] = [
  { id: 'hist-001', date: '2026-03-24 14:32', source: 'PCAP Import', type: 'pcapng', file: 'plant_floor_capture_20260320.pcapng', devicesAdded: 12, findingsGenerated: 34, status: 'completed' },
  { id: 'hist-002', date: '2026-03-23 09:15', source: 'Zeek', type: 'conn.log', file: 'conn.log (2026-03-22)', devicesAdded: 8, findingsGenerated: 15, status: 'completed' },
  { id: 'hist-003', date: '2026-03-22 16:48', source: 'Suricata', type: 'EVE JSON', file: 'eve-2026-03-22.json', devicesAdded: 3, findingsGenerated: 42, status: 'completed' },
  { id: 'hist-004', date: '2026-03-21 11:20', source: 'Nmap', type: 'XML', file: 'nmap_scan_subnet_10.xml', devicesAdded: 24, findingsGenerated: 0, status: 'completed' },
  { id: 'hist-005', date: '2026-03-20 08:00', source: 'PCAP Import', type: 'pcap', file: 'historian_segment.pcap', devicesAdded: 6, findingsGenerated: 18, status: 'completed' },
  { id: 'hist-006', date: '2026-03-19 13:45', source: 'Siemens SINEMA', type: 'CSV', file: 'sinema_inventory_export.csv', devicesAdded: 31, findingsGenerated: 0, status: 'completed' },
  { id: 'hist-007', date: '2026-03-18 17:30', source: 'Wazuh', type: 'JSON', file: 'wazuh_alerts_march.json', devicesAdded: 0, findingsGenerated: 67, status: 'partial' },
  { id: 'hist-008', date: '2026-03-17 10:12', source: 'Siemens TIA Portal', type: 'XML', file: 'tia_project_v18.xml', devicesAdded: 14, findingsGenerated: 5, status: 'completed' },
  { id: 'hist-009', date: '2026-03-16 22:05', source: 'Zeek', type: 'modbus.log', file: 'modbus.log (2026-03-16)', devicesAdded: 2, findingsGenerated: 9, status: 'completed' },
  { id: 'hist-010', date: '2026-03-15 07:40', source: 'Masscan', type: 'XML', file: 'masscan_full_range.xml', devicesAdded: 18, findingsGenerated: 0, status: 'failed' },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const pcapStatusConfig: Record<PcapFileStatus, { icon: React.ElementType; color: string; bg: string }> = {
  queued: { icon: Clock, color: 'text-content-secondary', bg: 'bg-surface-hover' },
  processing: { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  complete: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
};

const historyStatusConfig: Record<string, { color: string; bg: string }> = {
  completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  partial: { color: 'text-amber-400', bg: 'bg-amber-500/15' },
  failed: { color: 'text-red-400', bg: 'bg-red-500/15' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PcapStageIndicator({ file }: { file: PcapFile }) {
  const activeIdx = stageIndex(file.currentStage);
  return (
    <div className="flex items-center gap-1 mt-2">
      {PCAP_STAGES.map((stage, idx) => {
        const completed = idx < activeIdx || (idx === activeIdx && file.status === 'complete');
        const active = idx === activeIdx && file.status === 'processing';
        return (
          <div key={stage.key} className="flex-1 flex flex-col gap-1">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all',
                completed ? 'bg-emerald-500' : active ? 'bg-amber-400' : 'bg-surface-hover'
              )}
              style={active ? { width: `${file.stageProgress}%`, minWidth: '10%' } : undefined}
            />
            <span className={cn(
              'text-[9px] truncate',
              completed ? 'text-emerald-400' : active ? 'text-amber-400' : 'text-content-tertiary'
            )}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DragDropZone({
  accept,
  label,
  sublabel,
  isDragging,
  onDragState,
}: {
  accept: string;
  label: string;
  sublabel?: string;
  isDragging: boolean;
  onDragState: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer',
        isDragging
          ? 'border-accent bg-accent/5'
          : 'border-border-default hover:border-border-hover hover:bg-surface-hover/30'
      )}
      onDragOver={(e) => { e.preventDefault(); onDragState(true); }}
      onDragLeave={() => onDragState(false)}
      onDrop={(e) => { e.preventDefault(); onDragState(false); }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mb-3">
        <FileUp className={cn('h-7 w-7', isDragging ? 'text-accent' : 'text-content-tertiary')} />
      </div>
      <p className="text-sm font-medium text-content-primary mb-1">
        {isDragging ? 'Drop files here' : label}
      </p>
      <p className="text-xs text-content-secondary mb-3">{sublabel ?? `Accepts ${accept}`}</p>
      <Button variant="secondary" size="sm" icon={<Upload className="h-3.5 w-3.5" />}>
        Browse Files
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// External tool cards
// ---------------------------------------------------------------------------

interface ToolCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  formats: string;
  accept: string;
  status: 'ready' | 'connected' | 'desktop-only';
  warning?: string;
  children?: React.ReactNode;
}

function ToolCard({ name, description, icon, formats, accept, status, warning, children }: ToolCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [_files, _setFiles] = useState<ExternalToolFile[]>([]);

  const isDesktopOnly = status === 'desktop-only';

  return (
    <Card className={cn(isDesktopOnly && 'opacity-60')}>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-accent/10 text-accent shrink-0">
              {icon}
            </div>
            <span>{name}</span>
            {status === 'connected' && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected
              </span>
            )}
            {isDesktopOnly && (
              <Badge variant="info">Desktop Only</Badge>
            )}
          </div>
        }
      />
      <CardContent className="space-y-3">
        <p className="text-xs text-content-secondary">{description}</p>
        <div className="flex items-center gap-2 text-[10px] text-content-tertiary">
          <span className="font-mono bg-surface-hover px-1.5 py-0.5 rounded">{formats}</span>
          <span>accepted</span>
        </div>

        {warning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300">{warning}</p>
          </div>
        )}

        {!isDesktopOnly ? (
          <DragDropZone
            accept={accept}
            label={`Drop ${accept} files here`}
            isDragging={isDragging}
            onDragState={setIsDragging}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-border-default bg-surface-hover/30 p-6">
            <Button variant="secondary" size="sm" disabled icon={<ExternalLink className="h-3.5 w-3.5" />}>
              Open in Wireshark
            </Button>
          </div>
        )}

        {children}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ScanImport() {
  const [pcapDragging, setPcapDragging] = useState(false);
  const [pcapFiles] = useState<PcapFile[]>(MOCK_PCAP_FILES);

  const completedPcaps = pcapFiles.filter((f) => f.status === 'complete').length;
  const totalDevices = pcapFiles.reduce((sum, f) => sum + (f.results?.devicesDiscovered ?? 0), 0);
  const totalConnections = pcapFiles.reduce((sum, f) => sum + (f.results?.connectionsFound ?? 0), 0);
  const totalImports = IMPORT_HISTORY.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Import Hub</h1>
          <p className="text-sm text-content-secondary">Import PCAP captures, external tool outputs, and scan results into Gridwolf</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<FileUp className="h-5 w-5" />} label="Total Imports" value={totalImports} />
        <StatCard icon={<FileCheck className="h-5 w-5" />} label="PCAPs Processed" value={completedPcaps} />
        <StatCard icon={<Monitor className="h-5 w-5" />} label="Devices Discovered" value={totalDevices} />
        <StatCard icon={<AlertCircle className="h-5 w-5" />} label="Connections Mapped" value={totalConnections} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pcap">
        <TabList>
          <Tab value="pcap">PCAP Import</Tab>
          <Tab value="tools">External Tools</Tab>
          <Tab value="history">Import History</Tab>
        </TabList>

        {/* ============================================================ */}
        {/* Tab 1: PCAP Import                                           */}
        {/* ============================================================ */}
        <TabPanel value="pcap">
          <div className="space-y-4">
            {/* Drag-drop zone */}
            <Card>
              <CardHeader title="Upload PCAP / PCAPNG Files" action={<Badge variant="info">Multi-file</Badge>} />
              <CardContent>
                <DragDropZone
                  accept=".pcap, .pcapng"
                  label="Drag and drop PCAP captures here"
                  sublabel="Supports .pcap and .pcapng files — multiple files allowed"
                  isDragging={pcapDragging}
                  onDragState={setPcapDragging}
                />
              </CardContent>
            </Card>

            {/* File list */}
            {pcapFiles.length > 0 && (
              <Card>
                <CardHeader title="Import Queue" action={<Badge variant="info">{pcapFiles.length} files</Badge>} />
                <CardContent className="space-y-4">
                  {pcapFiles.map((file) => {
                    const sc = pcapStatusConfig[file.status];
                    const StatusIcon = sc.icon;
                    return (
                      <div key={file.id} className="rounded-lg border border-border-default p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <File className="h-4 w-4 text-content-tertiary shrink-0" />
                            <span className="text-sm font-mono text-content-primary truncate">{file.filename}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="text-xs text-content-tertiary">{file.size}</span>
                            <span className="text-xs text-content-tertiary">{file.packets.toLocaleString()} pkts</span>
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', sc.bg, sc.color)}>
                              <StatusIcon className={cn('h-3 w-3', file.status === 'processing' && 'animate-spin')} />
                              {file.status}
                            </span>
                          </div>
                        </div>

                        <PcapStageIndicator file={file} />

                        {/* Results summary for completed files */}
                        {file.results && (
                          <div className="mt-3 grid grid-cols-5 gap-2">
                            {[
                              { label: 'Devices', value: file.results.devicesDiscovered, color: 'text-cyan-400' },
                              { label: 'Connections', value: file.results.connectionsFound, color: 'text-blue-400' },
                              { label: 'Protocols', value: file.results.protocolsIdentified, color: 'text-purple-400' },
                              { label: 'New Devices', value: file.results.newDevices, color: 'text-emerald-400' },
                              { label: 'Known', value: file.results.knownDevices, color: 'text-content-secondary' },
                            ].map((stat) => (
                              <div key={stat.label} className="rounded bg-surface-hover/50 px-2 py-1.5 text-center">
                                <p className={cn('text-sm font-bold', stat.color)}>{stat.value}</p>
                                <p className="text-[10px] text-content-tertiary">{stat.label}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </TabPanel>

        {/* ============================================================ */}
        {/* Tab 2: External Tools                                        */}
        {/* ============================================================ */}
        <TabPanel value="tools">
          <div className="grid grid-cols-2 gap-4">
            {/* Zeek */}
            <ToolCard
              name="Zeek"
              description="Import Zeek (Bro) ICS protocol logs including conn.log, modbus.log, dnp3.log, and s7comm.log for passive traffic analysis."
              icon={<Eye className="h-4 w-4" />}
              formats=".log"
              accept=".log"
              status="connected"
            />

            {/* Suricata */}
            <ToolCard
              name="Suricata"
              description="Import Suricata EVE JSON output containing flow records and IDS alert events for threat correlation."
              icon={<Shield className="h-4 w-4" />}
              formats=".json (EVE)"
              accept=".json"
              status="ready"
            />

            {/* Nmap / Masscan */}
            <ToolCard
              name="Nmap / Masscan"
              description="Import XML scan results from Nmap or Masscan host discovery. Assets will be tagged as actively scanned."
              icon={<Radar className="h-4 w-4" />}
              formats=".xml"
              accept=".xml"
              status="ready"
              warning="Active scan results detected — these were not passively discovered. Imported assets will be flagged with an [active-scan] tag."
            />

            {/* Wazuh */}
            <ToolCard
              name="Wazuh"
              description="Import Wazuh HIDS/SIEM alert exports in JSON format. Alerts will be correlated against known devices in the asset inventory."
              icon={<Bug className="h-4 w-4" />}
              formats=".json"
              accept=".json"
              status="ready"
            />

            {/* Siemens SINEMA Server */}
            <ToolCard
              name="Siemens SINEMA Server"
              description="Import CSV inventory exports from SINEMA Server for Siemens device discovery including firmware versions and module info."
              icon={<Cpu className="h-4 w-4" />}
              formats=".csv"
              accept=".csv"
              status="ready"
            />

            {/* Siemens TIA Portal */}
            <ToolCard
              name="Siemens TIA Portal"
              description="Import TIA Portal project XML exports to extract PLC, HMI, and drive configurations including IP addressing and module layout."
              icon={<Terminal className="h-4 w-4" />}
              formats=".xml"
              accept=".xml"
              status="ready"
            />

            {/* Wireshark */}
            <ToolCard
              name="Wireshark"
              description="Open the currently loaded PCAP in Wireshark for deep packet inspection. Requires the Gridwolf desktop agent."
              icon={<Monitor className="h-4 w-4" />}
              formats=".pcap / .pcapng"
              accept=".pcap"
              status="desktop-only"
            />
          </div>
        </TabPanel>

        {/* ============================================================ */}
        {/* Tab 3: Import History                                        */}
        {/* ============================================================ */}
        <TabPanel value="history">
          <Card>
            <CardHeader title="Import History" action={<Badge variant="info">{IMPORT_HISTORY.length} records</Badge>} />
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Devices Added</TableHead>
                    <TableHead>Findings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {IMPORT_HISTORY.map((rec) => {
                    const sc = historyStatusConfig[rec.status];
                    return (
                      <TableRow key={rec.id}>
                        <TableCell className="text-xs text-content-secondary whitespace-nowrap">{rec.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rec.source}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{rec.type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <File className="h-3.5 w-3.5 text-content-tertiary shrink-0" />
                            <span className="text-xs truncate max-w-[200px]">{rec.file}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{rec.devicesAdded > 0 ? rec.devicesAdded : '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{rec.findingsGenerated > 0 ? rec.findingsGenerated : '-'}</TableCell>
                        <TableCell>
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', sc.bg, sc.color)}>
                            {rec.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
}
