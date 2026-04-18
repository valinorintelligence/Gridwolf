import { useState, useEffect, useMemo } from 'react';
import { Activity, Server, Info } from 'lucide-react';
import { api } from '@/services/api';
import { Badge } from '@/components/ui/Badge';

// ICS protocol metadata (ports, descriptions — static domain knowledge)
const PROTOCOL_META: Record<string, { port: number; description: string; risk: 'high' | 'medium' | 'low' }> = {
  modbus:    { port: 502,   description: 'Modbus TCP — no authentication, plaintext', risk: 'high' },
  enip:      { port: 44818, description: 'EtherNet/IP (CIP) — Rockwell/Allen-Bradley', risk: 'medium' },
  s7comm:    { port: 102,   description: 'Siemens S7 — program upload/download capable', risk: 'high' },
  dnp3:      { port: 20000, description: 'DNP3 — utility SCADA protocol', risk: 'medium' },
  bacnet:    { port: 47808, description: 'BACnet — building automation', risk: 'low' },
  iec104:    { port: 2404,  description: 'IEC 60870-5-104 — power grid SCADA', risk: 'high' },
  profinet:  { port: 34964, description: 'PROFINET — Siemens industrial Ethernet', risk: 'medium' },
  opcua:     { port: 4840,  description: 'OPC UA — secure machine-to-machine', risk: 'low' },
  lldp:      { port: 0,     description: 'LLDP — link-layer device discovery', risk: 'low' },
  snmp:      { port: 161,   description: 'SNMP — network management', risk: 'medium' },
};

interface Device {
  id: string;
  ip_address: string;
  hostname: string | null;
  vendor: string | null;
  device_type: string;
  purdue_level: string;
  protocols: string[];
  firmware_version: string | null;
  model: string | null;
}

interface DeviceStats {
  by_protocol: Record<string, number>;
}

export default function ProtocolAnalyzer() {
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statsRes, devRes] = await Promise.allSettled([
        api.get('/ics/devices/stats'),
        api.get('/ics/devices/', { params: { limit: 500 } }),
      ]);
      if (statsRes.status === 'fulfilled') {
        setDeviceStats(statsRes.value.data);
        // Auto-select first protocol with devices
        const protos = Object.keys(statsRes.value.data?.by_protocol ?? {});
        if (protos.length > 0) setSelectedProtocol(protos[0]);
      }
      if (devRes.status === 'fulfilled') {
        const data = devRes.value.data;
        setDevices(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const protocols = useMemo(() => {
    const byProto = deviceStats?.by_protocol ?? {};
    return Object.entries(byProto)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [deviceStats]);

  const protocolDevices = useMemo(() => {
    if (!selectedProtocol) return [];
    return devices.filter((d) => d.protocols?.includes(selectedProtocol));
  }, [devices, selectedProtocol]);

  const hasData = protocols.length > 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <Activity size={24} className="text-accent" /> Deep Protocol Analysis
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          ICS/SCADA protocol inspection from passive PCAP captures
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-border-default bg-surface-card p-12 text-center">
          <Activity className="mx-auto h-12 w-12 text-content-tertiary mb-4" />
          <h2 className="text-lg font-semibold text-content-primary mb-2">No Protocol Data</h2>
          <p className="text-sm text-content-secondary mb-4">
            Upload a PCAP file to analyze ICS/SCADA protocols observed on your network.
          </p>
          <a href="/pcap" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors">
            Go to PCAP Analysis
          </a>
        </div>
      ) : (
        <>
          {/* Protocol summary cards */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {protocols.map((p) => {
              const meta = PROTOCOL_META[p.name.toLowerCase()] ?? { port: 0, description: p.name, risk: 'low' as const };
              return (
                <button
                  key={p.name}
                  onClick={() => setSelectedProtocol(p.name)}
                  className={`shrink-0 rounded-lg border px-3 py-2 min-w-[130px] text-left transition-all ${
                    selectedProtocol === p.name
                      ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                      : 'border-border-default bg-surface-card hover:border-border-hover'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-content-primary uppercase">{p.name}</span>
                    <span className={`text-[9px] px-1 rounded font-semibold ${
                      meta.risk === 'high' ? 'bg-red-500/15 text-red-400' :
                      meta.risk === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      {meta.risk.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-accent">{p.count}</p>
                  <p className="text-[10px] text-content-tertiary">
                    {p.count === 1 ? 'device' : 'devices'}
                    {meta.port > 0 ? ` · port ${meta.port}` : ''}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected protocol detail */}
          {selectedProtocol && (
            <div className="space-y-4">
              {/* Protocol info banner */}
              <div className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-card p-4">
                <Info size={16} className="text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-content-primary uppercase">{selectedProtocol}</p>
                  <p className="text-xs text-content-secondary mt-0.5">
                    {PROTOCOL_META[selectedProtocol.toLowerCase()]?.description ?? selectedProtocol}
                  </p>
                </div>
                {PROTOCOL_META[selectedProtocol.toLowerCase()]?.port ? (
                  <Badge variant="outline" className="ml-auto shrink-0">
                    Port {PROTOCOL_META[selectedProtocol.toLowerCase()].port}
                  </Badge>
                ) : null}
              </div>

              {/* Devices using this protocol */}
              <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-default">
                  <p className="text-sm font-medium text-content-primary">
                    Devices Using {selectedProtocol.toUpperCase()}
                  </p>
                  <Badge variant="info">{protocolDevices.length}</Badge>
                </div>
                {protocolDevices.length === 0 ? (
                  <p className="p-6 text-center text-xs text-content-muted">
                    No devices found for this protocol in the current session.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border-default text-content-tertiary">
                        <th className="text-left px-4 py-2 font-medium">IP Address</th>
                        <th className="text-left px-4 py-2 font-medium">Hostname</th>
                        <th className="text-left px-4 py-2 font-medium">Vendor</th>
                        <th className="text-left px-4 py-2 font-medium">Type</th>
                        <th className="text-left px-4 py-2 font-medium">Purdue Level</th>
                        <th className="text-left px-4 py-2 font-medium">Firmware</th>
                        <th className="text-left px-4 py-2 font-medium">All Protocols</th>
                      </tr>
                    </thead>
                    <tbody>
                      {protocolDevices.map((d) => (
                        <tr key={d.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                          <td className="px-4 py-2 font-mono text-accent">{d.ip_address}</td>
                          <td className="px-4 py-2 text-content-secondary">{d.hostname || '-'}</td>
                          <td className="px-4 py-2 text-content-primary">{d.vendor || '-'}</td>
                          <td className="px-4 py-2 text-content-secondary">{d.device_type}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline">{d.purdue_level}</Badge>
                          </td>
                          <td className="px-4 py-2 font-mono text-content-secondary">{d.firmware_version || '-'}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {(d.protocols ?? []).map((p) => (
                                <span key={p} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                  p === selectedProtocol
                                    ? 'bg-accent/20 text-accent'
                                    : 'bg-surface-hover text-content-tertiary'
                                }`}>
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Notice: deep analysis */}
              <div className="rounded-lg border border-border-default bg-surface-hover/30 px-4 py-3 flex items-start gap-2">
                <Server size={14} className="text-content-tertiary mt-0.5 shrink-0" />
                <p className="text-xs text-content-secondary">
                  <span className="font-semibold text-content-primary">Deep protocol inspection</span> (function code breakdown, master/slave pairs, register maps) is extracted automatically during PCAP analysis.
                  Re-upload your capture file for full layer-7 protocol metadata.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
