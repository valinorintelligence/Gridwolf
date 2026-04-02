# ============================================================================
# Gridwolf — One-Click Installer for Windows
# ============================================================================
# Usage (PowerShell as Administrator):
#   irm https://raw.githubusercontent.com/valinorintelligence/Gridwolf/main/scripts/install.ps1 | iex
#   OR
#   git clone https://github.com/valinorintelligence/Gridwolf.git; cd Gridwolf; .\scripts\install.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

function Write-Banner {
    Write-Host ""
    Write-Host "   ██████╗ ██████╗ ██╗██████╗ ██╗    ██╗ ██████╗ ██╗     ███████╗" -ForegroundColor Cyan
    Write-Host "  ██╔════╝ ██╔══██╗██║██╔══██╗██║    ██║██╔═══██╗██║     ██╔════╝" -ForegroundColor Cyan
    Write-Host "  ██║  ███╗██████╔╝██║██║  ██║██║ █╗ ██║██║   ██║██║     █████╗  " -ForegroundColor Cyan
    Write-Host "  ██║   ██║██╔══██╗██║██║  ██║██║███╗██║██║   ██║██║     ██╔══╝  " -ForegroundColor Cyan
    Write-Host "  ╚██████╔╝██║  ██║██║██████╔╝╚███╔███╔╝╚██████╔╝███████╗██║     " -ForegroundColor Cyan
    Write-Host "   ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝  ╚══╝╚══╝  ╚═════╝ ╚══════╝╚═╝     " -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Passive ICS/OT Network Discovery & Security Assessment" -ForegroundColor White
    Write-Host ""
}

function Write-Step($num, $total, $msg) {
    Write-Host "`n[$num/$total] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red; exit 1 }

# ---- Check prerequisites ----
function Test-Prerequisites {
    Write-Step 1 5 "Checking prerequisites..."

    # Docker Desktop
    $hasDocker = $false
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $dockerVer = docker --version
        Write-Ok "Docker found: $dockerVer"
        $hasDocker = $true
    } else {
        Write-Warn "Docker Desktop not found"
    }

    # Python
    $hasPython = $false
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $pyVer = python --version
        Write-Ok "Python found: $pyVer"
        $hasPython = $true
    } elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
        $pyVer = python3 --version
        Write-Ok "Python found: $pyVer"
        $hasPython = $true
    } else {
        Write-Warn "Python not found"
    }

    # Node.js
    $hasNode = $false
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVer = node --version
        Write-Ok "Node.js found: $nodeVer"
        $hasNode = $true
    } else {
        Write-Warn "Node.js not found"
    }

    # Git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Err "Git is required. Install from https://git-scm.com/download/win"
    }
    Write-Ok "Git found"

    return @{
        Docker = $hasDocker
        Python = $hasPython
        Node   = $hasNode
    }
}

# ---- Clone repo ----
function Get-Repo {
    if (Test-Path "docker-compose.yml") {
        $content = Get-Content "docker-compose.yml" -Raw -ErrorAction SilentlyContinue
        if ($content -match "gridwolf") {
            Write-Ok "Already in Gridwolf directory"
            return
        }
    }

    Write-Step 2 5 "Cloning Gridwolf..."
    if (Test-Path "Gridwolf") {
        Write-Ok "Directory exists, pulling latest..."
        Push-Location Gridwolf
        git pull origin main
    } else {
        git clone https://github.com/valinorintelligence/Gridwolf.git
        Push-Location Gridwolf
    }
    Write-Ok "Repository ready"
}

# ---- Docker install ----
function Install-Docker {
    Write-Step 3 5 "Building with Docker..."
    docker compose up --build -d

    Write-Step 4 5 "Waiting for services..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 2
            $ready = $true
            break
        } catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
        }
    }
    Write-Host ""
    if ($ready) { Write-Ok "Services are ready" }
    else { Write-Warn "Services may still be starting..." }
}

# ---- Native install ----
function Install-Native($prereqs) {
    if (-not $prereqs.Python) {
        Write-Err "Python 3.9+ is required. Download from https://python.org/downloads/"
    }
    if (-not $prereqs.Node) {
        Write-Err "Node.js 18+ is required. Download from https://nodejs.org/"
    }

    Write-Step 3 5 "Installing backend..."
    Push-Location backend
    python -m pip install -e "." --quiet
    Pop-Location
    Write-Ok "Backend dependencies installed"

    Write-Step 4 5 "Installing frontend..."
    Push-Location frontend
    npm install --silent
    Pop-Location
    Write-Ok "Frontend dependencies installed"

    Write-Step 5 5 "Starting Gridwolf..."

    # Start backend
    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD\backend
        python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
    }
    Write-Ok "Backend starting (Job ID: $($backendJob.Id))"

    # Start frontend
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD\frontend
        npm run dev -- --port 5174
    }
    Write-Ok "Frontend starting (Job ID: $($frontendJob.Id))"

    Start-Sleep -Seconds 3

    # Save job IDs
    "$($backendJob.Id)`n$($frontendJob.Id)" | Out-File .gridwolf.jobs
}

# ---- Main ----
Write-Banner

$prereqs = Test-Prerequisites
Get-Repo

if ($prereqs.Docker) {
    Write-Ok "Using Docker installation (recommended)"
    Install-Docker
    $frontendUrl = "http://localhost:3000"
    $apiUrl = "http://localhost:8000/docs"
    $stopCmd = "docker compose down"
} else {
    Write-Ok "Using native installation"
    Install-Native $prereqs
    $frontendUrl = "http://localhost:5174"
    $apiUrl = "http://localhost:8000/docs"
    $stopCmd = "Get-Content .gridwolf.jobs | ForEach-Object { Stop-Job -Id `$_ }"
}

Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Gridwolf is running!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  $frontendUrl" -ForegroundColor White
Write-Host "  API Docs:  $apiUrl" -ForegroundColor White
Write-Host "  Login:     Click 'Demo Login' — no credentials needed" -ForegroundColor White
Write-Host ""
Write-Host "  Stop:      $stopCmd" -ForegroundColor Gray
Write-Host ""

# Open browser
Start-Process $frontendUrl
