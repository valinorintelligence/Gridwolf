import { useState, useCallback, useRef } from 'react';
import { Upload, FileUp, CheckCircle, AlertTriangle, X, FileText } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProcessingStage = 'idle' | 'upload' | 'parse-headers' | 'extract-flows' | 'identify-protocols' | 'create-objects' | 'complete' | 'error';

interface DiscoveredResult {
  assets: { ip: string; hostname: string; vendor: string; purdueLevel: string }[];
  protocols: { name: string; port: number; packetCount: number }[];
  flows: { src: string; dst: string; protocol: string; packets: number }[];
  totalPackets: number;
  duration: string;
}

const STAGE_LABELS: Record<ProcessingStage, string> = {
  idle: 'Ready',
  upload: 'Uploading file...',
  'parse-headers': 'Parsing packet headers...',
  'extract-flows': 'Extracting network flows...',
  'identify-protocols': 'Identifying ICS protocols...',
  'create-objects': 'Creating ontology objects...',
  complete: 'Import complete',
  error: 'Error occurred',
};

const STAGE_ORDER: ProcessingStage[] = ['upload', 'parse-headers', 'extract-flows', 'identify-protocols', 'create-objects', 'complete'];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const VALID_EXTENSIONS = ['.pcap', '.pcapng'];

// ---------------------------------------------------------------------------
// Mock processing result
// ---------------------------------------------------------------------------

const MOCK_RESULT: DiscoveredResult = {
  assets: [
    { ip: '10.1.1.10', hostname: 'plc-s7-1500', vendor: 'Siemens', purdueLevel: 'L1' },
    { ip: '10.1.2.20', hostname: 'hmi-panelview', vendor: 'Rockwell', purdueLevel: 'L2' },
    { ip: '10.1.2.50', hostname: 'scada-ignition', vendor: 'Inductive Automation', purdueLevel: 'L2' },
    { ip: '192.168.1.50', hostname: 'rtu-560', vendor: 'ABB', purdueLevel: 'L1' },
    { ip: '10.1.3.15', hostname: 'ews-unity-pro', vendor: 'Schneider Electric', purdueLevel: 'L3' },
    { ip: '192.168.1.200', hostname: 'iot-gw-01', vendor: 'Siemens', purdueLevel: 'L0' },
  ],
  protocols: [
    { name: 'Modbus/TCP', port: 502, packetCount: 45200 },
    { name: 'DNP3', port: 20000, packetCount: 12400 },
    { name: 'EtherNet/IP', port: 44818, packetCount: 28900 },
    { name: 'OPC UA', port: 4840, packetCount: 8100 },
    { name: 'BACnet/IP', port: 47808, packetCount: 3200 },
  ],
  flows: [
    { src: '10.1.2.50', dst: '10.1.1.10', protocol: 'Modbus/TCP', packets: 22400 },
    { src: '10.1.2.20', dst: '10.1.1.10', protocol: 'EtherNet/IP', packets: 28900 },
    { src: '10.1.2.50', dst: '192.168.1.50', protocol: 'DNP3', packets: 12400 },
    { src: '192.168.1.200', dst: '10.1.2.50', protocol: 'BACnet/IP', packets: 3200 },
    { src: '10.1.3.15', dst: '10.1.1.10', protocol: 'S7comm', packets: 4100 },
  ],
  totalPackets: 97800,
  duration: '24h 15m',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PcapImportProps {
  className?: string;
  onImportComplete?: (result: DiscoveredResult) => void;
}

export function PcapImport({ className, onImportComplete }: PcapImportProps) {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveredResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) {
      return `Invalid file format. Expected .pcap or .pcapng, got ${ext}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 500 MB, got ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (file.size === 0) {
      return 'File is empty.';
    }
    return null;
  }, []);

  const simulateProcessing = useCallback(async () => {
    const stages = STAGE_ORDER;
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      setStage(s);
      // Simulate progress through this stage
      const baseProgress = (i / stages.length) * 100;
      const stageSpan = (1 / stages.length) * 100;
      for (let p = 0; p <= 100; p += 20) {
        setProgress(Math.min(baseProgress + (p / 100) * stageSpan, 100));
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    setProgress(100);
    setStage('complete');
    setResult(MOCK_RESULT);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setStage('error');
        return;
      }

      setFileName(file.name);
      setFileSize(file.size);
      await simulateProcessing();
    },
    [validateFile, simulateProcessing]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReset = useCallback(() => {
    setStage('idle');
    setProgress(0);
    setFileName(null);
    setFileSize(0);
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const currentStageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <Card className={className}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-accent" />
            PCAP Import
          </span>
        }
        action={
          <Badge variant="info">Air-Gapped Environments</Badge>
        }
      />
      <CardContent className="space-y-4">
        {/* Drop zone - only show when idle or error */}
        {(stage === 'idle' || stage === 'error') && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
              dragOver
                ? 'border-accent bg-accent/5'
                : 'border-border-default hover:border-content-tertiary hover:bg-surface-hover/30',
              error && 'border-red-500/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pcap,.pcapng"
              onChange={handleInputChange}
              className="sr-only"
            />
            <Upload className={cn('h-10 w-10 mb-3', dragOver ? 'text-accent' : 'text-content-tertiary')} />
            <p className="text-sm font-medium text-content-primary">
              {dragOver ? 'Drop your PCAP file here' : 'Drag & drop a PCAP file or click to browse'}
            </p>
            <p className="mt-1 text-xs text-content-tertiary">
              Supported: .pcap, .pcapng (max 500 MB)
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button onClick={handleReset} className="text-content-tertiary hover:text-content-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Processing progress */}
        {stage !== 'idle' && stage !== 'error' && (
          <div className="space-y-3">
            {/* File info */}
            {fileName && (
              <div className="flex items-center gap-2 rounded-md border border-border-default bg-surface-hover/30 px-3 py-2">
                <FileText className="h-4 w-4 text-content-tertiary" />
                <span className="text-sm text-content-primary truncate flex-1">{fileName}</span>
                <span className="text-xs text-content-tertiary">{(fileSize / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            )}

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-content-primary">{STAGE_LABELS[stage]}</span>
                <span className="text-xs text-content-tertiary">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    stage === 'complete' ? 'bg-emerald-500' : 'bg-accent'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stage indicators */}
            <div className="flex items-center gap-1">
              {STAGE_ORDER.map((s, i) => {
                const isDone = i < currentStageIndex || stage === 'complete';
                const isActive = s === stage && stage !== 'complete';
                return (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    <div
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        isDone ? 'bg-emerald-500' : isActive ? 'bg-accent' : 'bg-surface-hover'
                      )}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-content-tertiary">
              <span>Upload</span>
              <span>Parse</span>
              <span>Flows</span>
              <span>Protocols</span>
              <span>Objects</span>
              <span>Done</span>
            </div>
          </div>
        )}

        {/* Results summary */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">
                Analysis complete: {result.totalPackets.toLocaleString()} packets over {result.duration}
              </span>
            </div>

            {/* Discovered assets */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">
                Discovered Assets ({result.assets.length})
              </p>
              <div className="space-y-1">
                {result.assets.map((a) => (
                  <div key={a.ip} className="flex items-center justify-between rounded-md border border-border-default bg-surface-hover/30 px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <span className="text-xs font-mono text-content-primary">{a.ip}</span>
                      <span className="text-xs text-content-secondary">{a.hostname}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.vendor}</Badge>
                      <Badge variant="info">{a.purdueLevel}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discovered protocols */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">
                Identified Protocols ({result.protocols.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {result.protocols.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-2 rounded-md border border-border-default bg-surface-hover px-3 py-1.5"
                  >
                    <span className="h-2 w-2 rounded-full bg-violet-400" />
                    <span className="text-xs font-medium text-content-primary">{p.name}</span>
                    <span className="text-[10px] text-content-tertiary">port {p.port}</span>
                    <span className="text-[10px] text-content-tertiary">{p.packetCount.toLocaleString()} pkts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Discovered flows */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">
                Network Flows ({result.flows.length})
              </p>
              <div className="space-y-1">
                {result.flows.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-content-primary">{f.src}</span>
                    <span className="text-content-tertiary">&rarr;</span>
                    <span className="font-mono text-content-primary">{f.dst}</span>
                    <Badge variant="outline">{f.protocol}</Badge>
                    <span className="text-content-tertiary ml-auto">{f.packets.toLocaleString()} pkts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer actions */}
      {(stage === 'complete' || stage === 'error') && (
        <CardFooter className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="rounded-md border border-border-default px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-surface-hover transition-colors"
          >
            Import Another File
          </button>
          {stage === 'complete' && result && (
            <button
              onClick={() => onImportComplete?.(result)}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors"
            >
              Import to Ontology
            </button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

export default PcapImport;
