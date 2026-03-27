# Gridwolf Screenshots & Visual Tour

Complete visual guide of all Gridwolf features and pages.

## Table of Contents

1. [Core Features](#core-features)
2. [New Features (v0.9.2)](#new-features-v092)
3. [Security & Detection](#security--detection)
4. [Reporting & Administration](#reporting--administration)

---

## Core Features

### 1. Command Center (Dashboard)

**Location**: Overview → Command Center

![Command Center Dashboard](./docs/screenshots/01-command-center.png)

**Features Displayed:**
- Real-time threat level indicator (HIGH)
- KPI cards with trending metrics:
  - Total Assets (8, +12%)
  - Open Vulnerabilities (11, +8%)
  - Active Threats (12, +3%)
  - Compliance Score (40%, -5%)
- Vulnerability severity breakdown chart
- Recent vulnerabilities table
- Recent activity timeline

**Use Case**: High-level overview for leadership briefings and executive dashboards

---

### 2. PCAP Import & Analysis

**Location**: Capture → PCAP Analysis

![PCAP Import & Analysis](./docs/screenshots/02-pcap-analysis.png)

**Features Displayed:**
- Import PCAP tab with drag-drop zone
- Live Capture tab for real-time analysis
- Sample Library tab with categorized captures
- Recent imports table showing:
  - File name and upload date
  - Devices discovered
  - Connections found
  - Duration of capture
- 4-stage pipeline visualization:
  1. Ingestion (file validation)
  2. Dissection (protocol parsing)
  3. Topology (device mapping)
  4. Risk Triage (security assessment)

**Use Case**: Initial network discovery from offline PCAP files

---

### 3. Topology Visualization

**Location**: Discovery → Topology

![Network Topology](./docs/screenshots/03-topology.png)

**Features Displayed:**
- Interactive Cytoscape.js graph
- Purdue Model level organization:
  - L0: Field devices (red)
  - L1: Basic control (orange)
  - L2: Supervisory (amber)
  - L3: Operations (cyan)
  - DMZ: External (purple)
- Connection lines between devices
- Device icons with type indicators
- Zoom, pan, and filter controls
- Legend showing device types
- Connection protocol labels

**Use Case**: Understanding network architecture and device relationships

---

### 4. Device Inventory

**Location**: Discovery → Device Inventory

![Device Inventory](./docs/screenshots/04-device-inventory.png)

**Features Displayed:**
- Table of all discovered devices
- Columns:
  - IP Address
  - Hostname
  - Vendor/Model
  - Device Type (PLC, RTU, HMI, etc.)
  - Firmware Version
  - Purdue Level
  - Risk Score
  - Open Ports
- Search and filter capabilities
- Sorting by any column
- Device detail drill-down
- Export capabilities

**Use Case**: Complete device inventory for compliance documentation

---

### 5. Deep Protocol Analysis

**Location**: Discovery → Protocol Analysis

![Protocol Analysis](./docs/screenshots/05-protocol-analysis.png)

**Features Displayed:**
- Protocol summary bar showing detected protocols
- Packet counts per protocol
- Protocol breakdown pie chart
- Detailed tabs for each protocol:
  - **Modbus**: Function codes, master/slave pairs, write warnings
  - **EtherNet/IP**: CIP ListIdentity, scanner/adapter pairs
  - **S7comm**: Block access, program uploads, CPU state
  - **DNP3**: Master/outstation analysis, secure auth warnings
  - **BACnet**: I-Am broadcasts, device discovery
  - **IEC 104**: ASDU frame analysis, interrogation commands

**Use Case**: Deep protocol-level investigation for technical assessments

---

## New Features (v0.9.2)

### 6. Live Capture Visualization ⭐

**Location**: Capture → Live Capture

![Live Capture Visualization](./docs/screenshots/06-live-capture.png)

**Features Displayed:**
- Live capture status indicator (CAPTURING)
- Real-time statistics:
  - Packet count (24,891 packets)
  - Packets per second (1,842/sec)
  - Devices found (8, with 2 new)
  - Active connections (6, with 1 new)
  - Elapsed time (00:02:15)
- Interface selector (eth0, eth1, etc.)
- BPF filter input
- Play/Pause/Stop controls
- Progressive discovery visualization:
  - Devices organized by Purdue level
  - New devices highlighted in amber
  - Active devices in green
- Live alerts section with severity badges
- Protocol breakdown (pie chart)
- System resource usage (CPU, buffer, capture size)

**Unique Capability**: Only tool combining real-time packet capture with Purdue-level topology rendering

---

### 7. C2/Beacon/Exfiltration Detection ⭐

**Location**: Security & Detection → C2/Beacon Detection

![C2 Detection](./docs/screenshots/07-c2-detection.png)

**Features Displayed:**
- Summary statistics:
  - Beacon detections (3)
  - DNS exfiltration cases (2)
  - Asymmetric flows (3)
  - Confirmed threats (3)
- Inter-Arrival Time (IAT) histogram:
  - Visual bucket chart showing packet timing distribution
  - Beacon clusters highlighted in red
  - Normal traffic in blue
- Three detection tabs:
  - **Beacon Detection**: IAT clustering, jitter analysis, confidence scoring
    - Example: 60s±2s interval with 3.2% jitter = 98% confidence
  - **DNS Exfiltration**: Shannon entropy scoring
    - Example: Entropy 4.82 (suspicious), 342 queries, 16.4 KB estimated data
  - **Asymmetric Flows**: TX/RX ratio analysis
    - Example: 1:52 ratio flagged as critical

**Detection Confidence Algorithm**:
- Jitter <5% + known C2 interval = 90-98% confidence
- Entropy >4.5 + high query count = 85-95% confidence
- Extreme TX:RX ratio = 75-90% confidence

---

### 8. Purdue Model Violation Detection ⭐

**Location**: Security & Detection → Purdue Violations

![Purdue Violations](./docs/screenshots/08-purdue-violations.png)

**Features Displayed:**
- Summary statistics:
  - Total violations (4)
  - Critical violations (1)
  - High violations (2)
  - Zones affected (4)
- Purdue Model reference card showing all levels
- Filter tabs (All, Critical, High)
- Violation details with expandable sections:
  - **VIO-001**: L3→L1 (Engineering Workstation → PLC)
    - Violation type: Cross-Zone L3→L1
    - Severity: CRITICAL
    - Triggered rules: Direct communication, bypassing supervisory, control access
    - Risk: Program upload/download to PLC
  - Connection sources and destinations
  - Protocols used (S7comm, Modbus TCP, etc.)
  - First seen timestamp
  - Packet count
  - Investigation actions (Investigate button)

**Remediation Guidance** section with actionable steps:
- Implement role-based access control (RBAC)
- Deploy digital signatures for uploads
- Enable write-blocking
- Implement network segmentation
- Enable audit logging

---

### 9. Write/Program Access Path Detection ⭐

**Location**: Security & Detection → Write/Program Paths

![Write Paths Detection](./docs/screenshots/09-write-paths.png)

**Features Displayed:**
- Summary statistics:
  - Critical paths (2)
  - High risk paths (2)
  - Write attempts (30)
  - Devices affected (3)
  - Protocols involved (4)
- Write path list with expandable details:
  - **WP-001**: S7comm Program Upload (FC 28)
    - Source: 10.0.3.50 (ENG-WORKSTATION)
    - Destination: 10.0.1.10 (PLC-MASTER-01)
    - Operation: S7 Program Upload
    - Risk: Complete device reprogramming
    - Severity: CRITICAL
  - **WP-002**: S7comm Memory Write (FC 5)
    - Write to M-memory, write to outputs
    - Severity: CRITICAL
  - **WP-003**: EtherNet/IP CIP Tag Write
    - Risk: Field device output control
    - Severity: HIGH
  - **WP-004**: Modbus TCP Write
    - Register write access
    - Severity: MEDIUM

- Control Point Assessment (expandable):
  - Load block to module memory (ENABLED = dangerous)
  - Start download (ALLOWED = dangerous)
  - Signature verification (NOT ENFORCED = dangerous)
  - Visual indicators: ✗ for dangerous, ✓ for safe

**Action Buttons**:
- Inspect Flow
- Map to Policy
- View Log Entry

---

### 10. Report-to-Report Diffing ⭐

**Location**: Investigations → Report Diffing

![Report Diffing](./docs/screenshots/10-report-diffing.png)

**Features Displayed:**
- Side-by-side snapshot selector:
  - Baseline (Before): Plant Floor – March 1
  - Current (After): Plant Floor – March 15
  - Dropdowns to select different snapshots
  - Metadata: Device count, connection count, finding count
- Summary statistics:
  - Nodes Added (3)
  - Nodes Removed (2)
  - Fields Changed (5)
  - Edges Added (5)
  - Edges Removed (2)
- Three expandable sections:
  - **Added Nodes**: New devices (HMI-03, Sensor Gateway, WiFi AP)
  - **Removed Nodes**: Decommissioned devices
  - **Field-Level Changes**: Before/after values with color coding
    - Green highlights for additions
    - Red highlights for removals
    - Amber highlights for modifications
  - **Connection Changes**: New and removed flows

**Visual Indicators**:
- ✓ Green for additions
- ✗ Red for removals
- ⟷ Amber for modifications
- Risk-based severity colors

---

### 11. Investigation Workflows - Focus Queue ⭐

**Location**: Investigations → Focus Queue

![Investigation Workflows](./docs/screenshots/11-investigations.png)

**Features Displayed:**
- Summary statistics:
  - Queue items (6)
  - Investigating (2)
  - Critical findings (2)
  - Authentication gaps (5)
  - Write paths (1)
- Two tabs: Focus Queue and Authentication Gaps
- Priority-sorted findings:
  - **P1 - FQ-001**: Beacon Detection (CRITICAL, INVESTIGATING)
    - Device: 10.0.1.20 (HMI-STATION-01)
    - Indicator: IAT clustering 60s±2s, 98% confidence
    - Risk: Malware callback communication
  - **P2 - FQ-002**: Write Path Detection (CRITICAL, INVESTIGATING)
    - Device: 10.0.1.10 (PLC-MASTER-01)
    - Indicator: S7comm FC 28, 3x in 24h
  - **P3 - FQ-003**: Purdue Violation (HIGH, QUEUED)
  - **P4 - FQ-004**: Default Credentials (HIGH, QUEUED)
  - **P5 - FQ-005**: New Device (MEDIUM, QUEUED)
  - **P6 - FQ-006**: Authentication Gap (MEDIUM, RESOLVED)

- Expandable finding details:
  - Affected device with IP and hostname
  - Technical indicator
  - First seen timestamp
  - Investigation notes
  - Action buttons: Investigate, Share, Archive

- **Authentication Gaps Tab**:
  - Table of all auth weaknesses
  - Device, service, issue, risk level, remediation
  - Example: Modbus TCP with no authentication = HIGH risk

---

### 12. System Administration Dashboard ⭐

**Location**: Administration → System Admin

![System Administration](./docs/screenshots/12-system-admin.png)

**Features Displayed:**
- System health cards:
  - CPU: 34% (with progress bar)
  - Memory: 62% (with progress bar)
  - Disk: 48% (with progress bar)
  - Uptime: 18d 5h 23m
  - DB Size: 2.4 GB (+2.1 MB/hr)
  - Version: 0.9.2-alpha
- Performance metrics:
  - API Latency (p95): 124ms
  - PCAP Ingest Rate: 142 MB/s
  - Topology Queries: 4.2k/hr
  - Detection Latency: 2.3s avg
- Four tabs: Overview, Sessions, Tasks, Database
  - **Sessions Tab**: Active users, login times, activities, idle times
  - **Tasks Tab**: Progress bars for PCAP ingest, drift calculation, C2 detection, CVE updates
  - **Database Tab**: Table size, row counts, growth rates

- Alert section with warnings:
  - ⚠️ Disk approaching 75% (currently 68%)
  - ℹ️ PCAP ingest above baseline
  - ℹ️ Detection engine load increased

- Action buttons: Refresh, Diagnostics

---

## Security & Detection

### 13. MITRE ATT&CK for ICS

**Location**: Security & Detection → MITRE ATT&CK

![MITRE ATT&CK](./docs/screenshots/13-mitre-attck.png)

**Features Displayed:**
- Matrix grid of tactics and techniques
- 11 tactic categories across 40+ detection rules
- Detection count per technique
- Example detections:
  - **GW-001**: Modbus TCP function code anomaly
  - **GW-008**: Unauthorized HTTPS beaconing
  - **GW-015**: S7comm program download
- ICS-specific malware behavioral detection:
  - FrostyGoop
  - PIPEDREAM/INCONTROLLER
  - Industroyer2
  - TRITON/TRISIS
- Context-aware detections with source/destination IPs

---

### 14. CVE Matching & Vulnerability Management

**Location**: Security & Detection → CVE Matching

![Vulnerability Management](./docs/screenshots/14-vulnerability-management.png)

**Features Displayed:**
- Statistics row:
  - Total CVEs (12+)
  - Critical (3)
  - High (5)
  - Medium (4)
  - Patch Available (8)
  - Devices Affected (count)
- Real OT CVEs table:
  - Siemens S7-1500 Authentication Bypass (CVE-2024-38876, CVSS 9.8)
  - Modbus TCP Lack of Authentication (CVE-2024-32015, CVSS 8.6)
  - Hardcoded Credentials in HMI (CVE-2024-29104, CVSS 9.1)
  - DNP3 Buffer Overflow (CVE-2024-41203, CVSS 7.5)
- Expandable vulnerability details:
  - CVSS score
  - Affected devices
  - Remediation steps
  - Patch availability
- Default Credential Warnings section:
  - 10 ICS vendor entries with factory defaults
  - Risk assessment

---

### 15. IEC/NIST/NERC Compliance

**Location**: Compliance → IEC/NIST/NERC

![Compliance Assessment](./docs/screenshots/15-compliance.png)

**Features Displayed:**
- Three framework tabs: IEC 62443, NIST 800-82, NERC CIP
- **IEC 62443**:
  - Overall compliance donut chart
  - Zone/Conduit assessment:
    - Manufacturing Cell (SL-T/SL-A)
    - Substation
    - Site Operations
    - Data Center
    - Remote Access
  - 7 Foundational Requirements with sub-requirements
  - Expandable control details
- **NIST 800-82**:
  - 8 sections (Identify, Protect, Detect, Respond, Recover)
  - Progress bars per section
  - Compliance percentage
- **NERC CIP**:
  - 6 standards (CIP-002 through CIP-013)
  - Compliance percentage per standard
  - Audit readiness indicators

---

## Reporting & Administration

### 16. Assessment Report Generator

**Location**: Reporting → Assessment Reports

![Assessment Reports](./docs/screenshots/16-assessment-reports.png)

**Features Displayed:**
- Left panel (60%): Report builder
  - Report type selector (5 types)
  - Session selector (dropdown)
  - Sections checklist (11 sections)
  - Client information form
  - Generate button
- Right panel (40%): Live preview
  - PDF cover page preview (CONFIDENTIAL watermark)
  - Table of contents
  - Page/size estimate
- Generated reports table:
  - Report name
  - Date generated
  - Size
  - Actions: Download, View, Delete
- Export format options:
  - PDF (primary)
  - CSV
  - SBOM (SPDX/CycloneDX)
  - STIX 2.1
  - Filtered PCAP
  - Communication Allowlist

---

### 17. Sessions & Projects Management

**Location**: Operations → Sessions & Projects

![Sessions & Projects](./docs/screenshots/17-sessions-projects.png)

**Features Displayed:**
- Two tabs: Sessions and Projects
- **Sessions Tab**:
  - Session list with:
    - Name and creation date
    - Active/Baseline/Archived status
    - Device/connection count
    - Drift score
    - Export as .gwf archive button
  - Example sessions:
    - Plant Floor Assessment (Active)
    - Baseline Week 1 (Baseline)
    - Emergency Response (Archived)
- **Projects Tab**:
  - Project list with:
    - Client name
    - Assessment dates
    - Assessor name
    - Status
  - Example projects:
    - Acme Industrial Inc
    - Municipal Utility District
    - Fortune 500 Manufacturing

---

### 18. Baseline Drift Detection

**Location**: Security & Detection → Baseline Drift

![Baseline Drift](./docs/screenshots/18-baseline-drift.png)

**Features Displayed:**
- Session comparison selector
- Drift score gauge (23%)
- Drift categories:
  - **New Assets** (5 devices added)
    - Device names, IP addresses, device types
  - **Missing Assets** (2 devices removed)
  - **Changed Assets** (8 modifications)
    - Firmware updates
    - New protocols
    - Port changes
- Connection changes table:
  - New flows established
  - Removed flows
  - Changed flow properties
- Drift score timeline chart:
  - Historical drift trend
  - Trend line
  - Spike detection

---

## Feature Comparison

| Feature | Core | New | Status |
|---------|------|-----|--------|
| PCAP Import | ✓ | — | Stable |
| Live Capture | ✓ | ✨ | v0.9.2 |
| Topology Visualization | ✓ | — | Stable |
| Device Inventory | ✓ | — | Stable |
| Protocol Analysis | ✓ | — | Stable |
| MITRE ATT&CK | ✓ | — | Stable |
| C2 Detection | — | ✨ | v0.9.2 |
| Purdue Violations | — | ✨ | v0.9.2 |
| Write Paths | — | ✨ | v0.9.2 |
| Report Diffing | — | ✨ | v0.9.2 |
| Focus Queue | — | ✨ | v0.9.2 |
| System Admin | — | ✨ | v0.9.2 |
| CVE Matching | ✓ | — | Stable |
| Compliance | ✓ | — | Stable |
| Assessment Reports | ✓ | — | Stable |
| Sessions & Projects | ✓ | — | Stable |
| Baseline Drift | ✓ | — | Stable |

---

## Navigation Flow

```
Entry Point: http://localhost:5174
     ↓
Command Center (Dashboard Overview)
     ↓
Choose Path:
     ├─→ Discovery Path
     │    ├─ PCAP Analysis
     │    ├─ Live Capture (NEW)
     │    ├─ Topology
     │    ├─ Device Inventory
     │    └─ Protocol Analysis
     │
     ├─→ Security Path
     │    ├─ C2/Beacon Detection (NEW)
     │    ├─ Purdue Violations (NEW)
     │    ├─ Write Paths (NEW)
     │    ├─ MITRE ATT&CK
     │    ├─ CVE Matching
     │    └─ Baseline Drift
     │
     ├─→ Investigation Path
     │    ├─ Focus Queue (NEW)
     │    └─ Report Diffing (NEW)
     │
     ├─→ Compliance Path
     │    └─ IEC/NIST/NERC
     │
     ├─→ Reporting Path
     │    ├─ Assessment Reports
     │    └─ Export & STIX
     │
     └─→ Administration Path
          └─ System Admin (NEW)
```

---

## Screenshot Legend

| Icon | Meaning |
|------|---------|
| ✨ | New in v0.9.2 |
| ✓ | Stable/Mature feature |
| — | Core feature |
| 🔴 | Critical severity |
| 🟠 | High severity |
| 🟡 | Medium severity |
| 🔵 | Low severity |

---

**Last Updated**: March 27, 2026 | **Version**: 0.9.2-alpha

For detailed feature documentation, see [FEATURES.md](./FEATURES.md)
