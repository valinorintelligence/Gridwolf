# Gridwolf Installation Guide

Complete step-by-step instructions for installing and running Gridwolf on your system.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Prerequisites](#prerequisites)
3. [Installation Steps](#installation-steps)
4. [Running Gridwolf](#running-gridwolf)
5. [Docker Deployment](#docker-deployment)
6. [Troubleshooting](#troubleshooting)
7. [First Steps](#first-steps)

---

## System Requirements

### Minimum Requirements
- **OS**: macOS 12+, Windows 10+, Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+, Fedora 35+)
- **CPU**: 2+ cores (4+ cores recommended)
- **RAM**: 4 GB minimum, 8+ GB recommended
- **Storage**: 2 GB free space for installation + space for PCAP files

### Recommended Specifications
- **CPU**: Intel/AMD 4+ cores or Apple Silicon M1+
- **RAM**: 16 GB+
- **Storage**: SSD with 50+ GB free for large PCAP files
- **Network**: 1 Gbps connection for PCAP import (for optimal performance)

### Supported Platforms
- ✅ macOS (Intel & Apple Silicon)
- ✅ Windows 10, 11, Server 2019+
- ✅ Linux (Ubuntu, Debian, CentOS, Fedora)
- ✅ Docker (Linux containers, Docker Desktop for Mac/Windows)
- ✅ Kubernetes (Helm charts available)

---

## Prerequisites

### Required Tools

#### 1. **Node.js & npm**
```bash
# Check if installed
node --version  # Should be v18.0.0 or higher
npm --version   # Should be v9.0.0 or higher
```

**Install Node.js:**
- **macOS (via Homebrew):**
  ```bash
  brew install node
  ```
- **Windows (via Chocolatey):**
  ```bash
  choco install nodejs
  ```
- **Windows (via Installer):**
  Download from [nodejs.org](https://nodejs.org/) and run installer
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update
  sudo apt install nodejs npm
  ```
- **Linux (Fedora/CentOS):**
  ```bash
  sudo dnf install nodejs npm
  ```

#### 2. **Git**
```bash
# Check if installed
git --version   # Should be v2.20.0 or higher
```

**Install Git:**
- **macOS:**
  ```bash
  brew install git
  ```
- **Windows:**
  Download from [git-scm.com](https://git-scm.com/) and run installer
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt install git
  ```
- **Linux (Fedora/CentOS):**
  ```bash
  sudo dnf install git
  ```

#### 3. **Docker (Optional, for containerized deployment)**
```bash
# Check if installed
docker --version  # Should be 20.10.0 or higher
docker-compose --version
```

Download from [docker.com](https://www.docker.com/products/docker-desktop)

---

## Installation Steps

### Step 1: Clone the Repository

```bash
# Clone Gridwolf repository
git clone https://github.com/valinorintelligence/Gridwolf.git
cd Gridwolf
```

### Step 2: Install Frontend Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies using npm
npm install

# Verify installation
npm list react react-dom  # Should show installed versions
```

This may take 2-5 minutes depending on your internet connection.

### Step 3: Configure Environment (Optional)

Create a `.env.local` file in the `frontend` directory for custom settings:

```env
# Frontend Configuration
VITE_API_URL=http://localhost:3000
VITE_DEMO_MODE=false
VITE_MAX_PCAP_SIZE=5GB
VITE_SESSION_TIMEOUT=3600000
```

**Common Environment Variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Backend API endpoint |
| `VITE_DEMO_MODE` | `false` | Enable demo mode with mock data |
| `VITE_MAX_PCAP_SIZE` | `5GB` | Maximum PCAP file size for upload |
| `VITE_SESSION_TIMEOUT` | `3600000` | Session timeout in milliseconds |

### Step 4: Build for Production (Optional)

```bash
# Create optimized production build
npm run build

# Output will be in frontend/dist/
# Ready for deployment to any web server
```

---

## Running Gridwolf

### Development Mode

Perfect for testing, feature development, and local assessment work:

```bash
# From frontend directory
npm run dev

# Server will start on http://localhost:5174
# Press 'q' to stop the server
```

**What happens:**
- Hot reload enabled (changes auto-reflect in browser)
- Source maps enabled for debugging
- Mock data loaded for testing
- Slower performance than production build

### Production Mode

For deployment and performance-critical assessments:

```bash
# Build first
npm run build

# Preview production build
npm run preview

# Server will start on http://localhost:4173
# Optimized performance, no hot reload
```

### Docker Deployment

```bash
# Build Docker image
docker build -t gridwolf:latest .

# Run container
docker run -d \
  --name gridwolf \
  -p 5174:5174 \
  -v gridwolf-data:/app/data \
  gridwolf:latest

# Access at http://localhost:5174
```

**Docker Compose (if docker-compose.yml exists):**
```bash
docker-compose up -d
```

---

## Docker Deployment

### Quick Start with Docker

```bash
# Pull pre-built image
docker pull valinorintelligence/gridwolf:latest

# Run in background
docker run -d \
  --name gridwolf \
  -p 5174:5174 \
  -e VITE_DEMO_MODE=true \
  valinorintelligence/gridwolf:latest
```

### Docker Compose (Multi-container)

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  gridwolf:
    image: valinorintelligence/gridwolf:latest
    ports:
      - "5174:5174"
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_DEMO_MODE: "false"
    volumes:
      - gridwolf-data:/app/data
      - ./pcaps:/app/pcaps
    restart: unless-stopped

volumes:
  gridwolf-data:
```

Run with:
```bash
docker-compose up -d
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes cluster
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Port-forward to access
kubectl port-forward svc/gridwolf 5174:5174
```

---

## Troubleshooting

### Issue: Port 5174 already in use

**Solution:**
```bash
# On macOS/Linux: Find and kill process
lsof -i :5174
kill -9 <PID>

# On Windows: Find and kill process
netstat -ano | findstr :5174
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- --port 5175
```

### Issue: npm install fails with permission denied

**Solution:**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
npm install
```

### Issue: Out of memory during build

**Solution:**
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

### Issue: Cannot access http://localhost:5174

**Solution:**
```bash
# Check if server is running
npm list

# Check for firewall blocking port 5174
# Allow port 5174 in firewall settings

# Try explicit hostname
npm run dev -- --host 0.0.0.0
```

### Issue: PCAP import fails

**Solution:**
- Ensure PCAP file is valid: `file your-capture.pcap`
- Check file size doesn't exceed `VITE_MAX_PCAP_SIZE`
- Try smaller PCAP files first to test functionality
- Check browser console for specific error messages (F12 → Console tab)

### Issue: Black screen or components not loading

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
npm run preview
```

---

## First Steps

### 1. Login/Registration

On first access, create an account:
- **Email**: Your assessment email
- **Password**: Strong password (8+ chars, numbers, symbols)
- **Organization**: Your organization name
- **Role**: Select your role (Security Analyst, OT Engineer, Administrator, Viewer)

### 2. Import Your First PCAP

1. Navigate to **Capture → PCAP Analysis**
2. Click **Import PCAP** tab
3. Drag-drop or select your `.pcap` file
4. Monitor the 4-stage pipeline:
   - **Ingestion** → File validation
   - **Dissection** → Protocol parsing
   - **Topology** → Device mapping
   - **Risk Triage** → Security assessment

### 3. Explore Network Topology

1. Go to **Discovery → Topology**
2. View devices on Purdue Model layers
3. Click devices to see:
   - Vendor/model/firmware
   - Open ports and protocols
   - Connected peers
   - Risk indicators

### 4. Review Security Findings

1. Navigate to **Security & Detection → MITRE ATT&CK**
2. Review detection rules and findings
3. Check **CVE Matching** for vulnerabilities
4. Examine **C2/Beacon Detection** for threats

### 5. Run Compliance Check

1. Go to **Compliance → IEC/NIST/NERC**
2. Select framework (IEC 62443, NIST 800-82, NERC CIP)
3. Review compliance status and gaps
4. Map findings to controls

### 6. Generate Report

1. Navigate to **Reporting → Assessment Reports**
2. Configure:
   - Report type (Executive, Technical, Detailed)
   - Sections to include
   - Client information
3. Click **Generate** to create PDF

### 7. Create Project Session

1. Go to **Operations → Sessions & Projects**
2. Create new project for client assessment
3. Save session baseline for drift detection
4. Archive completed assessments

---

## Quick Reference Commands

```bash
# Development
npm run dev              # Start dev server on :5174
npm run build           # Build production distribution
npm run preview         # Preview production build

# Maintenance
npm install             # Install/update dependencies
npm update              # Update packages to latest versions
npm audit               # Check for security vulnerabilities
npm run build --verbose # Build with detailed output

# Docker
docker build -t gridwolf:latest .
docker run -p 5174:5174 gridwolf:latest
docker-compose up -d

# Kubernetes
kubectl apply -f k8s/
kubectl port-forward svc/gridwolf 5174:5174
```

---

## Next Steps

- 📖 Read [FEATURES.md](./FEATURES.md) for detailed feature overview
- 🔒 Review [SECURITY.md](./SECURITY.md) for air-gap deployment
- 🏗️ Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
- 💬 Join community discussions on GitHub Issues

---

## Support

- **Documentation**: [Gridwolf Wiki](https://github.com/valinorintelligence/Gridwolf/wiki)
- **Issues**: [GitHub Issues](https://github.com/valinorintelligence/Gridwolf/issues)
- **Discussions**: [GitHub Discussions](https://github.com/valinorintelligence/Gridwolf/discussions)

---

**Last Updated**: March 27, 2026 | **Version**: 0.9.2-alpha
