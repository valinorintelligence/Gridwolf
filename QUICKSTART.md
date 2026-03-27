# Gridwolf Quick Start Guide

Get Gridwolf running in 5 minutes for your first network assessment.

## ⚡ 5-Minute Setup

### 1. Install Prerequisites (1 min)

```bash
# Check if you have Node.js 18+
node --version
npm --version

# If not installed, install from https://nodejs.org/
```

### 2. Clone & Install (2 min)

```bash
git clone https://github.com/valinorintelligence/Gridwolf.git
cd Gridwolf/frontend
npm install
```

### 3. Start Development Server (1 min)

```bash
npm run dev

# Server runs on http://localhost:5174
```

### 4. Open in Browser (1 min)

```
http://localhost:5174
```

---

## 🎯 First Assessment (10 minutes)

### Step 1: Create Account
- **Email**: your-email@domain.com
- **Password**: Strong password (8+ chars)
- **Organization**: Your organization name
- **Role**: Select "Security Analyst" or "Administrator"

### Step 2: Import PCAP
1. Go to **Capture → PCAP Analysis**
2. Click **Import PCAP** tab
3. Drag-drop your `.pcap` file
4. Wait for 4-stage pipeline to complete

### Step 3: Explore Network
1. Navigate to **Discovery → Topology**
2. Pan/zoom to view all devices
3. Click devices to see details (vendor, firmware, ports)
4. Look for suspicious connections

### Step 4: Check Security Findings
1. Go to **Security & Detection → C2/Beacon Detection**
2. Review beacon detections and DNS exfiltration
3. Check **MITRE ATT&CK** for detected techniques
4. Review **CVE Matching** for vulnerabilities

### Step 5: Generate Report
1. Navigate to **Reporting → Assessment Reports**
2. Select report type (Executive, Technical, or Detailed)
3. Configure sections to include
4. Click **Generate** → Download PDF

---

## 🚀 Common Workflows

### Run Live Capture (On-Site Assessment)

```bash
# 1. Start Gridwolf on your laptop
npm run dev

# 2. Connect to network SPAN port or TAP
# 3. Open Gridwolf: http://localhost:5174

# 4. Navigate to: Capture → Live Capture
# 5. Select interface (eth0, eth1, en0, etc.)
# 6. Click "Start Capture"
# 7. Watch real-time topology appear

# 8. After 30 minutes-2 hours of capture:
# 9. Click "Stop" to finalize capture
# 10. Analysis continues automatically
```

### Compare Network Against Baseline

```
1. Import your baseline PCAP (Week 1)
   → Sessions & Projects → Save as "Baseline"

2. Import new PCAP (Week 2)
   → Investigations → Report Diffing

3. Select:
   • Baseline (Before): Week 1 baseline
   • Current (After): Week 2 capture

4. Review differences:
   • Nodes Added (new devices?)
   • Nodes Removed (decommissioned?)
   • Fields Changed (firmware updated?)
   • Edges Added (new connections?)
```

### Investigate C2 Beacon

```
1. Security & Detection → C2/Beacon Detection
2. Sort by "Confidence" (descending)
3. Click highest confidence beacon
4. Note:
   • Source IP & hostname
   • Destination IP
   • Interval (how often it connects)
   • Duration (how long has this been happening)

5. Remediation:
   • Block destination IP at firewall
   • Isolate source device
   • Check for malware on source
   • Review recent firmware/software changes
```

### Find Write Paths (Dangerous Control Access)

```
1. Security & Detection → Write/Program Paths
2. Sort by "Severity" (critical first)
3. Review control operations:
   • S7 Program Upload = program injection risk
   • Modbus Write = unauthorized output control
   • CIP Tag Write = direct device manipulation

4. Check control point assessment:
   • ✓ Safe = write authentication enforced
   • ✗ Dangerous = no protection, unauthorized access possible

5. Remediation:
   • Implement role-based access control
   • Enable digital signatures on program uploads
   • Disable unnecessary write operations
   • Segment network with unidirectional gateways
```

### Check Compliance

```
1. Compliance → IEC/NIST/NERC
2. Select framework:
   • IEC 62443 (Industrial automation)
   • NIST 800-82 (Critical infrastructure)
   • NERC CIP (Power grid)

3. Review zones/conduits and score
4. Expand each section to see:
   • Current compliance %
   • Missing controls
   • Remediation steps
```

---

## 📊 Navigation Guide

### Left Sidebar Sections

**OVERVIEW**
- Command Center — Dashboard with KPIs

**CAPTURE**
- PCAP Analysis — Import and analyze network captures
- Live Capture — Real-time topology during packet capture
- Tool Import — Import from Zeek, Suricata, Nmap, etc.
- External Tools — Integration management

**DISCOVERY**
- Topology — Network graph visualization
- Device Inventory — All devices table
- Protocol Analysis — Deep protocol dissection
- Purdue Model — ISA-95 reference model
- Signatures — Device signature editor

**SECURITY & DETECTION**
- MITRE ATT&CK — ICS technique mapping (40+ rules)
- CVE Matching — Vulnerability correlation
- **C2/Beacon Detection** — Malicious traffic detection
- **Purdue Violations** — Cross-zone anomalies
- **Write/Program Paths** — Dangerous control access
- Baseline Drift — Session comparison

**COMPLIANCE**
- IEC/NIST/NERC — Framework compliance
- SBOM — Software Bill of Materials

**ANALYTICS**
- Scorecard — Risk metrics dashboard
- Metrics — Detailed analytics
- Timeline — Network activity timeline

**OPERATIONS**
- Sessions & Projects — Assessment management
- Workshop — Interactive testing

**INVESTIGATIONS**
- Focus Queue — Prioritized findings queue
- Report Diffing — Snapshot comparison

**REPORTING**
- Assessment Reports — PDF generation
- Export & STIX — Data export formats

**ADMINISTRATION**
- System Admin — Resource monitoring & diagnostics

**AI**
- AI Copilot — AI-assisted analysis (future)

---

## 🎓 Key Concepts

### Purdue Model Levels

- **L0**: Sensors, actuators, motors (field devices)
- **L1**: PLCs, RTUs, field I/O (basic control)
- **L2**: HMI, SCADA, edge gateways (supervisory)
- **L3**: MES, historian, engineering workstations (operations)
- **L4**: ERP, business systems (enterprise)
- **L5**: Internet, cloud services (external)
- **DMZ**: Firewalls, proxies, gateways (demilitarized)

### Risk Severity Levels

- 🔴 **CRITICAL** — Exploit immediately likely, immediate remediation required
- 🟠 **HIGH** — Significant risk, remediate within weeks
- 🟡 **MEDIUM** — Moderate risk, address in regular maintenance
- 🔵 **LOW** — Minimal risk, monitor
- ⚪ **INFO** — Informational, no action required

### Detection Confidence Scoring

- **98-100%**: Confirmed threat (immediate action)
- **85-97%**: High confidence (investigate)
- **70-84%**: Medium confidence (monitor closely)
- **50-69%**: Low confidence (false positive risk, verify)
- **<50%**: Suspect data (ignore or investigate further)

---

## 🆘 Troubleshooting

### Port 5174 Already in Use

```bash
# Find process using port
lsof -i :5174

# Kill process (macOS/Linux)
kill -9 <PID>

# Or use different port
npm run dev -- --port 5175
```

### Cannot Import PCAP

```bash
# Check file is valid
file your-capture.pcap

# Should output: "your-capture.pcap: tcpdump capture file"

# Check file size doesn't exceed limit (default 5 GB)
du -h your-capture.pcap
```

### Browser Shows Black Screen

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Out of Memory During PCAP Import

```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run dev

# Or split large PCAP into smaller files
```

---

## 📚 Next Steps

1. **Read Full Documentation**
   - [INSTALLATION.md](./INSTALLATION.md) — Detailed setup
   - [FEATURES.md](./FEATURES.md) — Complete feature guide

2. **Explore Sample Assessments**
   - Try importing sample PCAPs (available in FEATURES.md)
   - Practice report generation

3. **Understand Your Network**
   - Import your first real network capture
   - Identify all devices and protocols
   - Create baseline for drift detection

4. **Set Up Security Monitoring**
   - Review MITRE ATT&CK detections
   - Configure vulnerability scanning
   - Establish alert thresholds

5. **Integrate with Tools**
   - Import Zeek/Suricata alerts
   - Correlate with vulnerability scanners
   - Integrate with SIEM systems

---

## 🔗 Resources

- **Documentation**: [FEATURES.md](./FEATURES.md), [INSTALLATION.md](./INSTALLATION.md)
- **GitHub Issues**: [Report bugs](https://github.com/valinorintelligence/Gridwolf/issues)
- **Discussions**: [Ask questions](https://github.com/valinorintelligence/Gridwolf/discussions)
- **Live Demo**: https://gridwolf.vercel.app (limited features)

---

**Version**: 0.9.2-alpha | **Last Updated**: March 27, 2026
