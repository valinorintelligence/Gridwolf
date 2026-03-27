# LinkedIn Post — Gridwolf v1.0 Launch

---

## Short Version (Recommended — fits LinkedIn well)

---

Excited to open-source **Gridwolf** — a passive ICS/SCADA network discovery and security assessment platform I've been building.

Unlike most OT security tools that stop at dashboards and mock data, Gridwolf has a **fully functional processing backend**:

**What it actually does:**
- Upload a PCAP from an OT network → it processes every packet with Scapy
- Deep packet inspection for 6 ICS protocols (Modbus TCP, S7comm, EtherNet/IP, DNP3, BACnet, IEC 104)
- Automatically discovers devices, assigns Purdue model levels, identifies vendors from 38 OUI prefixes
- Runs C2 beacon detection using IAT histogram analysis, DNS entropy scoring, and asymmetric flow detection
- Matches discovered devices against CVEs via NVD API
- Generates professional PDF assessment reports

**The numbers:**
- 40+ REST API endpoints
- 17 database tables
- 6 ICS protocol deep parsers
- 27 frontend pages
- Zero active packets sent — 100% passive analysis

**Tech stack:**
- Frontend: React 19 + TypeScript + Tailwind CSS 4
- Backend: FastAPI + Scapy + SQLAlchemy
- Database: SQLite (dev) / PostgreSQL (prod)
- Auth: JWT with bcrypt

Built for OT security assessors, ICS pentesters, and anyone doing industrial network security assessments.

GitHub: https://github.com/valinorintelligence/Gridwolf

#OTSecurity #ICS #SCADA #CyberSecurity #OpenSource #IndustrialSecurity #NetworkSecurity #Python #FastAPI #React #InfrastructureSecurity #MITRE #PurdueModel

---

## Long Version (More detail)

---

I'm excited to share **Gridwolf** — an open-source passive ICS/SCADA network discovery and security assessment platform.

**Why I built this:**

Most OT security assessment tools are either expensive enterprise products or UI prototypes with mock data. I wanted something that actually processes real network captures and gives you actionable intelligence — and I wanted it to be open source.

**What makes Gridwolf different — it's a real processing engine, not just a dashboard:**

When you upload a PCAP file from an OT network, Gridwolf doesn't just display pretty charts. It:

1. **Streams every packet through Scapy** — handles multi-GB captures efficiently
2. **Deep-inspects 6 ICS protocols** — Modbus TCP (function codes, register addresses, write detection), S7comm (TPKT/COTP/S7 headers, program upload flagging), EtherNet/IP/CIP (encapsulation + CIP service detection), DNP3 (master/outstation identification), BACnet (BVLC/NPDU/APDU parsing), IEC 60870-5-104 (APDU type detection)
3. **Classifies every device** — assigns device types (PLC, HMI, RTU, Engineering Workstation), Purdue model levels (L0-L5 + DMZ), and identifies vendors from 38 OUI MAC prefixes
4. **Detects threats** — C2 beacon detection via IAT histogram clustering (coefficient of variation <0.15), DNS exfiltration via Shannon entropy analysis (threshold >4.0), asymmetric flow analysis (TX:RX >20:1)
5. **Matches CVEs** — queries NVD API v2.0 and cross-references an offline database of real OT CVEs
6. **Generates reports** — professional PDF assessment reports with executive summary, device inventory, protocol analysis, findings, and recommendations

**By the numbers:**
- 40+ REST API endpoints (auth, PCAP, devices, sessions, findings, CVE, reports, ontology)
- 17 normalized database tables
- 6 ICS protocol deep packet inspectors
- 27 frontend pages with Palantir-inspired dark UI
- 38 ICS vendor OUI prefixes (Siemens, ABB, Rockwell, Schneider, Moxa, Beckhoff, Phoenix Contact...)
- 12 pre-loaded real OT CVEs for offline matching

**Tech stack:**
- Frontend: React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Zustand + Cytoscape.js
- Backend: FastAPI + Scapy + SQLAlchemy (async) + Pydantic v2
- Database: SQLite for zero-dependency dev, PostgreSQL for production
- Auth: JWT (python-jose) + bcrypt
- Reports: WeasyPrint PDF generation

**Who is this for?**
- OT security assessors and consultants
- ICS penetration testers
- Industrial network engineers
- Security researchers studying ICS protocols
- Anyone doing passive network analysis on OT environments

The entire platform is **100% passive** — it never sends a single packet to the monitored network. Safe for production ICS environments.

**Get started in 3 commands:**
```
git clone https://github.com/valinorintelligence/Gridwolf.git
cd Gridwolf/backend && pip install -e . && uvicorn app.main:app
cd Gridwolf/frontend && npm install && npm run dev
```

GitHub: https://github.com/valinorintelligence/Gridwolf

Would love feedback from the OT security community. What protocols or features would you want to see next? OPC UA? PROFINET DCP? GOOSE/MMS?

#OTSecurity #ICS #SCADA #CyberSecurity #OpenSource #IndustrialSecurity #NetworkSecurity #Python #FastAPI #React #InfrastructureSecurity #MITRE #PurdueModel #ICSsecurity #CriticalInfrastructure #Modbus #DNP3 #EthernetIP #Siemens #PenetrationTesting

---

## Image Suggestions for LinkedIn Post

1. **Primary image**: Screenshot of the Command Center dashboard (docs/screenshots/01-command-center.png)
2. **Carousel images** (if doing a carousel post):
   - Command Center dashboard
   - Network Topology view
   - C2/Beacon Detection page
   - Protocol Analyzer
   - MITRE ATT&CK for ICS
   - The architecture diagram from README
