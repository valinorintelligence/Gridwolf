# Gridwolf

Open-source unified security operations & threat intelligence platform with Palantir Ontology-style dashboards.

## Overview

Gridwolf combines OT/ICS network security with Application Security Posture Management (ASPM) through an ontology-based data model where every entity — hosts, vulnerabilities, network flows, protocols — is an interconnected object you can explore, link, and act on.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Gridwolf UI                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Ontology  │ │ Network  │ │ Vuln     │ │Workshop│ │
│  │ Explorer  │ │ Topology │ │ Mgmt     │ │Builder │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
├─────────────────────────────────────────────────────┤
│              React + TypeScript + Tailwind           │
├─────────────────────────────────────────────────────┤
│  FastAPI Backend          │    Tauri v2 Desktop      │
│  ┌─────────┐ ┌─────────┐ │  ┌──────────────────┐   │
│  │Ontology │ │Scanner  │ │  │ PCAP Capture     │   │
│  │Engine   │ │Parsers  │ │  │ Native File I/O  │   │
│  └─────────┘ └─────────┘ │  └──────────────────┘   │
├─────────────────────────────────────────────────────┤
│  PostgreSQL (JSONB)  │  Redis  │  Celery Workers    │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS 4, Cytoscape.js, React Flow, Recharts
- **Backend**: FastAPI, SQLAlchemy 2.0, PostgreSQL 16+, Redis 7+, Celery
- **Desktop**: Tauri v2 (Rust)
- **Auth**: JWT with RBAC

## Quick Start

### Web (Development)

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -e . && uvicorn app.main:app --reload

# Database
docker compose up postgres redis -d
```

### Desktop

```bash
cd src-tauri && cargo tauri dev
```

## License

MIT
