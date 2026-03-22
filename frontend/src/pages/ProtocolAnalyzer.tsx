import { useState, useMemo } from 'react';
import { Activity, AlertTriangle, Radio, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import StatCard from '@/components/dashboard/StatCard';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Inline mock data for ICS protocol analysis
// ---------------------------------------------------------------------------

interface FunctionCodeEntry {
  code: number;
  name: string;
  count: number;
  category: 'read' | 'write' | 'diagnostic';
}

interface RegisterMapEntry {
  addressRange: string;
  description: string;
  accessType: 'read' | 'write' | 'read/write';
  lastAccessed: string;
  anomaly: boolean;
  anomalyReason?: string;
}

interface CommMatrixEntry {
  source: string;
  destination: string;
  packets: number;
  bytes: number;
  lastSeen: string;
}

interface ProtocolAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  source: string;
}

interface BaselineDeviation {
  metric: string;
  baseline: number;
  current: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

interface ProtocolData {
  key: string;
  label: string;
  port: number;
  totalPackets: number;
  uniqueSources: number;
  healthScore: number;
  functionCodes: FunctionCodeEntry[];
  registerMap: RegisterMapEntry[];
  commMatrix: CommMatrixEntry[];
  alerts: ProtocolAlert[];
  baseline: BaselineDeviation[];
}

const PROTOCOL_DATA: ProtocolData[] = [
  {
    key: 'modbus',
    label: 'Modbus TCP',
    port: 502,
    totalPackets: 284310,
    uniqueSources: 12,
    healthScore: 72,
    functionCodes: [
      { code: 1, name: 'Read Coils', count: 45200, category: 'read' },
      { code: 2, name: 'Read Discrete Inputs', count: 38100, category: 'read' },
      { code: 3, name: 'Read Holding Registers', count: 112400, category: 'read' },
      { code: 4, name: 'Read Input Registers', count: 52300, category: 'read' },
      { code: 5, name: 'Write Single Coil', count: 8420, category: 'write' },
      { code: 6, name: 'Write Single Register', count: 12100, category: 'write' },
      { code: 15, name: 'Write Multiple Coils', count: 3200, category: 'write' },
      { code: 16, name: 'Write Multiple Registers', count: 6800, category: 'write' },
      { code: 8, name: 'Diagnostics', count: 5790, category: 'diagnostic' },
    ],
    registerMap: [
      { addressRange: '40001-40010', description: 'Process temperature setpoints', accessType: 'read/write', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: '40011-40020', description: 'Pressure transducer values', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: '40021-40030', description: 'Flow rate measurements', accessType: 'read', lastAccessed: '2024-12-18T14:29:00Z', anomaly: false },
      { addressRange: '40050-40060', description: 'Motor control parameters', accessType: 'read/write', lastAccessed: '2024-12-18T14:28:00Z', anomaly: true, anomalyReason: 'Unexpected write from 10.1.3.15 outside maintenance window' },
      { addressRange: '40100-40120', description: 'Safety system interlocks', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: true, anomalyReason: 'Write attempt detected on read-only safety registers' },
      { addressRange: '00001-00032', description: 'Valve coil status', accessType: 'read/write', lastAccessed: '2024-12-18T14:27:00Z', anomaly: false },
    ],
    commMatrix: [
      { source: '10.1.2.50 (SCADA)', destination: '10.1.1.10 (PLC-S7)', packets: 112400, bytes: 8945600, lastSeen: '2024-12-18T14:30:00Z' },
      { source: '10.1.2.20 (HMI)', destination: '10.1.1.10 (PLC-S7)', packets: 45200, bytes: 3616000, lastSeen: '2024-12-18T14:25:00Z' },
      { source: '10.1.3.15 (EWS)', destination: '10.1.1.10 (PLC-S7)', packets: 8420, bytes: 673600, lastSeen: '2024-12-18T13:00:00Z' },
      { source: '10.1.2.50 (SCADA)', destination: '192.168.1.50 (RTU)', packets: 38100, bytes: 3048000, lastSeen: '2024-12-18T14:10:00Z' },
    ],
    alerts: [
      { id: 'ma-001', severity: 'critical', message: 'Unauthorized write to safety interlock registers (40100-40120) from unknown source 10.99.1.5', timestamp: '2024-12-18T14:15:00Z', source: '10.99.1.5' },
      { id: 'ma-002', severity: 'high', message: 'Write to motor control parameters outside scheduled maintenance window', timestamp: '2024-12-18T14:28:00Z', source: '10.1.3.15' },
      { id: 'ma-003', severity: 'medium', message: 'Modbus exception response 0x02 (Illegal Data Address) rate exceeded threshold', timestamp: '2024-12-18T13:45:00Z', source: '10.1.2.50' },
      { id: 'ma-004', severity: 'low', message: 'Increased diagnostic function code usage from engineering workstation', timestamp: '2024-12-18T12:00:00Z', source: '10.1.3.15' },
    ],
    baseline: [
      { metric: 'Packets/min', baseline: 4200, current: 4850, unit: 'pkt/min', status: 'warning' },
      { metric: 'Write ratio', baseline: 8.2, current: 14.7, unit: '%', status: 'critical' },
      { metric: 'Unique sources', baseline: 4, current: 5, unit: 'hosts', status: 'warning' },
      { metric: 'Exception rate', baseline: 0.3, current: 0.8, unit: '%', status: 'warning' },
      { metric: 'Avg response time', baseline: 12, current: 15, unit: 'ms', status: 'normal' },
    ],
  },
  {
    key: 'dnp3',
    label: 'DNP3',
    port: 20000,
    totalPackets: 98420,
    uniqueSources: 6,
    healthScore: 85,
    functionCodes: [
      { code: 1, name: 'Read', count: 52300, category: 'read' },
      { code: 2, name: 'Write', count: 4100, category: 'write' },
      { code: 3, name: 'Select', count: 1200, category: 'write' },
      { code: 4, name: 'Operate', count: 980, category: 'write' },
      { code: 20, name: 'Enable Unsolicited', count: 8400, category: 'diagnostic' },
      { code: 21, name: 'Disable Unsolicited', count: 320, category: 'diagnostic' },
      { code: 129, name: 'Response', count: 28100, category: 'read' },
      { code: 130, name: 'Unsolicited Response', count: 3020, category: 'read' },
    ],
    registerMap: [
      { addressRange: 'Binary Input 0-31', description: 'Breaker status indicators', accessType: 'read', lastAccessed: '2024-12-18T14:10:00Z', anomaly: false },
      { addressRange: 'Binary Output 0-15', description: 'Breaker control commands', accessType: 'read/write', lastAccessed: '2024-12-18T14:08:00Z', anomaly: false },
      { addressRange: 'Analog Input 0-23', description: 'Voltage/current measurements', accessType: 'read', lastAccessed: '2024-12-18T14:10:00Z', anomaly: false },
      { addressRange: 'Counter 0-7', description: 'Energy accumulation', accessType: 'read', lastAccessed: '2024-12-18T14:05:00Z', anomaly: false },
      { addressRange: 'Binary Output 16-31', description: 'Reserved control points', accessType: 'write', lastAccessed: '2024-12-18T13:55:00Z', anomaly: true, anomalyReason: 'Operate command on decommissioned control points' },
    ],
    commMatrix: [
      { source: '10.1.2.50 (SCADA)', destination: '192.168.1.50 (RTU-560)', packets: 52300, bytes: 4184000, lastSeen: '2024-12-18T14:10:00Z' },
      { source: '192.168.1.50 (RTU-560)', destination: '10.1.2.50 (SCADA)', packets: 31120, bytes: 2489600, lastSeen: '2024-12-18T14:10:00Z' },
      { source: '10.1.3.15 (EWS)', destination: '192.168.1.50 (RTU-560)', packets: 1200, bytes: 96000, lastSeen: '2024-12-18T13:55:00Z' },
    ],
    alerts: [
      { id: 'da-001', severity: 'high', message: 'Operate command issued on decommissioned binary output points (BO 16-31)', timestamp: '2024-12-18T13:55:00Z', source: '10.1.3.15' },
      { id: 'da-002', severity: 'medium', message: 'Cold restart request from engineering workstation', timestamp: '2024-12-18T11:30:00Z', source: '10.1.3.15' },
    ],
    baseline: [
      { metric: 'Packets/min', baseline: 1640, current: 1720, unit: 'pkt/min', status: 'normal' },
      { metric: 'Write ratio', baseline: 5.1, current: 6.3, unit: '%', status: 'normal' },
      { metric: 'Unique sources', baseline: 3, current: 3, unit: 'hosts', status: 'normal' },
      { metric: 'Unsolicited rate', baseline: 3.1, current: 3.4, unit: '%', status: 'normal' },
      { metric: 'Avg response time', baseline: 25, current: 28, unit: 'ms', status: 'normal' },
    ],
  },
  {
    key: 'enip',
    label: 'EtherNet/IP',
    port: 44818,
    totalPackets: 215640,
    uniqueSources: 8,
    healthScore: 91,
    functionCodes: [
      { code: 4, name: 'List Services', count: 2400, category: 'diagnostic' },
      { code: 99, name: 'Send RR Data', count: 85200, category: 'read' },
      { code: 112, name: 'Send Unit Data', count: 118400, category: 'read' },
      { code: 101, name: 'Register Session', count: 3200, category: 'diagnostic' },
      { code: 102, name: 'Unregister Session', count: 2840, category: 'diagnostic' },
      { code: 6, name: 'List Identity', count: 3600, category: 'diagnostic' },
    ],
    registerMap: [
      { addressRange: 'Tag: Motor_Speed_SP', description: 'Motor speed setpoint', accessType: 'read/write', lastAccessed: '2024-12-18T14:25:00Z', anomaly: false },
      { addressRange: 'Tag: Tank_Level', description: 'Tank level measurement', accessType: 'read', lastAccessed: '2024-12-18T14:25:00Z', anomaly: false },
      { addressRange: 'Tag: Emergency_Stop', description: 'E-Stop status', accessType: 'read', lastAccessed: '2024-12-18T14:25:00Z', anomaly: false },
      { addressRange: 'Tag: Batch_Recipe[0-9]', description: 'Batch recipe parameters', accessType: 'read/write', lastAccessed: '2024-12-18T14:20:00Z', anomaly: false },
    ],
    commMatrix: [
      { source: '10.1.2.20 (HMI)', destination: '10.1.1.10 (PLC-S7)', packets: 118400, bytes: 9472000, lastSeen: '2024-12-18T14:25:00Z' },
      { source: '10.1.2.50 (SCADA)', destination: '10.1.1.10 (PLC-S7)', packets: 85200, bytes: 6816000, lastSeen: '2024-12-18T14:30:00Z' },
      { source: '10.1.3.15 (EWS)', destination: '10.1.1.10 (PLC-S7)', packets: 3200, bytes: 256000, lastSeen: '2024-12-18T13:00:00Z' },
    ],
    alerts: [
      { id: 'ea-001', severity: 'medium', message: 'Unusual List Identity broadcast scan detected from non-standard source', timestamp: '2024-12-18T10:15:00Z', source: '10.1.3.15' },
    ],
    baseline: [
      { metric: 'Packets/min', baseline: 3580, current: 3620, unit: 'pkt/min', status: 'normal' },
      { metric: 'Session count', baseline: 6, current: 7, unit: 'sessions', status: 'normal' },
      { metric: 'Unique sources', baseline: 3, current: 3, unit: 'hosts', status: 'normal' },
      { metric: 'Avg response time', baseline: 8, current: 9, unit: 'ms', status: 'normal' },
    ],
  },
  {
    key: 'opcua',
    label: 'OPC UA',
    port: 4840,
    totalPackets: 156200,
    uniqueSources: 5,
    healthScore: 95,
    functionCodes: [
      { code: 631, name: 'Read Request', count: 72400, category: 'read' },
      { code: 673, name: 'Browse Request', count: 12100, category: 'read' },
      { code: 634, name: 'Write Request', count: 3200, category: 'write' },
      { code: 787, name: 'CreateSubscription', count: 8400, category: 'read' },
      { code: 826, name: 'Publish', count: 48200, category: 'read' },
      { code: 467, name: 'CreateSession', count: 1200, category: 'diagnostic' },
      { code: 473, name: 'ActivateSession', count: 1180, category: 'diagnostic' },
      { code: 446, name: 'OpenSecureChannel', count: 9520, category: 'diagnostic' },
    ],
    registerMap: [
      { addressRange: 'ns=2;s=Process.Temperature', description: 'Process temperature node', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: 'ns=2;s=Process.Pressure', description: 'Process pressure node', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: 'ns=2;s=Alarms.*', description: 'Alarm namespace tree', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: 'ns=0;i=2253', description: 'Server status node', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
    ],
    commMatrix: [
      { source: '10.1.4.100 (Historian)', destination: '10.1.2.50 (SCADA)', packets: 72400, bytes: 5792000, lastSeen: '2024-12-18T14:30:00Z' },
      { source: '10.1.2.50 (SCADA)', destination: '10.1.4.100 (Historian)', packets: 48200, bytes: 3856000, lastSeen: '2024-12-18T14:30:00Z' },
      { source: '10.1.3.15 (EWS)', destination: '10.1.2.50 (SCADA)', packets: 12100, bytes: 968000, lastSeen: '2024-12-18T13:00:00Z' },
    ],
    alerts: [],
    baseline: [
      { metric: 'Packets/min', baseline: 2600, current: 2640, unit: 'pkt/min', status: 'normal' },
      { metric: 'Subscriptions', baseline: 12, current: 13, unit: 'active', status: 'normal' },
      { metric: 'Security mode', baseline: 1, current: 1, unit: 'SignAndEncrypt', status: 'normal' },
      { metric: 'Avg response time', baseline: 5, current: 6, unit: 'ms', status: 'normal' },
    ],
  },
  {
    key: 'iec61850',
    label: 'IEC 61850',
    port: 102,
    totalPackets: 73200,
    uniqueSources: 4,
    healthScore: 88,
    functionCodes: [
      { code: 1, name: 'GetServerDirectory', count: 2400, category: 'read' },
      { code: 2, name: 'GetLogicalDeviceDirectory', count: 3100, category: 'read' },
      { code: 3, name: 'GetDataValues', count: 38200, category: 'read' },
      { code: 4, name: 'SetDataValues', count: 1800, category: 'write' },
      { code: 5, name: 'Report', count: 22100, category: 'read' },
      { code: 6, name: 'GOOSE', count: 4200, category: 'read' },
      { code: 7, name: 'Control', count: 1400, category: 'write' },
    ],
    registerMap: [
      { addressRange: 'XCBR1.Pos.stVal', description: 'Circuit breaker position', accessType: 'read', lastAccessed: '2024-12-18T14:28:00Z', anomaly: false },
      { addressRange: 'MMXU1.TotW.mag', description: 'Total active power', accessType: 'read', lastAccessed: '2024-12-18T14:28:00Z', anomaly: false },
      { addressRange: 'CSWI1.Pos', description: 'Switch control', accessType: 'read/write', lastAccessed: '2024-12-18T14:20:00Z', anomaly: false },
      { addressRange: 'LLN0.Health', description: 'Logical node health', accessType: 'read', lastAccessed: '2024-12-18T14:28:00Z', anomaly: false },
    ],
    commMatrix: [
      { source: '10.1.2.50 (SCADA)', destination: '192.168.1.50 (RTU-560)', packets: 38200, bytes: 3056000, lastSeen: '2024-12-18T14:28:00Z' },
      { source: '192.168.1.50 (RTU-560)', destination: '10.1.2.50 (SCADA)', packets: 26300, bytes: 2104000, lastSeen: '2024-12-18T14:28:00Z' },
    ],
    alerts: [
      { id: 'ia-001', severity: 'medium', message: 'GOOSE message retransmission rate above threshold (possible network congestion)', timestamp: '2024-12-18T12:40:00Z', source: '192.168.1.50' },
    ],
    baseline: [
      { metric: 'Packets/min', baseline: 1220, current: 1250, unit: 'pkt/min', status: 'normal' },
      { metric: 'GOOSE rate', baseline: 70, current: 74, unit: 'msg/min', status: 'normal' },
      { metric: 'Report delay', baseline: 15, current: 18, unit: 'ms', status: 'normal' },
    ],
  },
  {
    key: 'bacnet',
    label: 'BACnet',
    port: 47808,
    totalPackets: 42100,
    uniqueSources: 9,
    healthScore: 78,
    functionCodes: [
      { code: 0, name: 'ReadProperty', count: 18400, category: 'read' },
      { code: 1, name: 'ReadPropertyMultiple', count: 8200, category: 'read' },
      { code: 6, name: 'WriteProperty', count: 3100, category: 'write' },
      { code: 8, name: 'WhoIs', count: 4200, category: 'diagnostic' },
      { code: 9, name: 'IAm', count: 4100, category: 'diagnostic' },
      { code: 14, name: 'ConfirmedCOVNotification', count: 2800, category: 'read' },
      { code: 2, name: 'UnconfirmedCOVNotification', count: 1300, category: 'read' },
    ],
    registerMap: [
      { addressRange: 'AI:0-15', description: 'HVAC temperature sensors', accessType: 'read', lastAccessed: '2024-12-18T14:25:00Z', anomaly: false },
      { addressRange: 'AO:0-7', description: 'Damper position outputs', accessType: 'read/write', lastAccessed: '2024-12-18T14:25:00Z', anomaly: false },
      { addressRange: 'BV:0-31', description: 'Equipment run status', accessType: 'read', lastAccessed: '2024-12-18T14:20:00Z', anomaly: false },
      { addressRange: 'AV:100-110', description: 'Setpoint schedule', accessType: 'read/write', lastAccessed: '2024-12-18T14:15:00Z', anomaly: true, anomalyReason: 'Bulk setpoint changes from unrecognized BACnet device ID' },
    ],
    commMatrix: [
      { source: '192.168.1.200 (IoT-GW)', destination: '10.1.2.50 (SCADA)', packets: 18400, bytes: 1472000, lastSeen: '2024-12-18T14:25:00Z' },
      { source: '10.1.2.50 (SCADA)', destination: '192.168.1.200 (IoT-GW)', packets: 8200, bytes: 656000, lastSeen: '2024-12-18T14:25:00Z' },
      { source: '10.99.2.10 (Unknown)', destination: '255.255.255.255 (Broadcast)', packets: 4200, bytes: 336000, lastSeen: '2024-12-18T14:10:00Z' },
    ],
    alerts: [
      { id: 'ba-001', severity: 'high', message: 'WhoIs broadcast storm from unrecognized device 10.99.2.10 (4200 requests in 10 minutes)', timestamp: '2024-12-18T14:10:00Z', source: '10.99.2.10' },
      { id: 'ba-002', severity: 'high', message: 'Bulk WriteProperty to HVAC setpoints from unknown BACnet device', timestamp: '2024-12-18T14:15:00Z', source: '10.99.2.10' },
      { id: 'ba-003', severity: 'medium', message: 'BACnet device enumeration scan detected (sequential WhoIs with incrementing ranges)', timestamp: '2024-12-18T13:50:00Z', source: '10.99.2.10' },
    ],
    baseline: [
      { metric: 'Packets/min', baseline: 680, current: 920, unit: 'pkt/min', status: 'critical' },
      { metric: 'WhoIs rate', baseline: 12, current: 420, unit: 'req/min', status: 'critical' },
      { metric: 'Unique sources', baseline: 4, current: 5, unit: 'hosts', status: 'warning' },
      { metric: 'Write ratio', baseline: 7.4, current: 11.2, unit: '%', status: 'warning' },
    ],
  },
  {
    key: 'profinet',
    label: 'PROFINET',
    port: 34964,
    totalPackets: 312500,
    uniqueSources: 7,
    healthScore: 93,
    functionCodes: [
      { code: 1, name: 'Cyclic IO Data', count: 280000, category: 'read' },
      { code: 2, name: 'Acyclic Read', count: 12400, category: 'read' },
      { code: 3, name: 'Acyclic Write', count: 4800, category: 'write' },
      { code: 4, name: 'Alarm Notification', count: 1200, category: 'diagnostic' },
      { code: 5, name: 'DCP Identify', count: 8100, category: 'diagnostic' },
      { code: 6, name: 'DCP Set', count: 420, category: 'write' },
      { code: 7, name: 'Connect', count: 3200, category: 'diagnostic' },
      { code: 8, name: 'Release', count: 2380, category: 'diagnostic' },
    ],
    registerMap: [
      { addressRange: 'Slot 1 / Sub 1', description: 'Digital I/O module 1', accessType: 'read/write', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: 'Slot 2 / Sub 1', description: 'Analog input module', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: 'Slot 3 / Sub 1', description: 'Motor drive interface', accessType: 'read/write', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
      { addressRange: 'Slot 0 / Sub 1', description: 'CPU diagnostics', accessType: 'read', lastAccessed: '2024-12-18T14:30:00Z', anomaly: false },
    ],
    commMatrix: [
      { source: '10.1.1.10 (PLC-S7)', destination: '10.1.1.20 (IO-Device-1)', packets: 140000, bytes: 11200000, lastSeen: '2024-12-18T14:30:00Z' },
      { source: '10.1.1.20 (IO-Device-1)', destination: '10.1.1.10 (PLC-S7)', packets: 140000, bytes: 11200000, lastSeen: '2024-12-18T14:30:00Z' },
      { source: '10.1.3.15 (EWS)', destination: '10.1.1.10 (PLC-S7)', packets: 12400, bytes: 992000, lastSeen: '2024-12-18T13:00:00Z' },
    ],
    alerts: [],
    baseline: [
      { metric: 'Cycle time jitter', baseline: 0.2, current: 0.3, unit: 'ms', status: 'normal' },
      { metric: 'Packets/min', baseline: 5200, current: 5280, unit: 'pkt/min', status: 'normal' },
      { metric: 'Alarm rate', baseline: 2, current: 3, unit: 'alarms/hr', status: 'normal' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FunctionCodeChart({ codes }: { codes: FunctionCodeEntry[] }) {
  const maxCount = Math.max(...codes.map((c) => c.count));
  const categoryColors: Record<string, string> = {
    read: 'bg-cyan-500',
    write: 'bg-amber-500',
    diagnostic: 'bg-violet-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-content-secondary mb-3">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" /> Read</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Write</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Diagnostic</span>
      </div>
      {codes.map((fc) => (
        <div key={fc.code} className="flex items-center gap-3">
          <span className="w-6 text-right text-xs font-mono text-content-tertiary">
            {fc.code}
          </span>
          <span className="w-44 truncate text-xs text-content-secondary">{fc.name}</span>
          <div className="flex-1 h-5 bg-surface-hover rounded overflow-hidden">
            <div
              className={cn('h-full rounded transition-all', categoryColors[fc.category])}
              style={{ width: `${(fc.count / maxCount) * 100}%`, opacity: 0.85 }}
            />
          </div>
          <span className="w-20 text-right text-xs font-mono text-content-secondary">
            {fc.count.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function HealthScoreBadge({ score }: { score: number }) {
  const variant = score >= 90 ? 'low' : score >= 75 ? 'medium' : score >= 50 ? 'high' : 'critical';
  return <Badge variant={variant} dot>{score}/100</Badge>;
}

function BaselineTable({ deviations }: { deviations: BaselineDeviation[] }) {
  const statusColors: Record<string, string> = {
    normal: 'text-emerald-400',
    warning: 'text-amber-400',
    critical: 'text-red-400',
  };
  const statusBg: Record<string, string> = {
    normal: 'bg-emerald-500/10',
    warning: 'bg-amber-500/10',
    critical: 'bg-red-500/10',
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead>Baseline</TableHead>
          <TableHead>Current</TableHead>
          <TableHead>Deviation</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deviations.map((d) => {
          const deviation = d.baseline > 0 ? (((d.current - d.baseline) / d.baseline) * 100).toFixed(1) : '0';
          return (
            <TableRow key={d.metric}>
              <TableCell className="font-medium">{d.metric}</TableCell>
              <TableCell className="font-mono text-content-secondary">{d.baseline} {d.unit}</TableCell>
              <TableCell className="font-mono">{d.current} {d.unit}</TableCell>
              <TableCell className={cn('font-mono', statusColors[d.status])}>
                {Number(deviation) > 0 ? '+' : ''}{deviation}%
              </TableCell>
              <TableCell>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', statusBg[d.status], statusColors[d.status])}>
                  {d.status === 'normal' ? 'Normal' : d.status === 'warning' ? 'Warning' : 'Critical'}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Protocol tab content
// ---------------------------------------------------------------------------

function ProtocolTabContent({ proto }: { proto: ProtocolData }) {
  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Radio size={20} />} label="Total Packets" value={proto.totalPackets.toLocaleString()} />
        <StatCard icon={<ArrowRightLeft size={20} />} label="Unique Sources" value={proto.uniqueSources} />
        <StatCard icon={<Activity size={20} />} label="Health Score" value={`${proto.healthScore}/100`} />
        <StatCard
          icon={<ShieldAlert size={20} />}
          label="Active Alerts"
          value={proto.alerts.length}
          severity={proto.alerts.some((a) => a.severity === 'critical') ? 'critical' : proto.alerts.length > 0 ? 'high' : undefined}
        />
      </div>

      {/* Function Code Distribution */}
      <Card>
        <CardHeader title="Function Code Distribution" />
        <CardContent>
          <FunctionCodeChart codes={proto.functionCodes} />
        </CardContent>
      </Card>

      {/* Register / Point Map */}
      <Card>
        <CardHeader
          title="Register / Point Map"
          action={
            proto.registerMap.some((r) => r.anomaly) ? (
              <Badge variant="critical" dot>Anomalies Detected</Badge>
            ) : (
              <Badge variant="info">Normal</Badge>
            )
          }
        />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address Range</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Last Accessed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proto.registerMap.map((r, i) => (
                <TableRow key={i} className={r.anomaly ? 'bg-red-500/5' : undefined}>
                  <TableCell className="font-mono text-xs">{r.addressRange}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>
                    <Badge variant={r.accessType.includes('write') ? 'medium' : 'info'}>{r.accessType}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-content-secondary">
                    {new Date(r.lastAccessed).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    {r.anomaly ? (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                        <span className="text-xs text-red-400">{r.anomalyReason}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-400">Normal</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Communication Matrix */}
      <Card>
        <CardHeader title="Communication Matrix" />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Packets</TableHead>
                <TableHead>Bytes</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proto.commMatrix.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{c.source}</TableCell>
                  <TableCell className="font-mono text-xs">{c.destination}</TableCell>
                  <TableCell className="font-mono">{c.packets.toLocaleString()}</TableCell>
                  <TableCell className="font-mono">{(c.bytes / 1024).toFixed(0)} KB</TableCell>
                  <TableCell className="text-xs text-content-secondary">
                    {new Date(c.lastSeen).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Security Alerts */}
      <Card>
        <CardHeader
          title="Protocol Security Alerts"
          action={<Badge variant={proto.alerts.length > 0 ? 'high' : 'info'}>{proto.alerts.length}</Badge>}
        />
        <CardContent>
          {proto.alerts.length === 0 ? (
            <p className="text-xs text-content-muted">No active alerts for this protocol.</p>
          ) : (
            <div className="space-y-2">
              {proto.alerts.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-start gap-3 rounded-md border px-3 py-2',
                    a.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    a.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                    a.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/5' :
                    'border-border-default bg-surface-hover/30'
                  )}
                >
                  <AlertTriangle className={cn(
                    'h-4 w-4 mt-0.5 shrink-0',
                    a.severity === 'critical' ? 'text-red-400' :
                    a.severity === 'high' ? 'text-orange-400' :
                    a.severity === 'medium' ? 'text-amber-400' : 'text-content-tertiary'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-content-primary">{a.message}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-content-tertiary">
                      <span>Source: {a.source}</span>
                      <span>{new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <Badge variant={a.severity}>{a.severity}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Baseline Deviation */}
      <Card>
        <CardHeader
          title="Baseline Deviation Analysis"
          action={
            proto.baseline.some((b) => b.status === 'critical') ? (
              <Badge variant="critical" dot>Deviations</Badge>
            ) : proto.baseline.some((b) => b.status === 'warning') ? (
              <Badge variant="medium" dot>Minor Deviations</Badge>
            ) : (
              <Badge variant="info" dot>Within Baseline</Badge>
            )
          }
        />
        <CardContent className="p-0">
          <BaselineTable deviations={proto.baseline} />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ProtocolAnalyzer() {
  const totalPackets = useMemo(
    () => PROTOCOL_DATA.reduce((sum, p) => sum + p.totalPackets, 0),
    []
  );
  const totalSources = useMemo(
    () => new Set(PROTOCOL_DATA.flatMap((p) => p.commMatrix.map((c) => c.source))).size,
    []
  );
  const totalAlerts = useMemo(
    () => PROTOCOL_DATA.reduce((sum, p) => sum + p.alerts.length, 0),
    []
  );
  const avgHealth = useMemo(
    () => Math.round(PROTOCOL_DATA.reduce((sum, p) => sum + p.healthScore, 0) / PROTOCOL_DATA.length),
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <Activity className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">ICS Protocol Analyzer</h1>
          <p className="text-xs text-content-secondary">
            Deep packet inspection and behavioral analysis of industrial protocol traffic
          </p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Radio size={20} />} label="Total Packets" value={totalPackets.toLocaleString()} />
        <StatCard icon={<ArrowRightLeft size={20} />} label="Unique Sources" value={totalSources} />
        <StatCard icon={<Activity size={20} />} label="Avg Health Score" value={`${avgHealth}/100`} />
        <StatCard
          icon={<ShieldAlert size={20} />}
          label="Active Alerts"
          value={totalAlerts}
          severity={totalAlerts > 5 ? 'critical' : totalAlerts > 0 ? 'high' : undefined}
        />
      </div>

      {/* Protocol Tabs */}
      <Tabs defaultValue="modbus">
        <TabList className="flex-wrap">
          {PROTOCOL_DATA.map((p) => (
            <Tab key={p.key} value={p.key}>
              <span className="flex items-center gap-2">
                {p.label}
                <HealthScoreBadge score={p.healthScore} />
                {p.alerts.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500/20 px-1 text-[10px] font-bold text-red-400">
                    {p.alerts.length}
                  </span>
                )}
              </span>
            </Tab>
          ))}
        </TabList>

        {PROTOCOL_DATA.map((p) => (
          <TabPanel key={p.key} value={p.key}>
            <ProtocolTabContent proto={p} />
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
