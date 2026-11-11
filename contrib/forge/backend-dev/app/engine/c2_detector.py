"""
C2/Beacon/Exfiltration Detection Engine (passive metadata only).

Techniques:
- Inter-arrival-time regularity of connection STARTS for beacon candidates
- Shannon entropy of DNS labels for tunnelling candidates
- One-way byte volume between a pair of hosts

Honesty rules:
- The inputs are packet or flow metadata. Timing regularity is a statistical property, not a
  probability of compromise: `confidence` is capped and each finding names its basis.
- Periodic polling between internal hosts on an industrial protocol port is the normal state of
  an OT network and is never reported as a beacon.
- A finding says only what the evidence shows (a periodic external flow, many high-entropy
  names, a one-way transfer); it does not claim exfiltration or command-and-control.
"""

from __future__ import annotations

import ipaddress
import logging
import math
from collections import defaultdict
from typing import Optional

logger = logging.getLogger(__name__)

ICS_POLL_PORTS = frozenset({502, 503, 802, 102, 44818, 2222, 20000, 2404, 47808, 4840, 34962, 34963, 34964})
INTERNAL_NETS = [ipaddress.ip_network(n) for n in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "127.0.0.0/8", "fc00::/7", "fe80::/10")]
MAX_CONFIDENCE = 80          # timing/entropy heuristics never reach certainty


def is_internal(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in n for n in INTERNAL_NETS)


class C2Detector:
    """Detect beacon candidates, DNS tunnelling candidates and one-way transfers."""

    def __init__(self):
        self.flow_timestamps: dict[str, list[float]] = defaultdict(list)
        self.flow_meta: dict[str, dict] = {}
        self.directed_bytes: dict[tuple, int] = defaultdict(int)
        self.dns_queries: dict[str, list[dict]] = defaultdict(list)
        self.findings: list[dict] = []

    def add_packet(self, src_ip: str, dst_ip: str, src_port: int, dst_port: int, pkt_len: int,
                   timestamp: float, dns_query: Optional[str] = None, new_flow: bool = True,
                   transport: str = "tcp"):
        """Accumulate one packet. `new_flow` is true for the first packet seen of a connection:
        only connection starts feed the beacon analysis (per-packet gaps inside one session are
        not beacon evidence). Byte volume uses every packet."""
        if new_flow:
            key = f"{src_ip}->{dst_ip}:{dst_port}"
            self.flow_timestamps[key].append(timestamp)
            self.flow_meta[key] = {"transport": transport}
        self.directed_bytes[(src_ip, dst_ip)] += pkt_len
        if dns_query:
            self.add_dns(src_ip, dns_query, timestamp)

    def add_dns(self, src_ip: str, query: str, timestamp: float):
        self.dns_queries[src_ip].append({"query": query, "timestamp": timestamp})

    def analyze(self) -> list[dict]:
        self.findings = []
        self._detect_beacons()
        self._detect_dns_exfiltration()
        self._detect_asymmetric_flows()
        return self.findings

    def _detect_beacons(self):
        """Regular connection starts: coefficient of variation of the inter-arrival times."""
        for flow_key, timestamps in self.flow_timestamps.items():
            if len(timestamps) < 12:
                continue
            timestamps = sorted(timestamps)
            iats = [b - a for a, b in zip(timestamps, timestamps[1:])]
            mean_iat = sum(iats) / len(iats)
            if mean_iat <= 0:
                continue
            std_dev = math.sqrt(sum((x - mean_iat) ** 2 for x in iats) / len(iats))
            cv = std_dev / mean_iat
            if not (cv < 0.15 and 1 < mean_iat < 3600):
                continue
            src_ip, rest = flow_key.split("->", 1)
            dst_ip, _, port = rest.rpartition(":")
            dst_port = int(port) if port.isdigit() else 0
            internal = is_internal(src_ip) and is_internal(dst_ip)
            if internal and dst_port in ICS_POLL_PORTS:
                continue                      # expected OT polling, not a beacon
            confidence = min(MAX_CONFIDENCE, int((1 - cv) * 100))
            self.findings.append({
                "finding_type": "beacon",
                "severity": "high" if not internal else "medium",
                "title": f"Periodic connections: {flow_key}",
                "description": (
                    f"{len(timestamps)} connection starts at {mean_iat:.1f}s +/- {std_dev:.1f}s "
                    f"(CV {cv:.3f}) over {timestamps[-1] - timestamps[0]:.0f}s. "
                    + ("The destination is external. " if not internal else "")
                    + "Regular timing is a beacon candidate, not proof of command-and-control; scheduled "
                      "jobs, polling and keep-alives look the same."),
                "src_ip": src_ip, "dst_ip": dst_ip,
                "protocol": self.flow_meta.get(flow_key, {}).get("transport", "tcp"),
                "confidence": confidence,
                "evidence": {"basis": "timing regularity of connection starts", "mean_interval": round(mean_iat, 2),
                             "std_dev": round(std_dev, 2), "coefficient_of_variation": round(cv, 4),
                             "sample_count": len(timestamps), "duration_seconds": round(timestamps[-1] - timestamps[0]),
                             "dst_port": dst_port, "destination_external": not is_internal(dst_ip)},
            })

    def _detect_dns_exfiltration(self):
        """High-entropy first labels. Names under three labels or first labels under 8 characters
        are not analysed; the average is over the names that were analysed."""
        for src_ip, queries in self.dns_queries.items():
            analysed, high = 0, []
            total = 0.0
            for q in queries:
                labels = q["query"].split(".")
                if len(labels) < 3 or len(labels[0]) < 8:
                    continue
                entropy = self._shannon_entropy(labels[0])
                analysed += 1
                total += entropy
                if entropy > 4.0:
                    high.append({"query": q["query"], "entropy": round(entropy, 2), "label_length": len(labels[0])})
            if len(high) < 3:
                continue
            avg = total / analysed
            self.findings.append({
                "finding_type": "dns_exfil",
                "severity": "high",
                "title": f"High-entropy DNS names from {src_ip}",
                "description": (f"{len(high)} of {analysed} analysed DNS names have a first label with entropy above "
                                f"4.0 (average {avg:.2f}). This is a tunnelling candidate; CDN, tracking and "
                                "hash-style names can look the same."),
                "src_ip": src_ip, "protocol": "dns",
                "confidence": min(MAX_CONFIDENCE, int(avg * 15)),
                "evidence": {"basis": "Shannon entropy of the first DNS label", "high_entropy_queries": high[:10],
                             "queries_analysed": analysed, "queries_total": len(queries),
                             "suspicious_queries": len(high), "avg_entropy": round(avg, 2),
                             "suspicious_name_bytes": sum(len(q["query"]) for q in high)},
            })

    def _detect_asymmetric_flows(self):
        """One-way volume between two hosts, with the real direction. Only an internal-to-external
        transfer is called outbound; internal bulk transfers (historians, backups, firmware) are
        low severity."""
        done = set()
        for (a, b), ab in list(self.directed_bytes.items()):
            if (a, b) in done or (b, a) in done:
                continue
            done.add((a, b))
            ba = self.directed_bytes.get((b, a), 0)
            if ab == 0 or ba == 0:
                continue                       # one side not observed: ratio unknown, not infinite
            (src, dst, big, small) = (a, b, ab, ba) if ab >= ba else (b, a, ba, ab)
            ratio = big / small
            if ratio <= 20 or big <= 100_000:
                continue
            outbound = is_internal(src) and not is_internal(dst)
            self.findings.append({
                "finding_type": "asymmetric_flow",
                "severity": ("high" if ratio > 50 else "medium") if outbound else "low",
                "title": f"One-way transfer {src} to {dst} (ratio {ratio:.0f}:1)",
                "description": (f"{src} sent {self._human_bytes(big)} to {dst}, which returned "
                                f"{self._human_bytes(small)} (ratio {ratio:.1f}:1). "
                                + ("Internal to external: potential outbound transfer. " if outbound else
                                   "Not internal-to-external. ")
                                + "Volume alone does not show what the data was."),
                "src_ip": src, "dst_ip": dst, "protocol": "tcp/udp",
                "confidence": min(MAX_CONFIDENCE, int(ratio * 2)),
                "evidence": {"basis": "byte volume per direction", "bytes_src_to_dst": big,
                             "bytes_dst_to_src": small, "ratio": round(ratio, 1), "outbound_to_external": outbound},
            })

    @staticmethod
    def _shannon_entropy(data: str) -> float:
        if not data:
            return 0.0
        prob = [float(data.count(c)) / len(data) for c in set(data)]
        return -sum(p * math.log2(p) for p in prob if p > 0)

    @staticmethod
    def _human_bytes(b: float) -> str:
        for unit in ("B", "KB", "MB", "GB"):
            if abs(b) < 1024:
                return f"{b:.1f} {unit}"
            b /= 1024
        return f"{b:.1f} TB"
