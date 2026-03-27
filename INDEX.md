# Gridwolf Documentation Index

Quick navigation to all Gridwolf documentation and resources.

## 📖 Essential Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[README.md](./README.md)** | Project overview, features, tech stack | 10 min |
| **[QUICKSTART.md](./QUICKSTART.md)** | 5-minute setup + first assessment | 5 min |
| **[INSTALLATION.md](./INSTALLATION.md)** | Detailed setup for all platforms | 15 min |
| **[FEATURES.md](./FEATURES.md)** | Complete feature documentation | 30 min |
| **[SCREENSHOTS.md](./SCREENSHOTS.md)** | Visual tour of all 18 pages | 20 min |
| **[RELEASE_NOTES_v0.9.2.md](./RELEASE_NOTES_v0.9.2.md)** | What's new, changelog, support | 10 min |

---

## 🚀 Getting Started (Recommended Path)

### Path 1: New User (Fastest)
```
1. Read: QUICKSTART.md (5 min)
   ↓
2. Install: Follow installation steps (5 min)
   ↓
3. Run: npm run dev (1 min)
   ↓
4. Explore: http://localhost:5174 (5 min)
   ↓
Total: 16 minutes to first assessment
```

### Path 2: Detailed Setup (Comprehensive)
```
1. Read: README.md (overview)
   ↓
2. Read: INSTALLATION.md (your platform)
   ↓
3. Install: Follow detailed steps
   ↓
4. Explore: Try sample PCAP
   ↓
5. Read: FEATURES.md (understand capabilities)
   ↓
Total: 1-2 hours to expert user
```

### Path 3: Visual Learner (Screenshot-focused)
```
1. Read: README.md
   ↓
2. Look at: SCREENSHOTS.md (all 18 pages)
   ↓
3. Follow: QUICKSTART.md
   ↓
4. Explore: Each page in the app
   ↓
5. Reference: FEATURES.md for details
   ↓
Total: 1 hour
```

---

## 📚 Documentation by Use Case

### I want to...

#### **Get Gridwolf running right now**
→ Start with [QUICKSTART.md](./QUICKSTART.md) (5 min)

#### **Install on my specific platform**
→ Use [INSTALLATION.md](./INSTALLATION.md) and find your OS section

#### **Understand what Gridwolf does**
→ Read [README.md](./README.md) project overview

#### **Learn about a specific feature**
→ Search [FEATURES.md](./FEATURES.md) by feature name

#### **See what the app looks like**
→ Browse [SCREENSHOTS.md](./SCREENSHOTS.md) with visual descriptions

#### **Understand what's new in v0.9.2**
→ Check [RELEASE_NOTES_v0.9.2.md](./RELEASE_NOTES_v0.9.2.md)

#### **Deploy to production**
→ Follow Docker/Kubernetes section in [INSTALLATION.md](./INSTALLATION.md)

#### **Troubleshoot an issue**
→ Check troubleshooting section in [INSTALLATION.md](./INSTALLATION.md)

#### **Run my first assessment**
→ Follow workflow in [QUICKSTART.md](./QUICKSTART.md)

#### **Understand new v0.9.2 features**
→ Read v0.9.2 sections in [FEATURES.md](./FEATURES.md) and [SCREENSHOTS.md](./SCREENSHOTS.md)

---

## 🆕 What's New in v0.9.2

### 7 Major New Features

| Feature | Location | Status |
|---------|----------|--------|
| **Live Capture Visualization** | Capture → Live Capture | ✨ NEW |
| **C2/Beacon/Exfiltration Detection** | Security & Detection → C2/Beacon Detection | ✨ NEW |
| **Purdue Model Violation Detection** | Security & Detection → Purdue Violations | ✨ NEW |
| **Write/Program Access Paths** | Security & Detection → Write/Program Paths | ✨ NEW |
| **Report-to-Report Diffing** | Investigations → Report Diffing | ✨ NEW |
| **Investigation Workflows** | Investigations → Focus Queue | ✨ NEW |
| **System Administration** | Administration → System Admin | ✨ NEW |

**See**:
- [RELEASE_NOTES_v0.9.2.md](./RELEASE_NOTES_v0.9.2.md) for detailed feature descriptions
- [SCREENSHOTS.md](./SCREENSHOTS.md) for visual tour
- [FEATURES.md](./FEATURES.md) sections 2-4 for technical details

---

## 📂 File Structure

```
Gridwolf/
├── README.md                      # Main project documentation
├── INDEX.md                       # This file - navigation guide
├── QUICKSTART.md                  # 5-minute setup guide
├── INSTALLATION.md                # Detailed installation (all platforms)
├── FEATURES.md                    # Complete feature documentation
├── SCREENSHOTS.md                 # Visual tour with 18 features
├── RELEASE_NOTES_v0.9.2.md       # What's new in v0.9.2
├── docs/
│   └── screenshots/               # Screenshot images directory
└── frontend/
    ├── src/
    │   ├── pages/                 # 7 new pages in v0.9.2
    │   │   ├── ReportDiff.tsx
    │   │   ├── LiveCapture.tsx
    │   │   ├── C2Detection.tsx
    │   │   ├── PurdueViolations.tsx
    │   │   ├── WritePaths.tsx
    │   │   ├── SystemAdmin.tsx
    │   │   └── Investigations.tsx
    │   ├── routes/
    │   ├── lib/
    │   └── components/
    └── vite.config.ts
```

---

## 🎯 Feature Highlights

### Core Capabilities (Stable)
- ✓ PCAP import with 19+ protocol dissectors
- ✓ Network topology visualization (4 views)
- ✓ Device identification and fingerprinting
- ✓ MITRE ATT&CK for ICS (40+ detection rules)
- ✓ CVE matching (1,500+ ICS vulnerabilities)
- ✓ Compliance assessment (IEC/NIST/NERC)
- ✓ Professional PDF reporting
- ✓ Session management and projects

### New in v0.9.2
- ✨ **Live Capture** — Real-time topology during packet capture
- ✨ **C2 Detection** — Beacon/exfiltration detection with 98%+ confidence
- ✨ **Purdue Violations** — Cross-zone anomaly detection
- ✨ **Write Paths** — Dangerous control access detection
- ✨ **Report Diffing** — Snapshot comparison with visual deltas
- ✨ **Focus Queue** — Investigation workflow with priorities
- ✨ **System Admin** — Resource monitoring dashboard

---

## 📊 Documentation Statistics

| Document | Lines | Sections | Topics |
|----------|-------|----------|--------|
| README.md | 400+ | 15 | Project overview, features, architecture |
| QUICKSTART.md | 300+ | 8 | Setup, workflows, troubleshooting |
| INSTALLATION.md | 600+ | 20 | All platforms, Docker, Kubernetes |
| FEATURES.md | 1,200+ | 30 | All features with examples |
| SCREENSHOTS.md | 800+ | 25 | Visual guide to all 18 pages |
| RELEASE_NOTES_v0.9.2.md | 500+ | 12 | New features, changelog, support |
| **TOTAL** | **3,800+** | **110+** | **Complete documentation** |

---

## 🔗 Quick Links

### GitHub
- **Repository**: [valinorintelligence/Gridwolf](https://github.com/valinorintelligence/Gridwolf)
- **Issues**: [Report bugs](https://github.com/valinorintelligence/Gridwolf/issues)
- **Discussions**: [Ask questions](https://github.com/valinorintelligence/Gridwolf/discussions)

### Running Gridwolf
- **Local Dev**: `npm run dev` → http://localhost:5174
- **Production**: `npm run build && npm run preview`
- **Docker**: `docker build -t gridwolf . && docker run -p 5174:5174 gridwolf`

### Learn More
- **Architecture**: See [FEATURES.md](./FEATURES.md) technical sections
- **Purdue Model**: See [FEATURES.md](./FEATURES.md) Purdue Violations section
- **Threat Detection**: See [FEATURES.md](./FEATURES.md) C2 Detection section
- **Compliance**: See [FEATURES.md](./FEATURES.md) Compliance section

---

## ✅ Version Information

| Item | Value |
|------|-------|
| **Version** | 0.9.2-alpha |
| **Release Date** | March 27, 2026 |
| **Build Status** | ✅ 0 errors, 292ms |
| **Features** | 18 total (7 new in v0.9.2) |
| **Protocols** | 19+ supported |
| **CVEs** | 1,500+ indexed |
| **Detection Rules** | 40+ ATT&CK rules |

---

## 📈 Getting Help

### Common Questions

**Q: How do I get started?**
A: Start with [QUICKSTART.md](./QUICKSTART.md) — 5 minutes to running.

**Q: What's new in v0.9.2?**
A: See [RELEASE_NOTES_v0.9.2.md](./RELEASE_NOTES_v0.9.2.md) for detailed feature list.

**Q: How do I install on [platform]?**
A: Follow [INSTALLATION.md](./INSTALLATION.md) — platform-specific sections included.

**Q: What does feature X do?**
A: Search [FEATURES.md](./FEATURES.md) by feature name.

**Q: Can I see screenshots?**
A: Yes! Check [SCREENSHOTS.md](./SCREENSHOTS.md) for visual tour.

**Q: How do I deploy to production?**
A: See Docker/Kubernetes sections in [INSTALLATION.md](./INSTALLATION.md).

**Q: What if I encounter a problem?**
A: Check troubleshooting in [INSTALLATION.md](./INSTALLATION.md) or file [GitHub issue](https://github.com/valinorintelligence/Gridwolf/issues).

---

## 🎓 Learning Paths

### Beginner
```
QUICKSTART.md (5 min)
  ↓
Install & run app (5 min)
  ↓
Create account & import sample PCAP (10 min)
  ↓
Explore Topology view (5 min)
  ↓
Check C2 Detection findings (5 min)
  ↓
Generate PDF report (5 min)
Total: ~35 minutes
```

### Intermediate
```
QUICKSTART.md (5 min)
  ↓
FEATURES.md sections 1-2 (15 min)
  ↓
Install & run app (5 min)
  ↓
Work through QUICKSTART workflows (20 min)
  ↓
Read FEATURES.md sections 3-4 (15 min)
  ↓
Try advanced features (15 min)
Total: ~75 minutes
```

### Advanced
```
README.md (10 min)
  ↓
INSTALLATION.md (15 min)
  ↓
FEATURES.md (30 min)
  ↓
SCREENSHOTS.md (20 min)
  ↓
RELEASE_NOTES_v0.9.2.md (10 min)
  ↓
Deploy to Docker/Kubernetes (20 min)
  ↓
Customize for your environment (varies)
Total: 105+ minutes
```

---

## 📝 Last Updated

| Item | Date |
|------|------|
| Documentation | March 27, 2026 |
| Features | v0.9.2-alpha |
| Screenshots | March 27, 2026 |
| Installation | March 27, 2026 |

---

**Start exploring!** Choose your path above and get started. Questions? Check the relevant documentation or open a GitHub issue. 🚀
