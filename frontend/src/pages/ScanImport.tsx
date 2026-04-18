import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileUp, FileCheck, CheckCircle, XCircle, AlertCircle,
  File, Monitor, Shield, Terminal, Bug, Cpu, Radar, Eye,
  Loader2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { api } from '@/services/api';
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
  stageProgress: number;
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
// Status helpers
// ---------------------------------------------------------------------------

const pcapStatusConfig: Record<PcapFileStatus, { icon: React.ElementType; color: string; bg: string }> = {
  queued: { icon: Loader2, color: 'text-content-secondary', bg: 'bg-surface-hover' },
  processing: { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  complete: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
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
  onFileDrop,
}: {
  accept: string;
  label: string;
  sublabel?: string;
  isDragging: boolean;
  onDragState: (v: boolean) => void;
  onFileDrop?: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

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
      onDrop={(e) => {
        e.preventDefault();
        onDragState(false);
        if (onFileDrop && e.dataTransfer.files.length > 0) onFileDrop(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { if (onFileDrop && e.target.files?.length) onFileDrop(e.target.files); }}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mb-3">
        <FileUp className={cn('h-7 w-7', isDragging ? 'text-accent' : 'text-content-tertiary')} />
      </div>
      <p className="text-sm font-medium text-content-primary mb-1">
        {isDragging ? 'Drop files here' : label}
      </p>
      <p className="text-xs text-content-secondary mb-3">{sublabel ?? `Accepts ${accept}`}</p>
      <Button variant="secondary" size="sm" icon={<Upload className="h-3.5 w-3.5" />} onClick={(e) => e.stopPropagation()}>
        Browse Files
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scanner tool card — wires uploads to real endpoints
// ---------------------------------------------------------------------------

type ScannerType = 'semgrep' | 'trivy' | 'sarif' | null;

interface ScannerToolCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  formats: string;
  accept: string;
  status: 'ready' | 'connected' | 'desktop-only';
  warning?: string;
  scannerType?: ScannerType;
  children?: React.ReactNode;
}

function ScannerToolCard({
  name, description, icon, formats, accept, status, warning, scannerType, children,
}: ScannerToolCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isDesktopOnly = status === 'desktop-only';

  async function handleFiles(files: FileList) {
    if (!scannerType || files.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', files[0]);
    try {
      await api.post(`/scanners/import/${scannerType}`, formData);
      setUploadResult({ ok: true, message: `${files[0].name} imported successfully.` });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Import failed. Please check the file format and try again.'
          : 'Import failed. Please check the file format and try again.';
      setUploadResult({ ok: false, message: msg });
    } finally {
      setUploading(false);
    }
  }

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
            {isDesktopOnly && <Badge variant="info">Desktop Only</Badge>}
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

        {uploadResult && (
          <div className={cn(
            'flex items-start gap-2 rounded-lg border p-2.5',
            uploadResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/5'
          )}>
            {uploadResult.ok
              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />}
            <p className={cn('text-[11px]', uploadResult.ok ? 'text-emerald-300' : 'text-red-300')}>
              {uploadResult.message}
            </p>
          </div>
        )}

        {!isDesktopOnly ? (
          uploading ? (
            <div className="flex items-center justify-center rounded-lg border border-border-default bg-surface-hover/30 p-10 gap-2 text-content-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Importing…</span>
            </div>
          ) : (
            <DragDropZone
              accept={accept}
              label={`Drop ${accept} files here`}
              isDragging={isDragging}
              onDragState={setIsDragging}
              onFileDrop={scannerType ? handleFiles : undefined}
            />
          )
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
  const [pcapFiles, setPcapFiles] = useState<PcapFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPcapFiles() {
      try {
        const res = await api.get('/ics/pcap/list').catch(() => ({ data: [] }));
        const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        const mapped: PcapFile[] = data.map((p: Record<string, unknown>) => ({
          id: String(p.pcap_id ?? p.id ?? ''),
          filename: String(p.filename ?? ''),
          size: String(p.file_size ?? '0 B'),
          packets: Number(p.packet_count ?? 0),
          status: (String(p.status ?? 'queued') as PcapFileStatus),
          currentStage: 'create_topology' as PcapStage,
          stageProgress: p.status === 'complete' ? 100 : p.status === 'processing' ? 50 : 0,
          results: p.status === 'complete' ? {
            devicesDiscovered: 0,
            connectionsFound: 0,
            protocolsIdentified:
              typeof p.protocol_summary === 'object' && p.protocol_summary
                ? Object.keys(p.protocol_summary).length
                : 0,
            newDevices: 0,
            knownDevices: 0,
          } : undefined,
        }));
        setPcapFiles(mapped);
      } catch {
        setPcapFiles([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPcapFiles();
  }, []);

  const completedPcaps = pcapFiles.filter((f) => f.status === 'complete').length;
  const totalDevices = pcapFiles.reduce((sum, f) => sum + (f.results?.devicesDiscovered ?? 0), 0);
  const totalConnections = pcapFiles.reduce((sum, f) => sum + (f.results?.connectionsFound ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Import Hub</h1>
          <p className="text-sm text-content-secondary">
            Import PCAP captures, external tool outputs, and scan results into Gridwolf
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<FileUp className="h-5 w-5" />} label="PCAPs Uploaded" value={pcapFiles.length} />
        <StatCard icon={<FileCheck className="h-5 w-5" />} label="PCAPs Processed" value={completedPcaps} />
        <StatCard icon={<Monitor className="h-5 w-5" />} label="Devices Discovered" value={totalDevices} />
        <StatCard icon={<AlertCircle className="h-5 w-5" />} label="Connections Mapped" value={totalConnections} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pcap">
        <TabList>
          <Tab value="pcap">PCAP Import</Tab>
          <Tab value="tools">External Tools</Tab>
        </TabList>

        {/* ============================================================ */}
        {/* Tab 1: PCAP Import                                           */}
        {/* ============================================================ */}
        <TabPanel value="pcap">
          <div className="space-y-4">
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

            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-content-tertiary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading import queue…</span>
              </div>
            )}

            {!loading && pcapFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-card/50 py-12 text-center gap-2">
                <FileUp className="h-8 w-8 text-content-tertiary" />
                <p className="text-sm font-medium text-content-primary">No files imported yet</p>
                <p className="text-xs text-content-secondary">Upload a PCAP above to begin analysis.</p>
              </div>
            )}

            {!loading && pcapFiles.length > 0 && (
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
            {/* Semgrep */}
            <ScannerToolCard
              name="Semgrep"
              description="Import Semgrep SAST scan results in JSON format. Findings will be correlated with known devices and enriched as security findings."
              icon={<Shield className="h-4 w-4" />}
              formats=".json"
              accept=".json"
              status="ready"
              scannerType="semgrep"
            />

            {/* Trivy */}
            <ScannerToolCard
              name="Trivy"
              description="Import Trivy vulnerability scan results in JSON format. CVEs will be mapped to firmware versions and device models in the inventory."
              icon={<Bug className="h-4 w-4" />}
              formats=".json"
              accept=".json"
              status="ready"
              scannerType="trivy"
            />

            {/* SARIF */}
            <ScannerToolCard
              name="SARIF"
              description="Import any SARIF-format scan results (Static Analysis Results Interchange Format). Compatible with any SARIF 2.1.0 compliant tool."
              icon={<Radar className="h-4 w-4" />}
              formats=".json, .sarif"
              accept=".json,.sarif"
              status="ready"
              scannerType="sarif"
            />

            {/* Zeek */}
            <ScannerToolCard
              name="Zeek"
              description="Import Zeek (Bro) ICS protocol logs including conn.log, modbus.log, dnp3.log, and s7comm.log for passive traffic analysis."
              icon={<Eye className="h-4 w-4" />}
              formats=".log"
              accept=".log"
              status="connected"
            />

            {/* Suricata */}
            <ScannerToolCard
              name="Suricata"
              description="Import Suricata EVE JSON output containing flow records and IDS alert events for threat correlation."
              icon={<Shield className="h-4 w-4" />}
              formats=".json (EVE)"
              accept=".json"
              status="ready"
            />

            {/* Nmap / Masscan */}
            <ScannerToolCard
              name="Nmap / Masscan"
              description="Import XML scan results from Nmap or Masscan host discovery. Assets will be tagged as actively scanned."
              icon={<Radar className="h-4 w-4" />}
              formats=".xml"
              accept=".xml"
              status="ready"
              warning="Active scan results detected — these were not passively discovered. Imported assets will be flagged with an [active-scan] tag."
            />

            {/* Siemens SINEMA Server */}
            <ScannerToolCard
              name="Siemens SINEMA Server"
              description="Import CSV inventory exports from SINEMA Server for Siemens device discovery including firmware versions and module info."
              icon={<Cpu className="h-4 w-4" />}
              formats=".csv"
              accept=".csv"
              status="ready"
            />

            {/* Siemens TIA Portal */}
            <ScannerToolCard
              name="Siemens TIA Portal"
              description="Import TIA Portal project XML exports to extract PLC, HMI, and drive configurations including IP addressing and module layout."
              icon={<Terminal className="h-4 w-4" />}
              formats=".xml"
              accept=".xml"
              status="ready"
            />

            {/* Wireshark */}
            <ScannerToolCard
              name="Wireshark"
              description="Open the currently loaded PCAP in Wireshark for deep packet inspection. Requires the Gridwolf desktop agent."
              icon={<Monitor className="h-4 w-4" />}
              formats=".pcap / .pcapng"
              accept=".pcap"
              status="desktop-only"
            />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
