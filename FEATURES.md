# Gridwolf Features Guide

Comprehensive documentation of all Gridwolf features for passive ICS/SCADA network discovery and OT security assessment.

## Table of Contents

1. [Core Discovery Features](#core-discovery-features)
2. [New Features (v0.9.2+)](#new-features-v092)
3. [Security Analysis](#security-analysis)
4. [Advanced Investigation](#advanced-investigation)
5. [Reporting & Export](#reporting--export)
6. [Administration](#administration)

---

## Core Discovery Features

### 1. PCAP Analysis & Import

**Location**: Capture → PCAP Analysis

Passive analysis of network captures with zero packet generation—completely safe for operational environments.

**Features:**
- **Multi-PCAP Import**: Process single or multiple PCAP files simultaneously
- **Format Support**: `.pcap`, `.pcapng`, `.cap`, `Wireshark TZSP`
- **4-Stage Pipeline Visualization**:
  1. **Ingestion** — File validation, format detection, deduplication
  2. **Dissection** — Protocol parsing (19+ protocols supported)
  3. **Topology** — Device mapping, connection reconstruction
  4. **Risk Triage** — Security assessment, CVE correlation

**Supported File Sizes**:
- Single file: Up to 5 GB
- Batch import: Unlimited (processed sequentially)
- In-memory buffering: Automatic compression for large files

**Example Workflow:**
```
1. Click "Import PCAP" tab
2. Select or drag-drop capture file
3. Monitor real-time progress (4 stages)
4. View extracted devices and connections
5. Export to topology visualization
```

---

## New Features (v0.9.2+)

### 1. Report-to-Report Diffing

**Location**: Investigations → Report Diffing

Side-by-side comparison of two network assessment snapshots to identify changes.

**Key Capabilities:**
- **Node-Level Changes**:
  - Nodes added (new devices discovered)
  - Nodes removed (devices decommissioned)
  - Field-level changes (firmware updates, port changes, protocol additions)

- **Edge-Level Changes**:
  - New connections established
  - Connections removed
  - Connection property modifications

- **Visual Indicators**:
  - Green highlights for additions
  - Red highlights for removals
  - Amber highlights for modifications
  - Risk-based color coding

**Use Cases:**
- ✅ Post-maintenance assessments (validate no unauthorized changes)
- ✅ Baseline compliance (ensure network matches approved design)
- ✅ Incident investigations (identify unauthorized device introductions)
- ✅ Quarterly assessments (track network evolution)

**Example Output:**
```
Baseline (Before): Plant Floor – March 1
Current (After): Plant Floor – March 15

Summary:
  • 3 Nodes Added (new HMI, sensor gateway, WiFi AP)
  • 2 Nodes Removed (decommissioned RTU, old PLC)
  • 5 Field Changes (firmware versions, open ports, protocols)
  • 5 Edges Added (new connections from engineering workstation)
  • 2 Edges Removed (legacy Modbus TCP connections)
```

---

### 2. Live Capture Visualization

**Location**: Capture → Live Capture

Real-time topology rendering during active packet capture with progressive device discovery.

**Key Capabilities:**
- **Live Monitoring**:
  - Real-time packet counter
  - Device discovery progress
  - Connection establishment tracking
  - Live alerts for anomalies

- **Purdue Model Bands**:
  - Visual separation by ICS level (L0, L1, L2, L3, DMZ)
  - Devices organized by operational tier
  - Cross-level communication highlighting

- **Progressive Discovery**:
  - New devices animate in as discovered
  - Connections materialize in real-time
  - Protocol detection as traffic flows
  - Confidence scoring updates dynamically

- **Live Statistics**:
  - Packets per second
  - Active flows (connections)
  - New devices/connections in capture window
  - ICS-speaking device count

- **Capture Controls**:
  - Pause/resume capture
  - Stop and save session
  - Interface selection (span port, mirror, tap)
  - BPF filter entry

**Use Cases:**
- ✅ Real-time network assessment during scheduled maintenance windows
- ✅ Incident response (monitor network during cyber attack response)
- ✅ New site deployment (validate network comes up as designed)
- ✅ Network troubleshooting (identify communication issues in real-time)

**Example Metrics:**
```
Elapsed: 00:02:15
Packets: 24,891 (1,842/sec)
Devices Found: 8 (2 new)
Connections: 6 (1 new)
Protocols: S7comm, EtherNet/IP, Modbus TCP, OPC UA, HTTP
```

---

### 3. C2/Beacon/Exfiltration Detection

**Location**: Security & Detection → C2/Beacon Detection

Multi-layered threat detection using IAT clustering, DNS entropy analysis, and asymmetric flow detection.

**Detection Methods:**

#### A. Inter-Arrival Time (IAT) Histogram Clustering
- **Beacon Detection**: Identifies periodic outbound connections with consistent timing
- **Jitter Analysis**: Detects attempts to evade beaconing detection
- **Patterns**:
  - Regular intervals (30s, 60s, 300s = typical C2 beacons)
  - Low jitter (<5%) = confirmed beaconing
  - High jitter (>20%) = irregular behavior

**Example Detection:**
```
Beacon: 10.0.1.20 → 185.220.101.42:443
Interval: 60s ± 2s (jitter 3.2%)
Confidence: 98%
Status: CONFIRMED

Packets: 1,440 over 24 hours
Duration: 24h
Protocol: HTTPS
```

#### B. Shannon Entropy DNS Analysis
- **Domain Entropy Scoring** (0-5 scale):
  - < 3.0: Normal domain (google.com)
  - 3.0-4.0: Suspicious (entropy encoding)
  - > 4.0: High probability of data exfiltration
  - > 4.5: Confirmed encoded data in DNS

**Example Detection:**
```
DNS Exfiltration: 10.0.3.50
Domain: x7k2m.evil-c2.example.com
Entropy: 4.82 (SUSPICIOUS)
Queries: 342 over 24h
Data Estimate: 16.4 KB
Confidence: 95%
```

#### C. Asymmetric Flow Analysis
- **TX/RX Ratio Detection**:
  - 1:10 ratio = possible exfiltration (send 1 MB, receive 10 MB)
  - 10:1 ratio = possible data staging (receive 10 MB, send 1 MB)
  - Baseline normal ratios for known protocols

**Example Detection:**
```
Asymmetric Flow: 10.0.1.20 → 185.220.101.42
TX: 245 KB
RX: 12.4 MB
Ratio: 1:52
Status: CRITICAL (extreme asymmetry)
Risk: Data exfiltration likely
```

**Confidence Scoring Algorithm:**
```
IF jitter < 5% AND interval matches known C2 patterns
  Confidence = 90-98%
ELSE IF entropy > 4.5 AND query count > 100
  Confidence = 85-95%
ELSE IF TX:RX > 10:1 OR TX:RX < 1:10
  Confidence = 75-90%
```

---

### 4. Purdue Model Violation Detection

**Location**: Security & Detection → Purdue Violations

Automated detection of unauthorized cross-zone communications that violate the Purdue manufacturing reference model.

**Purdue Model Levels:**
```
L0: Physical Process (sensors, actuators, motors)
L1: Basic Control (PLC, RTU, I/O)
L2: Area Supervisory (HMI, SCADA, edge gateway)
L3: Operations/Site (MES, historian, engineering workstation)
L4: Enterprise Network (ERP, business systems)
L5: Cloud/Internet
DMZ: Demilitarized zone (firewalls, proxies)
```

**Violation Types:**

#### Direct Cross-Zone Communication
- **Example**: L3 (Engineering Workstation) → L1 (PLC) without L2 intermediary
- **Risk**: Bypasses supervisory controls, allows unauthorized direct access
- **Severity**: CRITICAL

#### Reverse Communication
- **Example**: L1 (RTU) → L3 (Historian) with unexpected protocols
- **Risk**: Potential command injection, unauthorized control
- **Severity**: HIGH

#### DMZ to Operational Zone
- **Example**: DMZ (Firewall) → L3 (Historian) with data access
- **Risk**: External compromise could spread to operational network
- **Severity**: HIGH

#### Management Traversal
- **Example**: L2 (Switch) SNMP polling of L1 (PLC)
- **Risk**: Non-standard management access, configuration tampering
- **Severity**: MEDIUM

**Detection Example:**
```
Violation: VIO-001
Source: 10.0.3.50 (ENG-WORKSTATION) — Level L3
Destination: 10.0.1.10 (PLC-MASTER-01) — Level L1
Protocol: S7comm (control protocol)
Violation Type: Cross-Zone L3→L1

Triggered Rules:
  • L3 → L1 direct communication (should use L2 gateway)
  • Engineering workstation bypassing supervisory layer
  • Direct control protocol access from management zone

Risk: Program upload/download to PLC
First Seen: 2024-03-20 14:23:15
Packets: 342
Status: CRITICAL
```

---

### 5. Write/Program Access Path Detection

**Location**: Security & Detection → Write/Program Paths

Identifies and flags dangerous control paths where devices can modify PLC programs, write registers, or change device state.

**Dangerous Operations Detected:**

#### S7comm Program Access
- **FC 28**: Program Download (upload to PLC)
- **FC 5**: Write to M-memory (discrete/analog outputs)
- **FC 3**: Read registers with write intent
- **Risk**: Complete device reprogramming, field control manipulation

**Example Detection:**
```
Critical Path: WP-001
Source: 10.0.3.50 (ENG-WORKSTATION)
Destination: 10.0.1.10 (PLC-MASTER-01)
Operation: S7 Program Upload (FC 28)
Risk: Complete device reprogramming
Severity: CRITICAL

Control Point Assessment:
  ✗ Load block to module memory — ENABLED (dangerous)
  ✗ Start download — ALLOWED (dangerous)
  ✗ Signature verification — NOT ENFORCED (dangerous)

Detection Count: 3 attempts in 24h
First Seen: 2024-03-20 09:15:22
Status: CONFIRMED
```

#### Modbus TCP Write Operations
- **FC 5**: Write Single Coil
- **FC 6**: Write Single Register
- **FC 16**: Write Multiple Registers
- **Risk**: Modify field device outputs without PLC authorization

#### EtherNet/IP CIP Tag Writes
- **Service 0xCC**: Packed Read/Write
- **Write Attributes**: Tag value modification
- **Risk**: Direct tag manipulation on Allen-Bradley devices

#### OPC UA Method Execution
- **Method Invocation**: Calling OPC methods on PLC
- **Attribute Write**: OPC node modification
- **Risk**: Device state changes via OPC interface

**Control Point Framework:**
```
Safe Configuration:
  ✓ Write operations DISABLED for untrusted sources
  ✓ Digital signatures enforced on program uploads
  ✓ Write-blocking enabled on critical registers
  ✓ Role-based access control (RBAC) implemented
  ✓ Audit logging enabled for all state changes

Dangerous Configuration:
  ✗ Write operations ENABLED from any source
  ✗ No signature verification on uploads
  ✗ Direct access to output registers
  ✗ No RBAC or authentication
  ✗ Minimal or no audit logging
```

---

### 6. System Administration Dashboard

**Location**: Administration → System Admin

Real-time monitoring of Gridwolf system health, resource usage, and operational metrics.

**System Health Metrics:**

#### Resource Monitoring
- **CPU Usage**: Real-time percentage, peak in window
- **Memory Usage**: RAM consumption, available memory
- **Disk Usage**: Storage utilization percentage
- **Database Size**: SQLite database size with growth rate
- **Uptime**: Days/hours since last restart

**Example Display:**
```
CPU:      34%
Memory:   62%
Disk:     48%
DB Size:  2.4 GB (+2.1 MB/hr)
Uptime:   18d 5h 23m
Version:  0.9.2-alpha
```

#### Performance Metrics
- **API Latency** (p95): 95th percentile response time
- **PCAP Ingest Rate**: MB/s throughput
- **Topology Queries**: Requests/hour served
- **Detection Latency**: Average time to flag findings

#### Active Sessions
- **User**: Who is logged in
- **Role**: Administrator, Security Analyst, OT Engineer, Viewer
- **Login Time**: When session started
- **Current Activity**: What page/analysis they're running
- **Last Activity**: How long idle

**Example Session:**
```
User: alice@org
Role: Administrator
Login: 2024-03-20 09:00:22
Activity: Analyzing PCAP
Last Seen: 2m ago
Status: ACTIVE
```

#### Background Tasks
- **PCAP Ingest Queue**: Progress tracking
- **Baseline Drift Calculation**: Comparison progress
- **C2 Detection Analysis**: Session scanning progress
- **CVE Database Update**: Vulnerability data refresh

**Troubleshooting Tools:**
- **Refresh**: Update metrics immediately
- **Diagnostics**: Run system health checks
- **Database Optimization**: Vacuum and reindex
- **Log Export**: Download system logs

---

### 7. Investigation Workflows - Focus Queue

**Location**: Investigations → Focus Queue

Structured workflow for prioritizing security findings and managing investigations.

**Focus Queue Components:**

#### Queue Items (6 Priority Levels)
Each item represents a security finding requiring investigation:

**P1 - Critical Threats**
```
Beacon Detection
Suspected C2 Beacon: 10.0.1.20 → 185.220.101.42:443
Status: INVESTIGATING
Confidence: 98%
Indicator: IAT clustering 60s±2s
Risk: Malware callback communication
```

**P2 - Dangerous Write Paths**
```
Write Path Detection
PLC Program Upload from Engineering Workstation
Status: INVESTIGATING
Severity: CRITICAL
Indicator: S7comm FC 28 (Program Download), 3x in 24h
Risk: Unauthorized code injection or maintenance
```

**P3 - Purdue Violations**
```
Purdue Violation
Cross-Zone L3→L1 Communication
Status: QUEUED
Severity: HIGH
Indicator: Direct S7comm to L1 PLC without L2 gateway
Risk: Bypasses supervisory controls
```

**P4-P6 - Medium/Low Priority**
- Unconfirmed threats
- Policy violations
- Informational findings

#### Investigation Tools
- **Star/Favorite**: Mark important findings
- **Investigate**: Deep-dive into finding details
- **Share**: Export finding for team review
- **Archive**: Mark as resolved or duplicate
- **Notes**: Add investigation context

#### Authentication Gaps Tab
Separately lists all identified authentication weaknesses:

```
Device: 10.0.1.10 (PLC-MASTER-01)
Service: Modbus TCP
Issue: No authentication
Risk: HIGH
Remediation: Implement RBAC or client certificate validation

Device: 10.0.3.50 (ENG-WORKSTATION)
Service: Telnet
Issue: Plaintext credentials
Risk: HIGH
Remediation: Enable SSH, disable Telnet
```

**Remediation Guidance:**
```
✓ Implement role-based access control (RBAC)
✓ Deploy digital signatures for PLC uploads
✓ Enable write-blocking on data registers
✓ Implement network segmentation with unidirectional gateways
✓ Enable comprehensive audit logging
```

---

## Security Analysis

### MITRE ATT&CK for ICS

**Location**: Security & Detection → MITRE ATT&CK

40+ detection rules mapped to MITRE ATT&CK for ICS framework across 11 tactic categories.

**Coverage Areas:**
- **Reconnaissance**: Network scanning, asset enumeration
- **Initial Access**: Default credentials, unpatched services
- **Execution**: Program execution, script delivery
- **Persistence**: Firmware modification, rootkit installation
- **Privilege Escalation**: Capability escalation in control logic
- **Defense Evasion**: Encrypted command channels, living off the land
- **Credential Access**: Credential harvesting, authentication bypass
- **Discovery**: Network mapping, device enumeration
- **Lateral Movement**: Cross-zone communication, protocol abuse
- **Collection**: Data staging, command execution logging
- **Exfiltration**: Data transfer channels, covert communication

**Detection Example:**
```
Technique: T1071 - Application Layer Protocol
Tactic: Command & Control
Detection: GW-008 Unauthorized HTTPS beaconing
Finding: 10.0.1.20 periodic HTTPS to 185.220.101.42
Confidence: 98%
```

---

### CVE Matching

**Location**: Security & Detection → CVE Matching

Correlates discovered devices and firmware versions against 1,500+ ICS vulnerabilities.

**Coverage:**
- Siemens S7 PLC vulnerabilities
- Allen-Bradley CompactLogix/ControlLogix CVEs
- Schneider Electric Modicon vulnerabilities
- ABB AC500 firmware flaws
- DNP3 implementation vulnerabilities
- Modbus TCP weaknesses
- Building automation (BACnet, KNX) flaws
- SCADA historian vulnerabilities

---

### ICS Malware Detection

**Location**: Security & Detection → MITRE ATT&CK (ICS Malware Section)

Signature-based detection for known ICS malware families:
- **FrostyGoop**: Modbus/DNP3 manipulation
- **PIPEDREAM/INCONTROLLER**: Programmable Logic Controller targeting
- **Industroyer2**: Power grid attack framework
- **TRITON/TRISIS**: Safety system tampering
- **BlackEnergy**: SCADA infrastructure attacks
- **CrashOverride**: Power transmission attacks

---

## Advanced Investigation

### Baseline Drift Detection

**Location**: Security & Detection → Baseline Drift

Automatically identify changes between baseline and current sessions.

**Drift Categories:**
- **New Assets**: Devices added to network
- **Missing Assets**: Devices removed from network
- **Changed Properties**: Firmware updates, new protocols, port changes
- **New Connections**: Communication paths established
- **Removed Connections**: Communication paths discontinued

**Drift Score**: Quantified risk metric (0-100%)
- 0-10%: Minimal changes (likely maintenance)
- 10-30%: Moderate changes (firmware updates, new device)
- 30-60%: Significant changes (network architecture modification)
- 60%+: Major changes (potential security incident or network redesign)

---

## Reporting & Export

### Assessment Reports

**Location**: Reporting → Assessment Reports

Professional PDF generation with custom sections and client branding.

**Report Types:**
- **Executive Summary**: High-level findings for management
- **Technical Report**: Detailed technical analysis
- **Full Assessment**: Complete documentation

**Available Sections:**
1. Cover page with CONFIDENTIAL marking
2. Table of contents
3. Executive summary with risk metrics
4. Device inventory with classification
5. Network topology diagrams
6. Protocol analysis breakdown
7. Security findings with CVSS scores
8. MITRE ATT&CK technique mapping
9. Compliance assessment (IEC/NIST/NERC)
10. Remediation roadmap
11. Appendices (raw data, detailed tables)

---

### Export Formats

**Location**: Reporting → Export & STIX

#### CSV/JSON Export
- Full device inventory
- Connection matrix
- Findings database
- Compatible with Excel, Splunk, ELK Stack

#### SBOM (Software Bill of Materials)
- SPDX format
- CycloneDX format
- Software component tracking
- License compliance

#### STIX 2.1 Export
- Structured threat intelligence
- Integration with MITRE ATT&CK framework
- Shareable with security teams
- Compatible with threat intelligence platforms

#### Filtered PCAP Export
- Protocol-specific captures
- Device-specific traffic
- Time-windowed extracts
- Ready for Wireshark analysis

#### Communication Allowlist
- Baseline-approved flows
- Firewall rule generation (iptables, Cisco ACL, Palo Alto)
- Zero-trust network policies

---

## Administration

### Session & Project Management

**Location**: Operations → Sessions & Projects

Organize and manage multiple assessments.

**Sessions Tab:**
- Save/load complete assessment sessions
- Compare against baseline for drift detection
- Export as `.gwf` archives (portable format)
- Track session metadata (date, assessor, client)

**Projects Tab:**
- Organize sessions by client/site/engagement
- Tagging and search
- Progress tracking
- Team collaboration features

---

## Feature Matrix

| Feature | Discovery | Analysis | Investigation | Reporting |
|---------|-----------|----------|---|---|
| PCAP Import | ✅ | — | — | — |
| Live Capture | ✅ | — | — | — |
| Protocol Dissection | ✅ | — | — | — |
| Device Inventory | ✅ | — | — | ✅ |
| Topology Visualization | ✅ | — | — | ✅ |
| Report Diffing | — | ✅ | — | ✅ |
| C2 Detection | — | ✅ | — | ✅ |
| Purdue Violations | — | ✅ | ✅ | ✅ |
| Write Path Detection | — | ✅ | ✅ | ✅ |
| CVE Matching | — | ✅ | — | ✅ |
| MITRE ATT&CK | — | ✅ | — | ✅ |
| Baseline Drift | — | ✅ | — | ✅ |
| Compliance | — | ✅ | — | ✅ |
| System Admin | — | — | — | — |
| Focus Queue | — | — | ✅ | — |

---

**Last Updated**: March 27, 2026 | **Version**: 0.9.2-alpha
