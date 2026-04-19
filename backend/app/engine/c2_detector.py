"""
C2/Beacon/Exfiltration Detection Engine.

Techniques:
- Inter-Arrival Time (IAT) histogram clustering for beacon detection
- Shannon entropy analysis for DNS exfiltration
- Asymmetric flow analysis for data staging/exfil
"""
from __future__ import annotations

import math
import logging
from collections import defaultdict
from typing import Optional

logger = logging.getLogger(__name__)


class C2Detector:
    """Detect C2 beacons, DNS exfiltration, and asymmetric flows."""

    def __init__(self):
        self.flow_timestamps: dict[str, list[float]] = defaultdict(list)
        self.flow_bytes: dict[str, dict] = defaultdict(lambda: {"tx": 0, "rx": 0})
        self.dns_queries: dict[str, list[dict]] = defaultdict(list)
        self.findings: list[dict] = []

    def add_packet(self, src_ip: str, dst_ip: str, src_port: int, dst_port: int,
                   pkt_len: int, timestamp: float, dns_query: Optional[str] = None):
        """Accumulate packet data for analysis."""
        # Track flow timestamps for IAT analysis
        flow_key = f"{src_ip}->{dst_ip}:{dst_port}"
        self.flow_timestamps[flow_key].append(timestamp)

        # Track byte counts for asymmetric flow analysis
        pair_key = tuple(sorted([src_ip, dst_ip]))
        if src_ip < dst_ip:
            self.flow_bytes[f"{pair_key}"]["tx"] += pkt_len
        else:
            self.flow_bytes[f"{pair_key}"]["rx"] += pkt_len

        # Track DNS queries
        if dns_query:
            self.dns_queries[src_ip].append({
                "query": dns_query,
                "timestamp": timestamp,
            })

    def analyze(self) -> list[dict]:
        """Run all detection methods and return findings."""
        self.findings = []
        self._detect_beacons()
        self._detect_dns_exfiltration()
        self._detect_asymmetric_flows()
        return self.findings

    def _detect_beacons(self):
        """
        IAT Histogram Clustering for beacon detection.

        Beacons produce tight clusters in the inter-arrival time distribution.
        Normal traffic has a more uniform/exponential distribution.
        """
        for flow_key, timestamps in self.flow_timestamps.items():
            if len(timestamps) < 10:
                continue

            timestamps.sort()

            # Calculate inter-arrival times
            iats = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]

            if not iats:
                continue

            # Statistical analysis
            mean_iat = sum(iats) / len(iats)
            if mean_iat == 0:
                continue

            variance = sum((x - mean_iat) ** 2 for x in iats) / len(iats)
            std_dev = math.sqrt(variance)

            # Coefficient of variation (lower = more periodic = more beacon-like)
            cv = std_dev / mean_iat if mean_iat > 0 else float('inf')

            # Jitter percentage
            jitter_pct = (std_dev / mean_iat * 100) if mean_iat > 0 else 100

            # Beacon detection criteria:
            # - Low coefficient of variation (< 0.15 = very periodic)
            # - Sufficient sample size (> 10 intervals)
            # - Not too fast (mean IAT > 1s) — filter out normal polling
            # - Not too slow (mean IAT < 3600s)
            if cv < 0.15 and len(iats) > 10 and 1 < mean_iat < 3600:
                confidence = max(0, min(100, int((1 - cv) * 100)))

                # Skip if it looks like normal ICS polling (very fast, known ports)
                parts = flow_key.split("->")
                dst_port = int(parts[1].split(":")[1]) if ":" in parts[1] else 0
                if dst_port in (502, 102, 44818, 20000, 2404, 47808) and mean_iat < 10:
                    continue  # Likely normal ICS polling

                src_ip = parts[0]
                dst_part = parts[1].split(":")[0]

                self.findings.append({
                    "finding_type": "beacon",
                    "severity": "critical" if confidence > 85 else "high",
                    "title": f"Suspected C2 Beacon: {flow_key}",
                    "description": (
                        f"Periodic communication detected with {mean_iat:.1f}s ± {std_dev:.1f}s interval. "
                        f"CV={cv:.3f}, jitter={jitter_pct:.1f}%, {len(timestamps)} packets over "
                        f"{timestamps[-1] - timestamps[0]:.0f}s."
                    ),
                    "src_ip": src_ip,
                    "dst_ip": dst_part,
                    "protocol": "tcp",
                    "confidence": confidence,
                    "evidence": {
                        "mean_interval": round(mean_iat, 2),
                        "std_dev": round(std_dev, 2),
                        "coefficient_of_variation": round(cv, 4),
                        "jitter_pct": round(jitter_pct, 1),
                        "sample_count": len(timestamps),
                        "duration_seconds": round(timestamps[-1] - timestamps[0], 0),
                        "dst_port": dst_port,
                    },
                })

    def _detect_dns_exfiltration(self):
        """
        Shannon entropy analysis for DNS tunneling / exfiltration.

        High entropy in DNS subdomain labels indicates encoded/encrypted data.
        Normal labels: entropy < 3.5
        Suspicious:    entropy 3.5-4.5
        Likely exfil:  entropy > 4.5
        """
        for src_ip, queries in self.dns_queries.items():
            if len(queries) < 5:
                continue

            high_entropy_queries = []
            total_entropy = 0

            for q in queries:
                domain = q["query"]
                # Analyze first subdomain label
                labels = domain.split(".")
                if len(labels) < 3:
                    continue

                subdomain = labels[0]
                if len(subdomain) < 8:
                    continue

                entropy = self._shannon_entropy(subdomain)
                total_entropy += entropy

                if entropy > 4.0:
                    high_entropy_queries.append({
                        "query": domain,
                        "entropy": round(entropy, 2),
                        "subdomain_length": len(subdomain),
                    })

            if len(high_entropy_queries) >= 3:
                avg_entropy = total_entropy / len(queries) if queries else 0
                estimated_data = sum(len(q["query"]) for q in high_entropy_queries)

                self.findings.append({
                    "finding_type": "dns_exfil",
                    "severity": "critical" if avg_entropy > 4.5 else "high",
                    "title": f"DNS Exfiltration Suspected from {src_ip}",
                    "description": (
                        f"{len(high_entropy_queries)} high-entropy DNS queries detected. "
                        f"Average entropy: {avg_entropy:.2f}. "
                        f"Estimated exfiltrated data: ~{estimated_data} bytes."
                    ),
                    "src_ip": src_ip,
                    "protocol": "dns",
                    "confidence": min(int(avg_entropy * 20), 100),
                    "evidence": {
                        "high_entropy_queries": high_entropy_queries[:10],
                        "total_queries": len(queries),
                        "suspicious_queries": len(high_entropy_queries),
                        "avg_entropy": round(avg_entropy, 2),
                        "estimated_data_bytes": estimated_data,
                    },
                })

    def _detect_asymmetric_flows(self):
        """
        Asymmetric flow analysis.

        Large TX:RX or RX:TX ratios can indicate:
        - Data exfiltration (high TX, low RX)
        - C2 command download (low TX, high RX)
        """
        for pair_key, bytes_info in self.flow_bytes.items():
            tx = bytes_info["tx"]
            rx = bytes_info["rx"]

            if tx == 0 or rx == 0:
                continue

            ratio = max(tx / rx, rx / tx)

            if ratio > 20 and max(tx, rx) > 100_000:  # 20:1 ratio, >100KB
                direction = "outbound (exfiltration)" if tx > rx else "inbound (staging)"
                # pair_key is a tuple of two IP strings — extract directly
                ip_a, ip_b = pair_key[0], pair_key[1]

                self.findings.append({
                    "finding_type": "asymmetric_flow",
                    "severity": "high" if ratio > 50 else "medium",
                    "title": f"Asymmetric Flow: {ip_a} ↔ {ip_b} (ratio {ratio:.0f}:1)",
                    "description": (
                        f"Highly asymmetric data flow detected: TX={self._human_bytes(tx)}, "
                        f"RX={self._human_bytes(rx)} (ratio {ratio:.1f}:1). "
                        f"Direction: {direction}."
                    ),
                    "protocol": "tcp",
                    "confidence": min(int(ratio * 2), 100),
                    "evidence": {
                        "tx_bytes": tx,
                        "rx_bytes": rx,
                        "ratio": round(ratio, 1),
                        "direction": direction,
                    },
                })

    @staticmethod
    def _shannon_entropy(data: str) -> float:
        """Calculate Shannon entropy of a string."""
        if not data:
            return 0.0
        prob = [float(data.count(c)) / len(data) for c in set(data)]
        return -sum(p * math.log2(p) for p in prob if p > 0)

    @staticmethod
    def _human_bytes(b: int) -> str:
        """Convert bytes to human-readable string."""
        for unit in ("B", "KB", "MB", "GB"):
            if abs(b) < 1024:
                return f"{b:.1f} {unit}"
            b /= 1024
        return f"{b:.1f} TB"
