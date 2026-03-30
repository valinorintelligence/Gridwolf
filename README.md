<p align="center">
  <img src="frontend/public/logo.png" width="80" alt="Gridwolf Logo" />
</p>

<h1 align="center">Gridwolf</h1>

<p align="center">
  <strong>Passive ICS/SCADA Network Discovery & Security Assessment Platform</strong><br/>
  Full-Stack OT Security Tool with Real PCAP Processing, Protocol Dissection & Threat Detection
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0--beta-blue" />
  <img src="https://img.shields.io/badge/ICS%20Protocols-6%20Deep%20Parsers-orange" />
  <img src="https://img.shields.io/badge/MITRE%20ATT%26CK-ICS-red" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%2B%20Scapy-green" />
  <img src="https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-61dafb" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

## What is Gridwolf?

Gridwolf is a **fully functional** passive ICS/SCADA network discovery and security assessment platform. It analyzes captured network traffic (PCAP files) to automatically identify industrial devices, map communication patterns, detect protocol anomalies, perform C2/beacon detection, match CVEs, and generate professional assessment reports — **without transmitting a single packet** to the monitored network.

Unlike tools that are just dashboards on top of mock data, Gridwolf has a **real processing backend** powered by Scapy, with deep packet inspection for 6 ICS protocols, a C2 beacon detection engine, NVD CVE integration, and PDF report generation.

> **Gridwolf never actively scans or probes the industrial network. All discovery is done by passive traffic analysis only.**

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)                  │
│  27 Pages · Topology Graph · Protocol Analysis · Dark Theme    │
├────────────────────────────────────────────────────────────────┤
│                         REST API                               │
├────────────────────────────────────────────────────────────────┤
│                  Backend (FastAPI + Python)                     │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  PCAP    │ │  Protocol    │ │    C2      │ │   CVE      │  │
│  │Processor │ │  Parsers     │ │ Detector   │ │  Lookup    │  │
│  │ (Scapy)  │ │ (6 parsers)  │ │(IAT/DNS/  │ │(NVD API +  │  │
│  │          │ │              │ │ Asymmetric)│ │ Offline DB)│  │
│  └──────────┘ └──────────────┘ └────────────┘ └────────────┘  │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐                 │
│  │  Report  │ │   Device     │ │   Risk     │                 │
│  │Generator │ │ Classifier   │ │Assessment  │                 │
│  │(PDF/HTML)│ │(Purdue/OUI)  │ │  Engine    │                 │
│  └──────────┘ └──────────────┘ └────────────┘                 │
├────────────────────────────────────────────────────────────────┤
│              SQLite Database (aiosqlite)                        │
│  17 Tables · Sessions · Devices · Connections · Findings       │
└────────────────────────────────────────────────────────────────┘
```

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

### Real PCAP Processing Engine (Not Mock Data)

Gridwolf includes a **fully functional backend** — not just a UI prototype. When you upload a PCAP file, the system:

1. **Ingests** — Streams packets via Scapy's `PcapReader` (handles large files efficiently)
2. **Dissects** — Deep packet inspection for 6 ICS protocols with function code analysis
3. **Classifies** — Assigns device types, Purdue levels, vendors (38 OUI prefixes)
4. **Detects** — Runs C2 beacon detection, Purdue violation checks, write path analysis
5. **Stores** — Persists all results in SQLite with 17 normalized tables

### ICS Protocol Deep Packet Inspection

| Protocol | Port | What Gridwolf Extracts |
|---|---|---|
| **Modbus TCP** | 502 | MBAP header, function codes (FC 1-43), register addresses, write detection, master/slave identification |
| **S7comm (Siemens)** | 102 | TPKT/COTP/S7 header parsing, job types (0x01-0x07), program upload/download flagging |
| **EtherNet/IP / CIP** | 44818 | Encapsulation header, CIP service codes, tag read/write operations |
| **DNP3** | 20000 | DLL + transport + application layer, master/outstation detection, object group parsing |
| **BACnet** | 47808 | BVLC/NPDU/APDU parsing, service identification, I-Am/Who-Is discovery |
| **IEC 60870-5-104** | 2404 | APDU type detection (I/S/U format), type ID parsing, cause of transmission |

### C2 / Beacon Detection Engine

Three independent detection methods run on every session:

- **IAT Histogram Analysis** — Detects periodic beaconing by analyzing inter-arrival time distributions. Uses coefficient of variation threshold (<0.15) with ICS polling exclusion to reduce false positives
- **DNS Exfiltration Detection** — Shannon entropy analysis per DNS subdomain label. Flags labels with entropy >4.0 (typical of base64/hex encoded data tunneling)
- **Asymmetric Flow Analysis** — Identifies suspicious data transfers with TX:RX ratio >20:1 and total volume >100KB

### CVE Vulnerability Matching

- **Offline ICS CVE Database** — 12 pre-loaded real OT CVEs (Siemens, Schneider Electric, Rockwell Automation, ABB, Fortinet, Moxa)
- **NVD API v2.0 Integration** — Live search against NIST National Vulnerability Database with optional API key
- **Device Matching** — Fuzzy matches discovered device vendors/firmware against known CVEs

### Professional Report Generation

- **PDF Reports** — WeasyPrint-powered professional assessment reports with cover page, executive summary, device tables, protocol analysis, findings, and recommendations
- **HTML Fallback** — Complete HTML report when WeasyPrint is not installed
- **Report Sections** — Executive Summary, Device Inventory, Protocol Analysis, Security Findings, Recommendations

### Network Topology & Device Classification

- **Purdue Model Assignment** — Automatic L0-L5 + DMZ classification based on protocol behavior
- **Device Type Detection** — PLC, HMI, Engineering Workstation, Historian, RTU, IED, Gateway
- **Vendor Identification** — 38 OUI MAC address prefixes covering Siemens, ABB, Rockwell, Schneider, Moxa, Beckhoff, Phoenix Contact, and more
- **Confidence Scoring** — 5-level scoring (port-only → deep parse)

### Security Assessment

- **MITRE ATT&CK for ICS** — 40+ detection rules mapped to techniques
- **Purdue Violation Detection** — Automated cross-zone communication anomaly detection
- **Write/Program Path Detection** — Flags dangerous Modbus writes, S7 program uploads, CIP tag writes
- **Default Credential Detection** — Checks for common ICS default passwords
- **Baseline Drift** — Quantified drift score between assessment sessions

### 40+ REST API Endpoints

| Category | Endpoints | Description |
|---|---|---|
| **Auth** | 4 | Register, login, demo login, profile |
| **PCAP** | 3 | Upload, status, list |
| **Devices** | 4 | List, topology, stats, detail |
| **Sessions** | 6 | CRUD + projects |
| **Findings** | 4 | List, stats, status update |
| **CVE** | 2 | Search NVD, match devices |
| **Reports** | 3 | Generate, download, list |
| **Ontology** | 4 | Types, graph, CRUD |
| **Dashboard** | 3 | Stats, saved dashboards |
| **Scanners** | 4 | Semgrep, Trivy, SARIF, generic import |

---

## Installation

### Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Python | >= 3.9 | Backend |
| Node.js | >= 18.0 | Frontend |
| npm | >= 9.0 | Frontend |
| Git | any | Version control |

### Quick Start (Full Stack)

```bash
# 1. Clone the repository
git clone https://github.com/valinorintelligence/Gridwolf.git
cd Gridwolf

# 2. Start the Backend
cd backend
python3 -m pip install -e ".[dev]"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 3. In a new terminal — Start the Frontend
cd frontend
npm install
npm run dev
```

- **Backend API**: http://localhost:8000 (Swagger docs at `/docs`)
- **Frontend UI**: http://localhost:5174
- **Demo Login**: Click "Demo Login" on the login page — no credentials needed

### Backend Optional Dependencies

```bash
# For PDF report generation
pip install "gridwolf[pdf]"

# For PostgreSQL (production deployments)
pip install "gridwolf[postgres]"

# Install everything
pip install "gridwolf[full]"
```

### Environment Variables

Create `backend/.env` for backend configuration:

```env
GRIDWOLF_DATABASE_URL=sqlite+aiosqlite:///./gridwolf.db
GRIDWOLF_SECRET_KEY=your-secret-key-change-in-production
GRIDWOLF_NVD_API_KEY=your-nvd-api-key        # Optional: for faster CVE lookups
GRIDWOLF_DEBUG=true
```

Create `frontend/.env.local` for frontend overrides:

```env
VITE_API_URL=http://localhost:8000
VITE_DEMO_MODE=true
```

---

## Usage

### 1. Upload a PCAP for Analysis

```bash
# Via API
curl -X POST http://localhost:8000/api/v1/ics/pcap/upload \
  -F "file=@capture.pcap" \
  -F "session_name=Plant Assessment Q1"

# Check processing status
curl http://localhost:8000/api/v1/ics/pcap/status/{pcap_id}
```

Or use the **Capture → PCAP Analysis** page in the UI to drag-and-drop a PCAP file.

### 2. Explore Discovered Devices

```bash
# List all devices in a session
curl http://localhost:8000/api/v1/ics/devices/?session_id={session_id}

# Get network topology (nodes + edges)
curl http://localhost:8000/api/v1/ics/devices/topology?session_id={session_id}

# Device statistics
curl http://localhost:8000/api/v1/ics/devices/stats?session_id={session_id}
```

### 3. Review Security Findings

```bash
# List findings by severity
curl http://localhost:8000/api/v1/ics/findings/?severity=critical

# Match devices against CVE database
curl http://localhost:8000/api/v1/ics/findings/cve/match-devices?session_id={session_id}

# Search NVD for CVEs
curl http://localhost:8000/api/v1/ics/findings/cve/search?keyword=siemens+s7
```

### 4. Generate Assessment Report

```bash
curl -X POST http://localhost:8000/api/v1/ics/findings/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "...",
    "report_type": "full",
    "client_name": "Acme Industrial",
    "assessor_name": "OT Security Team"
  }'
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite 8 | 27-page SPA with dark-first design |
| **Styling** | Tailwind CSS 4 | Palantir-inspired dense UI |
| **State** | Zustand | Client-side state management |
| **Visualization** | Cytoscape.js + Recharts | Topology graphs + analytics |
| **Backend** | FastAPI (async) | 40+ REST API endpoints |
| **PCAP Engine** | Scapy | Deep packet inspection |
| **Database** | SQLite (aiosqlite) / PostgreSQL | 17 normalized tables |
| **Auth** | JWT (python-jose) + bcrypt | Token-based authentication |
| **Reports** | WeasyPrint / HTML | Professional PDF generation |
| **CVE Data** | NVD API v2.0 + offline DB | Vulnerability matching |

---

## Project Structure

```
Gridwolf/
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── pages/                     # 27 page components
│   │   ├── components/                # Reusable UI components
│   │   ├── layouts/                   # App and Auth layouts
│   │   ├── routes/                    # React Router configuration
│   │   ├── lib/                       # Constants, utilities
│   │   └── store/                     # Zustand state management
│   └── vite.config.ts
├── backend/                           # FastAPI backend
│   └── app/
│       ├── core/                      # Config, database, JWT security
│       ├── models/                    # SQLAlchemy models (17 tables)
│       │   ├── user.py                # User authentication model
│       │   ├── ontology.py            # Object types, links, actions, audit logs
│       │   └── ics.py                 # Sessions, devices, connections, findings, reports
│       ├── engine/                    # Processing engines
│       │   ├── pcap_processor.py      # Scapy PCAP ingestion pipeline
│       │   ├── protocol_parsers.py    # 6 ICS protocol deep parsers
│       │   ├── c2_detector.py         # C2 beacon/exfiltration detection
│       │   ├── cve_lookup.py          # NVD API + offline CVE database
│       │   └── report_generator.py    # PDF/HTML report generation
│       ├── schemas/                   # Pydantic v2 validation
│       ├── services/                  # Business logic
│       └── api/v1/                    # REST API routers
│           ├── auth.py                # Authentication endpoints
│           ├── ics/                    # ICS-specific endpoints
│           │   ├── pcap.py            # PCAP upload & processing
│           │   ├── devices.py         # Device inventory & topology
│           │   ├── sessions.py        # Session & project management
│           │   └── findings.py        # Findings, CVE, reports
│           ├── ontology.py            # Object type management
│           ├── objects.py             # Object CRUD
│           ├── dashboard.py           # Dashboard stats
│           └── scanners.py            # External tool import
├── docs/
│   └── screenshots/                   # 27 application screenshots
└── scripts/
    └── take-screenshots.mjs           # Puppeteer screenshot utility
```

---

## API Documentation

Once the backend is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Database Schema (17 Tables)

| Table | Purpose |
|---|---|
| `users` | Authentication and user profiles |
| `object_types` | Ontology schema definitions |
| `objects` | Generic entity instances |
| `links` | Typed relationships between objects |
| `actions` | Available operations on object types |
| `audit_logs` | Timeline events for any object |
| `saved_dashboards` | User-saved dashboard layouts |
| `integrations` | External tool configurations |
| `projects` | Multi-client project organization |
| `sessions` | Assessment sessions with stats |
| `pcap_files` | Uploaded PCAP metadata and status |
| `devices` | Discovered device inventory |
| `connections` | Network connection flows |
| `protocol_analysis` | ICS protocol dissection results |
| `findings` | Security findings and alerts |
| `reports` | Generated assessment reports |

---

## Contributing

Gridwolf is open source and welcomes contributions. Areas of interest:

- Additional ICS protocol parsers (OPC UA, PROFINET DCP, GOOSE/MMS)
- More MITRE ATT&CK for ICS detection rules
- Threat intelligence feed integration (STIX/TAXII)
- Scheduled assessment automation
- Multi-user RBAC enhancements

---

## License

MIT License - Valinorin Intelligence

---

<p align="center">
  Built for the OT security community by <a href="https://github.com/valinorintelligence">Valinorin Intelligence</a>
</p>
