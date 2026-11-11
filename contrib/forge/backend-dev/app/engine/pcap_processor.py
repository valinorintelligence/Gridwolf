"""
PCAP Processing Engine — Real packet analysis using Scapy.

Pipeline: Ingest → Dissect → Topology → Risk
"""

from __future__ import annotations

import os
import json
import logging
import ipaddress
from datetime import datetime, timezone
from typing import Optional
from collections import defaultdict

from app.engine.c2_detector import C2Detector

try:
    from scapy.all import rdpcap, PcapReader, IP, TCP, UDP, Ether, DNS, DNSQR, Raw

    SCAPY_AVAILABLE = True
    # pcapng support (Scapy 2.5+)
    try:
        from scapy.utils import PcapNgReader

        PCAPNG_AVAILABLE = True
    except ImportError:
        PCAPNG_AVAILABLE = False
except ImportError:
    SCAPY_AVAILABLE = False
    PCAPNG_AVAILABLE = False

from app.engine.protocol_parsers import (
    parse_modbus,
    parse_s7comm,
    parse_enip,
    parse_dnp3,
    parse_bacnet,
    parse_iec104,
    identify_protocol,
    OUI_VENDORS,
)

# Valid PCAP/PCAPNG magic bytes
PCAP_MAGIC_LE = b"\xd4\xc3\xb2\xa1"  # pcap little-endian
PCAP_MAGIC_BE = b"\xa1\xb2\xc3\xd4"  # pcap big-endian
PCAP_MAGIC_NS_LE = b"\x4d\x3c\xb2\xa1"  # pcap nanosecond LE
PCAP_MAGIC_NS_BE = b"\xa1\xb2\x3c\x4d"  # pcap nanosecond BE
PCAPNG_MAGIC = b"\x0a\x0d\x0d\x0a"  # pcapng Section Header Block
VALID_PCAP_MAGICS = {PCAP_MAGIC_LE, PCAP_MAGIC_BE, PCAP_MAGIC_NS_LE, PCAP_MAGIC_NS_BE}

logger = logging.getLogger(__name__)

# Purdue ranks used for the cross-zone rule. DMZ sits between L3 and L4.
PURDUE_RANK = {"L0": 0, "L1": 1, "L2": 2, "L3": 3, "DMZ": 3.5, "L4": 4, "L5": 5}

# ATT&CK for ICS candidate mapping from the observed Modbus function code. A mapping candidate is
# not confirmation of adversary activity: a routine HMI write maps to the same technique.
WRITE_TECHNIQUE = {5: "T0855", 15: "T0855", 6: "T0836", 16: "T0836", 21: "T0836", 22: "T0836", 23: "T0836"}


def _load_zone_map() -> list[tuple]:
    """Optional operator-configured Purdue zones: GRIDWOLF_PURDUE_ZONE_MAP='{"10.10.1.0/24":"L1"}'."""
    raw = os.environ.get("GRIDWOLF_PURDUE_ZONE_MAP", "").strip()
    zones = []
    if raw:
        for cidr, level in json.loads(raw).items():
            if level not in PURDUE_RANK:
                raise ValueError("unknown Purdue level %r in GRIDWOLF_PURDUE_ZONE_MAP" % level)
            zones.append((ipaddress.ip_network(cidr, strict=False), level))
    zones.sort(key=lambda z: -z[0].prefixlen)       # most specific zone wins
    return zones


class PcapProcessor:
    """Process PCAP files and extract ICS/SCADA network topology."""

    def __init__(self):
        self.devices: dict[str, dict] = {}  # ip -> device info
        self.connections: dict[str, dict] = {}  # flow_key -> connection info
        self.protocol_events: list[dict] = []  # parsed ICS protocol events
        self.findings: list[dict] = []  # security findings
        self.roles: dict[str, dict] = defaultdict(lambda: defaultdict(int))  # ip -> protocol:role -> n
        self.non_ip_packets = 0
        self.c2 = C2Detector()
        self._seen_flows: set = set()
        self.packet_count = 0
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.protocol_summary: dict[str, int] = defaultdict(int)

    def process_file(self, filepath: str) -> dict:
        """Process a PCAP file and return analysis results."""
        if not SCAPY_AVAILABLE:
            raise RuntimeError("Scapy is not installed. Install with: pip install scapy")

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"PCAP file not found: {filepath}")

        # Stage 1: Ingest — validate file before processing
        file_size = os.path.getsize(filepath)
        if file_size < 24:
            raise RuntimeError(f"PCAP file too small ({file_size} bytes) — not a valid capture")

        # Check magic bytes to determine format
        with open(filepath, "rb") as fh:
            magic = fh.read(4)

        is_pcapng = magic == PCAPNG_MAGIC
        is_pcap = magic in VALID_PCAP_MAGICS

        if not is_pcap and not is_pcapng:
            raise RuntimeError(
                f"Not a valid PCAP/PCAPNG file (magic: {magic.hex()}). "
                f"File may be corrupted during upload."
            )

        logger.info(
            f"Processing {'pcapng' if is_pcapng else 'pcap'}: {filepath} ({file_size:,} bytes)"
        )

        # Read packets using the appropriate reader
        self._read_packets(filepath, file_size, is_pcapng)

        logger.info(f"Parsed {self.packet_count} packets, {len(self.devices)} devices")

        # Stage 4: Risk assessment
        self._run_risk_assessment()

        return {
            "packet_count": self.packet_count,
            "file_size": file_size,
            "duration_seconds": (self.end_time - self.start_time).total_seconds()
            if self.start_time and self.end_time
            else 0,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "devices": list(self.devices.values()),
            "connections": list(self.connections.values()),
            "protocol_events": self.protocol_events,
            "findings": self.findings,
            "protocol_summary": dict(self.protocol_summary),
        }

    def _read_packets(self, filepath: str, file_size: int, is_pcapng: bool):
        """Read packets from a PCAP or PCAPNG file using the best available reader."""
        # Strategy: try streaming reader first, then fall back to rdpcap
        readers_to_try = []

        if is_pcapng:
            if PCAPNG_AVAILABLE:
                readers_to_try.append(("PcapNgReader", lambda: PcapNgReader(filepath)))
            # rdpcap in Scapy 2.5+ handles pcapng too
            readers_to_try.append(("rdpcap", None))
        else:
            # For pcap: stream large files, load small ones
            if file_size > 10 * 1024 * 1024:  # > 10 MB
                readers_to_try.append(("PcapReader", lambda: PcapReader(filepath)))
            readers_to_try.append(("rdpcap", None))

        last_error = None
        for reader_name, reader_factory in readers_to_try:
            # Reset state before each attempt to prevent duplicates
            self.devices.clear()
            self.connections.clear()
            self.protocol_events.clear()
            self.findings.clear()
            self.roles.clear()
            self.non_ip_packets = 0
            self.c2 = C2Detector()
            self._seen_flows = set()
            self.packet_count = 0
            self.start_time = None
            self.end_time = None
            self.protocol_summary.clear()

            try:
                if reader_factory:
                    logger.info(f"Trying {reader_name}...")
                    reader = reader_factory()
                    for pkt in reader:
                        self._process_packet(pkt)
                    reader.close()
                else:
                    logger.info("Trying rdpcap (loads entire file into memory)...")
                    packets = rdpcap(filepath)
                    for pkt in packets:
                        self._process_packet(pkt)

                logger.info(f"{reader_name} succeeded: {self.packet_count} packets")
                return  # success
            except Exception as e:
                last_error = e
                logger.warning(f"{reader_name} failed: {e}")
                continue

        raise RuntimeError(f"Could not read capture file with any parser. Last error: {last_error}")

    def _process_packet(self, pkt):
        """Process a single packet — Stage 2 (Dissect) + Stage 3 (Topology)."""
        self.packet_count += 1

        # Extract timestamp
        try:
            ts = datetime.fromtimestamp(float(pkt.time), tz=timezone.utc)
        except (ValueError, OSError):
            ts = datetime.now(timezone.utc)

        if self.start_time is None or ts < self.start_time:
            self.start_time = ts
        if self.end_time is None or ts > self.end_time:
            self.end_time = ts

        # Extract MAC addresses for OUI lookup
        src_mac = dst_mac = None
        if pkt.haslayer(Ether):
            src_mac = pkt[Ether].src
            dst_mac = pkt[Ether].dst

        if not pkt.haslayer(IP):
            self.non_ip_packets += 1      # IPv6, ARP and L2 protocols are not analysed; reported, not hidden
            return

        src_ip = pkt[IP].src
        dst_ip = pkt[IP].dst

        # Stage 3: Update topology (devices)
        self._update_device(src_ip, src_mac, ts)
        self._update_device(dst_ip, dst_mac, ts)

        # Determine transport and ports
        sport = dport = 0
        transport = "OTHER"
        payload = b""
        syn_ack = False

        if pkt.haslayer(TCP):
            sport = pkt[TCP].sport
            dport = pkt[TCP].dport
            transport = "TCP"
            syn_ack = (int(pkt[TCP].flags) & 0x12) == 0x12
            if pkt.haslayer(Raw):
                payload = bytes(pkt[Raw].load)
        elif pkt.haslayer(UDP):
            sport = pkt[UDP].sport
            dport = pkt[UDP].dport
            transport = "UDP"
            if pkt.haslayer(Raw):
                payload = bytes(pkt[Raw].load)

        # Identify ICS protocol
        protocol = identify_protocol(dport, sport, payload)
        self.protocol_summary[protocol] += 1

        # Stage 2: Deep protocol dissection
        if protocol != "other" and payload:
            events = self._dissect_protocol(protocol, src_ip, dst_ip, sport, dport, payload, ts)
            self.protocol_events.extend(events)

        # A SYN-ACK proves the sender is listening on that port (a bare SYN proves nothing).
        if syn_ack and sport:
            ports = self.devices[src_ip].setdefault("open_ports", [])
            if sport not in ports:
                ports.append(sport)

        # Beacon analysis consumes connection starts: the first packet seen of a 5-tuple
        five = (src_ip, sport, dst_ip, dport, transport)
        new_flow = five not in self._seen_flows
        self._seen_flows.add(five)
        if transport in ("TCP", "UDP"):
            self.c2.add_packet(src_ip, dst_ip, sport, dport, len(pkt), ts.timestamp(), new_flow=new_flow,
                               transport=transport.lower())

        # Update device protocols
        if protocol != "other":
            if protocol not in self.devices[src_ip].get("protocols", []):
                self.devices[src_ip].setdefault("protocols", []).append(protocol)
            if protocol not in self.devices[dst_ip].get("protocols", []):
                self.devices[dst_ip].setdefault("protocols", []).append(protocol)

            # Update device ports
            if dport and dport not in self.devices[dst_ip].get("open_ports", []):
                self.devices[dst_ip].setdefault("open_ports", []).append(dport)

        # Update connection tracking
        flow_key = f"{src_ip}:{sport}->{dst_ip}:{dport}"
        if flow_key not in self.connections:
            self.connections[flow_key] = {
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "src_port": sport,
                "dst_port": dport,
                "protocol": protocol,
                "transport": transport,
                "packet_count": 0,
                "byte_count": 0,
                "first_seen": ts.isoformat(),
                "last_seen": ts.isoformat(),
                "is_ics": protocol != "other",
            }
        conn = self.connections[flow_key]
        conn["packet_count"] += 1
        conn["byte_count"] += len(pkt)
        conn["last_seen"] = ts.isoformat()

        # DNS analysis for C2 detection
        if pkt.haslayer(DNS) and pkt.haslayer(DNSQR) and not pkt[DNS].qr:
            qname = pkt[DNSQR].qname.decode("utf-8", errors="ignore").rstrip(".")
            self.c2.add_dns(src_ip, qname, ts.timestamp())

    def _update_device(self, ip: str, mac: Optional[str], ts: datetime):
        """Update or create a device entry."""
        if ip not in self.devices:
            vendor = None
            if mac:
                oui = mac[:8].upper().replace(":", "-")
                vendor = OUI_VENDORS.get(oui)

            self.devices[ip] = {
                "ip_address": ip,
                "mac_address": mac,
                "hostname": None,
                "vendor": vendor,
                "device_type": "UNKNOWN",
                "purdue_level": "UNKNOWN",
                "protocols": [],
                "open_ports": [],
                "confidence": 1,
                "first_seen": ts.isoformat(),
                "last_seen": ts.isoformat(),
                "packet_count": 0,
                "properties": {},
            }
        dev = self.devices[ip]
        dev["packet_count"] += 1
        dev["last_seen"] = ts.isoformat()
        if mac and not dev["mac_address"]:
            dev["mac_address"] = mac
            oui = mac[:8].upper().replace(":", "-")
            dev["vendor"] = OUI_VENDORS.get(oui, dev.get("vendor"))

    def _dissect_protocol(
        self,
        protocol: str,
        src_ip: str,
        dst_ip: str,
        sport: int,
        dport: int,
        payload: bytes,
        ts: datetime,
    ) -> list[dict]:
        """Deep protocol dissection — parse ICS protocol payloads."""
        events = []
        try:
            if protocol == "modbus":
                events = parse_modbus(payload, src_ip, dst_ip, ts, sport, dport)
            elif protocol == "s7comm":
                events = parse_s7comm(payload, src_ip, dst_ip, ts)
            elif protocol == "enip":
                events = parse_enip(payload, src_ip, dst_ip, ts)
            elif protocol == "dnp3":
                events = parse_dnp3(payload, src_ip, dst_ip, ts)
            elif protocol == "bacnet":
                events = parse_bacnet(payload, src_ip, dst_ip, ts)
            elif protocol == "iec104":
                events = parse_iec104(payload, src_ip, dst_ip, ts)
        except Exception as e:
            logger.debug(f"Protocol parse error ({protocol}): {e}")

        # Every parser reports the role of the SENDER (src_ip). Evidence is accumulated here and
        # resolved once per device after the whole capture (_finalize_roles), so the order of
        # packets, and responses seen before requests, cannot flip a device's type.
        for event in events:
            role = event.get("role")
            if role in ("master", "client"):
                self.roles[src_ip][protocol + ":master"] += 1
            elif role in ("slave", "server"):
                self.roles[src_ip][protocol + ":slave"] += 1

        return events

    _SLAVE_TYPE = {"modbus": "PLC", "s7comm": "PLC", "enip": "PLC", "dnp3": "RTU", "iec104": "RTU"}

    def _finalize_roles(self):
        """Resolve device type and Purdue level once, from accumulated role evidence.

        Both are inferences from protocol behaviour and are labelled as such in `properties`.
        A device that answered requests is a server (PLC/RTU, L1); one that only sent requests
        is a client (HMI, L2). A configured zone map (GRIDWOLF_PURDUE_ZONE_MAP) overrides the
        inferred level and is the only source of L0, L3, L4, L5 and DMZ."""
        zones = _load_zone_map()
        for ip, dev in self.devices.items():
            ev = self.roles.get(ip, {})
            slave = {k.split(":")[0]: n for k, n in ev.items() if k.endswith(":slave")}
            master = {k.split(":")[0]: n for k, n in ev.items() if k.endswith(":master")}
            props = dev.setdefault("properties", {})
            if slave:
                proto = max(slave, key=slave.get)
                if dev.get("device_type") == "UNKNOWN":
                    if proto == "bacnet":
                        dev["device_type"] = "SENSOR"
                    else:
                        dev["device_type"] = self._SLAVE_TYPE.get(proto, "UNKNOWN")
                dev["purdue_level"] = "L1"
                dev["confidence"] = max(dev.get("confidence", 1), 4)
                props["level_basis"] = "inferred: answered %s requests" % proto
            elif master:
                proto = max(master, key=master.get)
                if dev.get("device_type") == "UNKNOWN":
                    dev["device_type"] = "WORKSTATION" if proto == "bacnet" else "HMI"
                dev["purdue_level"] = "L2"
                dev["confidence"] = max(dev.get("confidence", 1), 3)
                props["level_basis"] = "inferred: sent %s requests" % proto
            if slave and master:
                props["dual_role"] = True
            if ev:
                props["role_evidence"] = dict(ev)
                props["device_type_basis"] = "inferred from protocol role; not a device identification"
            try:
                addr = ipaddress.ip_address(ip)
            except ValueError:
                continue
            for net, level in zones:
                if addr in net:
                    dev["purdue_level"] = level
                    props["level_basis"] = "configured zone %s" % net
                    break

    def _risk_write_paths(self):
        """One finding per (sender, target, protocol, function): requests only, never responses.

        Rejected requests (an exception response from the target) are counted, not reported as
        executed writes."""
        groups: dict[tuple, dict] = {}
        rejected: dict[tuple, int] = defaultdict(int)
        for ev in self.protocol_events:
            if ev.get("is_exception") and ev.get("is_write"):
                rejected[(ev["dst_ip"], ev["src_ip"], ev["protocol"], ev["function_code"])] += 1
        for ev in self.protocol_events:
            if not (ev.get("is_write") or ev.get("is_critical")):
                continue
            if ev.get("direction") in ("response", "exception"):
                continue
            key = (ev["src_ip"], ev["dst_ip"], ev["protocol"], ev.get("function_code"))
            g = groups.setdefault(key, {"count": 0, "first": ev["timestamp"], "last": ev["timestamp"],
                                        "name": ev.get("function_name", "Unknown"), "critical": False,
                                        "addresses": [], "direction": ev.get("direction")})
            g["count"] += 1
            g["last"] = ev["timestamp"]
            g["critical"] = g["critical"] or bool(ev.get("is_critical"))
            addr = ev.get("register_address")
            if addr is not None and addr not in g["addresses"] and len(g["addresses"]) < 8:
                g["addresses"].append(addr)
        for (src, dst, proto, fc), g in groups.items():
            rej = rejected.get((src, dst, proto, fc), 0)
            all_rejected = rej >= g["count"]
            severity = "medium" if (all_rejected or not g["critical"]) else "high"
            mitre = WRITE_TECHNIQUE.get(fc) if proto == "modbus" else None
            self.findings.append({
                "finding_type": "write_path",
                "severity": severity,
                "title": f"Write/Program Path: {g['name']} {src} to {dst}",
                "description": (
                    f"{proto.upper()} {g['name']} requests from {src} to {dst}: {g['count']} observed"
                    + (f", {rej} answered with an exception (rejected)" if rej else "")
                    + ". An observed write is not evidence of unauthorised activity; compare it with the "
                      "expected engineering/HMI relationships."),
                "src_ip": src, "dst_ip": dst, "protocol": proto,
                "confidence": 85 if g["direction"] == "request" else 50,
                "mitre_technique": mitre,
                "evidence": {"function_code": fc, "function_name": g["name"], "requests": g["count"],
                             "rejected_by_exception": rej, "first_seen": g["first"], "last_seen": g["last"],
                             "register_addresses": g["addresses"],
                             "direction_basis": ("well-known server port" if g["direction"] == "request"
                                                 else "not established (non-standard port)"),
                             "mitre_basis": "candidate mapping from function code, not a confirmation"
                             if mitre else None},
            })

    def _risk_purdue(self):
        """Cross-zone flows: levels more than one rank apart (DMZ between L3 and L4).

        Only devices with a level take part. Levels inferred from protocol role can only be L1
        or L2, so L3/L4/L5/DMZ violations need a configured zone map; the finding says which."""
        seen: set = set()
        for conn in self.connections.values():
            src, dst = self.devices.get(conn["src_ip"], {}), self.devices.get(conn["dst_ip"], {})
            ls, ld = src.get("purdue_level", "UNKNOWN"), dst.get("purdue_level", "UNKNOWN")
            if ls not in PURDUE_RANK or ld not in PURDUE_RANK:
                continue
            if abs(PURDUE_RANK[ls] - PURDUE_RANK[ld]) <= 1:
                continue
            key = (conn["src_ip"], conn["dst_ip"], conn["dst_port"], conn["transport"])
            if key in seen:
                continue
            seen.add(key)
            basis = [(src.get("properties") or {}).get("level_basis", "unknown"),
                     (dst.get("properties") or {}).get("level_basis", "unknown")]
            configured = all(b.startswith("configured") for b in basis)
            self.findings.append({
                "finding_type": "purdue_violation",
                "severity": "high" if configured else "medium",
                "title": f"Cross-zone flow {ls} to {ld}: {conn['src_ip']} to {conn['dst_ip']}:{conn['dst_port']}",
                "description": (f"{conn['transport']} flow from a {ls} device to a {ld} device skips at least "
                                f"one Purdue layer. Levels: {basis[0]}; {basis[1]}."),
                "src_ip": conn["src_ip"], "dst_ip": conn["dst_ip"], "protocol": conn["protocol"],
                "confidence": 90 if configured else 40,
                "mitre_technique": None,
                "evidence": {"src_level": ls, "dst_level": ld, "level_basis": basis,
                             "dst_port": conn["dst_port"], "level_source_configured": configured},
            })

    def _risk_services(self):
        """Plaintext management services proven open by a SYN-ACK (not merely probed)."""
        for ip, dev in self.devices.items():
            if 23 in dev.get("open_ports", []):
                self.findings.append({
                    "finding_type": "insecure_service",
                    "severity": "medium",
                    "title": f"Telnet listening on {ip}",
                    "description": f"{ip} answered a TCP connection on port 23 (plaintext management protocol). "
                                   "This shows the service is reachable; it does not show credentials are default or weak.",
                    "src_ip": ip, "protocol": "telnet", "confidence": 80,
                    "remediation": "Disable Telnet or restrict it to a management network; use SSH.",
                    "evidence": {"port": 23, "basis": "SYN-ACK observed"}})

    def _run_risk_assessment(self):
        """Stage 4: resolve roles, then run the evidence-based detections."""
        self._finalize_roles()
        self._risk_purdue()
        self._risk_write_paths()
        self._risk_services()
        self.findings.extend(self.c2.analyze())
        if self.non_ip_packets:
            self.protocol_summary["non-ipv4 (not analysed)"] = self.non_ip_packets
        logger.info(f"Risk assessment complete: {len(self.findings)} findings generated")
