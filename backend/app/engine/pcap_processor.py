from __future__ import annotations
"""
PCAP Processing Engine — Real packet analysis using Scapy.

Pipeline: Ingest → Dissect → Topology → Risk
"""

import os
import struct
import logging
from datetime import datetime, timezone
from typing import Optional
from collections import defaultdict

try:
    from scapy.all import rdpcap, PcapReader, sniff, IP, TCP, UDP, Ether, DNS, DNSQR, Raw
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

# Valid PCAP/PCAPNG magic bytes
PCAP_MAGIC_LE = b'\xd4\xc3\xb2\xa1'      # pcap little-endian
PCAP_MAGIC_BE = b'\xa1\xb2\xc3\xd4'      # pcap big-endian
PCAP_MAGIC_NS_LE = b'\x4d\x3c\xb2\xa1'   # pcap nanosecond LE
PCAP_MAGIC_NS_BE = b'\xa1\xb2\x3c\x4d'   # pcap nanosecond BE
PCAPNG_MAGIC = b'\x0a\x0d\x0d\x0a'        # pcapng Section Header Block
VALID_PCAP_MAGICS = {PCAP_MAGIC_LE, PCAP_MAGIC_BE, PCAP_MAGIC_NS_LE, PCAP_MAGIC_NS_BE}

from app.engine.protocol_parsers import (
    parse_modbus, parse_s7comm, parse_enip, parse_dnp3,
    parse_bacnet, parse_iec104, identify_protocol, ICS_PORTS,
    OUI_VENDORS
)

logger = logging.getLogger(__name__)


class PcapProcessor:
    """Process PCAP files and extract ICS/SCADA network topology."""

    def __init__(self):
        self.devices: dict[str, dict] = {}          # ip -> device info
        self.connections: dict[str, dict] = {}       # flow_key -> connection info
        self.protocol_events: list[dict] = []        # parsed ICS protocol events
        self.findings: list[dict] = []               # security findings
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

        is_pcapng = (magic == PCAPNG_MAGIC)
        is_pcap = (magic in VALID_PCAP_MAGICS)

        if not is_pcap and not is_pcapng:
            raise RuntimeError(
                f"Not a valid PCAP/PCAPNG file (magic: {magic.hex()}). "
                f"File may be corrupted during upload."
            )

        logger.info(f"Processing {'pcapng' if is_pcapng else 'pcap'}: {filepath} ({file_size:,} bytes)")

        # Read packets using the appropriate reader
        self._read_packets(filepath, file_size, is_pcapng)

        logger.info(f"Parsed {self.packet_count} packets, {len(self.devices)} devices")

        # Stage 4: Risk assessment
        self._run_risk_assessment()

        return {
            "packet_count": self.packet_count,
            "file_size": file_size,
            "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.start_time and self.end_time else 0,
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
                    logger.info(f"Trying rdpcap (loads entire file into memory)...")
                    packets = rdpcap(filepath)
                    for pkt in packets:
                        self._process_packet(pkt)

                logger.info(f"{reader_name} succeeded: {self.packet_count} packets")
                return  # success
            except Exception as e:
                last_error = e
                logger.warning(f"{reader_name} failed: {e}")
                continue

        raise RuntimeError(
            f"Could not read capture file with any parser. "
            f"Last error: {last_error}"
        )

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

        if pkt.haslayer(TCP):
            sport = pkt[TCP].sport
            dport = pkt[TCP].dport
            transport = "TCP"
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
        if pkt.haslayer(DNS) and pkt.haslayer(DNSQR):
            qname = pkt[DNSQR].qname.decode("utf-8", errors="ignore").rstrip(".")
            self._analyze_dns(src_ip, qname, ts)

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

    def _dissect_protocol(self, protocol: str, src_ip: str, dst_ip: str,
                          sport: int, dport: int, payload: bytes, ts: datetime) -> list[dict]:
        """Deep protocol dissection — parse ICS protocol payloads."""
        events = []
        try:
            if protocol == "modbus":
                events = parse_modbus(payload, src_ip, dst_ip, ts)
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

        # Classify devices based on protocol role
        for event in events:
            role = event.get("role")
            if role == "master" or role == "client":
                self._classify_device(src_ip, protocol, "master")
            elif role == "slave" or role == "server":
                self._classify_device(dst_ip, protocol, "slave")

        return events

    def _classify_device(self, ip: str, protocol: str, role: str):
        """Classify device type and Purdue level based on protocol behavior."""
        dev = self.devices.get(ip, {})

        if protocol in ("modbus", "s7comm", "enip", "dnp3", "iec104"):
            if role == "slave":
                if dev.get("device_type") == "UNKNOWN":
                    if protocol == "modbus":
                        dev["device_type"] = "PLC"
                    elif protocol == "s7comm":
                        dev["device_type"] = "PLC"
                    elif protocol == "enip":
                        dev["device_type"] = "PLC"
                    elif protocol == "dnp3":
                        dev["device_type"] = "RTU"
                    elif protocol == "iec104":
                        dev["device_type"] = "RTU"
                dev["purdue_level"] = "L1"
                dev["confidence"] = max(dev.get("confidence", 1), 4)
            elif role == "master":
                if dev.get("device_type") == "UNKNOWN":
                    dev["device_type"] = "HMI"
                dev["purdue_level"] = "L2"
                dev["confidence"] = max(dev.get("confidence", 1), 3)

        elif protocol == "bacnet":
            dev["device_type"] = "SENSOR" if role == "slave" else "WORKSTATION"
            dev["purdue_level"] = "L1" if role == "slave" else "L2"

    def _analyze_dns(self, src_ip: str, qname: str, ts: datetime):
        """Analyze DNS queries for potential exfiltration."""
        import math
        # Shannon entropy calculation
        if len(qname) > 0:
            prob = [float(qname.count(c)) / len(qname) for c in set(qname)]
            entropy = -sum(p * math.log2(p) for p in prob if p > 0)

            # High entropy + long subdomain = potential exfiltration
            subdomain = qname.split(".")[0] if "." in qname else qname
            if entropy > 4.0 and len(subdomain) > 20:
                self.findings.append({
                    "finding_type": "dns_exfil",
                    "severity": "high",
                    "title": f"Potential DNS Exfiltration from {src_ip}",
                    "description": f"High-entropy DNS query detected: {qname} (entropy: {entropy:.2f})",
                    "src_ip": src_ip,
                    "protocol": "dns",
                    "confidence": min(int(entropy * 20), 100),
                    "evidence": {"query": qname, "entropy": round(entropy, 2), "subdomain_length": len(subdomain)},
                })

    def _run_risk_assessment(self):
        """Stage 4: Run risk assessment on discovered topology."""
        # Check for Purdue violations (cross-zone communication)
        for flow_key, conn in self.connections.items():
            src_dev = self.devices.get(conn["src_ip"], {})
            dst_dev = self.devices.get(conn["dst_ip"], {})
            src_level = src_dev.get("purdue_level", "UNKNOWN")
            dst_level = dst_dev.get("purdue_level", "UNKNOWN")

            if src_level != "UNKNOWN" and dst_level != "UNKNOWN":
                # L3 → L1 direct (bypassing L2)
                if src_level == "L3" and dst_level == "L1":
                    self.findings.append({
                        "finding_type": "purdue_violation",
                        "severity": "critical",
                        "title": f"Purdue Violation: {src_level}→{dst_level} ({conn['src_ip']} → {conn['dst_ip']})",
                        "description": f"Direct communication from {src_level} to {dst_level} bypassing supervisory layer",
                        "src_ip": conn["src_ip"],
                        "dst_ip": conn["dst_ip"],
                        "protocol": conn["protocol"],
                        "confidence": 90,
                        "mitre_technique": "T0886",
                    })
                # DMZ → L1/L2 (external zone to control zone)
                elif src_level == "DMZ" and dst_level in ("L1", "L2"):
                    self.findings.append({
                        "finding_type": "purdue_violation",
                        "severity": "critical",
                        "title": f"Purdue Violation: DMZ→{dst_level} ({conn['src_ip']} → {conn['dst_ip']})",
                        "description": f"Communication from DMZ to control zone ({dst_level})",
                        "src_ip": conn["src_ip"],
                        "dst_ip": conn["dst_ip"],
                        "protocol": conn["protocol"],
                        "confidence": 95,
                        "mitre_technique": "T0886",
                    })

        # Check for write operations (dangerous control paths)
        for event in self.protocol_events:
            if event.get("is_write") or event.get("is_critical"):
                self.findings.append({
                    "finding_type": "write_path",
                    "severity": "high" if event.get("is_write") else "critical",
                    "title": f"Write/Program Path: {event.get('function_name', 'Unknown')}",
                    "description": f"{event['protocol'].upper()} write operation from {event['src_ip']} to {event['dst_ip']}",
                    "src_ip": event["src_ip"],
                    "dst_ip": event["dst_ip"],
                    "protocol": event["protocol"],
                    "confidence": 85,
                    "evidence": event.get("details", {}),
                })

        # Check for default credential indicators (common ICS ports without auth)
        for ip, dev in self.devices.items():
            ports = dev.get("open_ports", [])
            if 23 in ports:  # Telnet
                self.findings.append({
                    "finding_type": "default_credential",
                    "severity": "high",
                    "title": f"Telnet Service Enabled on {ip}",
                    "description": f"Plaintext authentication protocol on {dev.get('hostname', ip)}",
                    "src_ip": ip,
                    "confidence": 80,
                    "remediation": "Disable Telnet and enable SSH",
                })

        logger.info(f"Risk assessment complete: {len(self.findings)} findings generated")
