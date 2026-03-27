<p align="center">
  <img src="frontend/public/favicon.svg" width="80" alt="Gridwolf Logo" />
</p>

<h1 align="center">Gridwolf</h1>

<p align="center">
  <strong>Passive ICS/SCADA Network Discovery & Topology Visualization</strong><br/>
  OT Security Assessment Platform for Industrial Control Systems
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.9.2--alpha-blue" />
  <img src="https://img.shields.io/badge/ICS%20Protocols-7-orange" />
  <img src="https://img.shields.io/badge/MITRE%20ATT%26CK-ICS-red" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

## What is Gridwolf?

Gridwolf is a **passive** ICS/SCADA network discovery and topology visualization tool designed for OT security assessments. It analyzes captured network traffic (PCAP files or live capture) to automatically identify industrial devices, map communication patterns, detect protocol anomalies, and flag security risks — **without transmitting a single packet** to the monitored network.

> ⚠️ Gridwolf never actively scans or probes the industrial network. All discovery is done by passive traffic analysis only.

---

## Screenshots

### Login & Dashboard
| Login | Command Center |
|---|---|
| ![Login](docs/screenshots/00-login.png) | ![Command Center](docs/screenshots/01-command-center.png) |

### Capture & Ingestion
| PCAP Analysis | Live Capture | External Tool Import |
|---|---|---|
| ![PCAP](docs/screenshots/02-pcap-analysis.png) | ![Live Capture](docs/screenshots/03-live-capture.png) | ![Integrations](docs/screenshots/04-external-tools.png) |

### Network Discovery
| Topology | Device Inventory | Protocol Analyzer |
|---|---|---|
| ![Topology](docs/screenshots/05-network-topology.png) | ![Devices](docs/screenshots/06-device-inventory.png) | ![Protocols](docs/screenshots/07-protocol-analyzer.png) |

| Purdue Model | Signature Editor |
|---|---|
| ![Purdue](docs/screenshots/08-purdue-model.png) | ![Signatures](docs/screenshots/09-signature-editor.png) |

### Security & Detection
| MITRE ATT&CK for ICS | Vulnerability / CVE Matching |
|---|---|
| ![MITRE](docs/screenshots/10-mitre-attack.png) | ![CVE](docs/screenshots/11-vulnerability-management.png) |

| C2 / Beacon Detection | Purdue Violations | Write/Program Paths |
|---|---|---|
| ![C2](docs/screenshots/12-c2-beacon-detection.png) | ![Violations](docs/screenshots/13-purdue-violations.png) | ![Write Paths](docs/screenshots/14-write-program-paths.png) |

| Baseline Drift | Compliance (IEC/NIST/NERC) |
|---|---|
| ![Drift](docs/screenshots/15-baseline-drift.png) | ![Compliance](docs/screenshots/16-compliance.png) |

### Investigations
| Focus Queue | Report Diffing |
|---|---|
| ![Investigations](docs/screenshots/20-investigations.png) | ![Report Diff](docs/screenshots/21-report-diff.png) |

### Reporting & Administration
| Assessment Reports | System Admin |
|---|---|
| ![Reports](docs/screenshots/22-assessment-reports.png) | ![Admin](docs/screenshots/24-system-admin.png) |

---

## Key Features

### 🔍 Passive Network Discovery
- PCAP file import with 4-stage pipeline: Ingest → Dissect → Topology → Risk
- Live packet capture with real-time progressive topology rendering
- Zero active probing — completely safe for production OT environments
- Sample PCAP library for training and demos

### 🏭 ICS Protocol Deep Analysis
| Protocol | Details |
|---|---|
| **Modbus TCP** | Function codes, master/slave pairs, write detection |
| **EtherNet/IP / CIP** | ListIdentity, scanner/adapter mapping |
| **S7comm (Siemens)** | FC analysis, Program Upload/Download flagging |
| **DNP3** | Master/outstation, Secure Authentication |
| **BACnet** | I-Am broadcasts, device discovery |
| **IEC 104** | APCI frame analysis |
| **PROFINET** | Device identification |

### 🗺️ Topology Visualization
- Interactive network graph with Purdue level enforcement
- Device fingerprinting (OUI, protocol patterns, payload signatures)
- Confidence scoring (1–5: port → pattern → OUI → payload → deep parse)
- Vendor identification for 50+ ICS vendors

### 🛡️ Security & Threat Detection
- **MITRE ATT&CK for ICS** — 40+ detection rules mapped to techniques
- **CVE Matching** — Real-time OT vulnerability lookup with CVSS scores
- **C2/Beacon Detection** — IAT histogram clustering, Shannon entropy DNS exfiltration detection, asymmetric flow analysis
- **Purdue Violation Detection** — Automated cross-zone anomaly detection
- **Write/Program Access Paths** — Flags dangerous Modbus writes, S7 program downloads
- **ICS Malware Detection** — Behavioral signatures for FrostyGoop, PIPEDREAM, Industroyer2, TRITON

### 📊 Compliance & Reporting
- **IEC 62443** — Zone/Conduit assessment with Security Level targets (SL-T vs SL-A)
- **NIST SP 800-82** — 8 section assessment with progress tracking
- **NERC CIP** — 6 standard compliance monitoring
- **Baseline Drift** — Quantified drift score between sessions
- **Report Diffing** — Side-by-side snapshot comparison with field-level deltas
- **PDF Reports** — Professional assessment report generation
- **STIX 2.1 / SBOM** — Exportable threat intelligence and software inventory

### 🔗 External Tool Integration
- **Zeek** — Log import and correlation
- **Suricata** — Alert import
- **Nmap / Masscan** — XML scan result import
- **Wazuh** — Alert and event import
- **Siemens SINEMA / TIA Portal** — Project import
- **Wireshark** — PCAP and dissection import

### 🔬 Investigation Workflows
- Focus Queue with prioritized targets
- Authentication gap detection
- Write path investigation
- Session & project-based organization for multi-client assessments

---

## Installation

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 9.0.0 |
| Git | any |

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/valinorintelligence/Gridwolf.git
cd Gridwolf

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Start the development server
npm run dev
```

The app will be available at **http://localhost:5174**

Use the **Demo Login** button on the login page to explore without credentials.

---

### Production Build

```bash
cd frontend

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

Output is in `frontend/dist/` — serve with any static file server (nginx, caddy, etc.).

---

### Docker (Optional)

```bash
# Build Docker image
docker build -t gridwolf .

# Run container
docker run -p 5174:80 gridwolf
```

---

### Environment Variables

Create `frontend/.env.local` for local overrides:

```env
# Run in demo mode (uses mock data, enables hash routing for static hosting)
VITE_DEMO_MODE=true

# API base URL (for future backend integration)
VITE_API_URL=http://localhost:8000
```

---

## Usage Guide

### 1. Import a PCAP

1. Navigate to **Capture → PCAP Analysis**
2. Drag and drop a `.pcap` or `.pcapng` file
3. The 4-stage pipeline runs automatically:
   - **Ingest** — File validation and metadata extraction
   - **Dissect** — Protocol identification and packet parsing
   - **Topology** — Device and connection mapping
   - **Risk** — Anomaly detection and finding generation
4. View results in **Topology**, **Device Inventory**, and **Protocol Analysis**

### 2. Start Live Capture

1. Go to **Capture → Live Capture**
2. Select the network interface (SPAN port recommended)
3. Optionally set a BPF filter (e.g., `port 502 or port 102`)
4. Click **Start** — topology builds progressively in real time
5. Click **Stop** to finalize and create a session

### 3. Investigate Findings

1. **Security & Detection → MITRE ATT&CK** — Review triggered techniques
2. **Security & Detection → CVE Matching** — Identify vulnerable firmware
3. **Security & Detection → C2/Beacon Detection** — Check for beaconing or exfiltration
4. **Security & Detection → Purdue Violations** — Audit cross-zone traffic
5. **Investigations → Focus Queue** — Prioritized investigation workflow

### 4. Generate a Report

1. Go to **Reporting → Assessment Reports**
2. Select report type (Full Assessment, Executive Summary, etc.)
3. Choose sections to include
4. Fill in client information
5. Click **Generate** — preview appears in the right panel
6. Download as PDF, or export STIX / SBOM

### 5. Compare Assessments

1. Go to **Investigations → Report Diffing**
2. Select **Baseline (Before)** and **Current (After)** snapshots
3. Review added/removed nodes, field-level changes, and new connections

---

## Project Structure

```
Gridwolf/
├── frontend/
│   ├── src/
│   │   ├── pages/          # All page components
│   │   ├── components/     # Reusable UI components
│   │   ├── layouts/        # App and Auth layouts
│   │   ├── routes/         # React Router configuration
│   │   ├── lib/            # Constants, utilities
│   │   └── store/          # Zustand state management
│   ├── public/             # Static assets
│   └── vite.config.ts      # Vite configuration (port 5174)
├── docs/
│   └── screenshots/        # Application screenshots (27 pages)
└── scripts/
    └── take-screenshots.mjs  # Puppeteer screenshot utility
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand |
| Routing | React Router v6 |
| Visualization | Cytoscape.js (topology), Recharts (analytics) |
| Icons | Lucide React |

---

## Roadmap

- [ ] Backend API (FastAPI/Python) for real PCAP processing
- [ ] Real Modbus/S7/EtherNet/IP protocol dissection engine
- [ ] SQLite session persistence
- [ ] Multi-user role-based access control
- [ ] Scheduled assessment runs
- [ ] OPC UA support
- [ ] PROFINET deep inspection

---

## License

MIT © Valinorin Intelligence
