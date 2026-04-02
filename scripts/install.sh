#!/usr/bin/env bash
# ============================================================================
# Gridwolf — One-Click Installer for macOS / Linux
# ============================================================================
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/valinorintelligence/Gridwolf/main/scripts/install.sh | bash
#   OR
#   git clone https://github.com/valinorintelligence/Gridwolf.git && cd Gridwolf && bash scripts/install.sh
# ============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "   ██████╗ ██████╗ ██╗██████╗ ██╗    ██╗ ██████╗ ██╗     ███████╗"
  echo "  ██╔════╝ ██╔══██╗██║██╔══██╗██║    ██║██╔═══██╗██║     ██╔════╝"
  echo "  ██║  ███╗██████╔╝██║██║  ██║██║ █╗ ██║██║   ██║██║     █████╗  "
  echo "  ██║   ██║██╔══██╗██║██║  ██║██║███╗██║██║   ██║██║     ██╔══╝  "
  echo "  ╚██████╔╝██║  ██║██║██████╔╝╚███╔███╔╝╚██████╔╝███████╗██║     "
  echo "   ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝  ╚══╝╚══╝  ╚═════╝ ╚══════╝╚═╝     "
  echo -e "${NC}"
  echo -e "  ${BOLD}Passive ICS/OT Network Discovery & Security Assessment${NC}"
  echo ""
}

info()  { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
error() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}[$1]${NC} $2"; }

# ---- Detect OS ----
detect_os() {
  case "$(uname -s)" in
    Darwin*) OS="macOS" ;;
    Linux*)  OS="Linux" ;;
    *)       error "Unsupported OS: $(uname -s). Use Windows installer instead." ;;
  esac
  ARCH="$(uname -m)"
  info "Detected: $OS ($ARCH)"
}

# ---- Check prerequisites ----
check_prereqs() {
  step "1/5" "Checking prerequisites..."

  # Check Docker
  if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    info "Docker $DOCKER_VERSION found"
    HAS_DOCKER=true
  else
    HAS_DOCKER=false
    warn "Docker not found — will use native install"
  fi

  # Check Docker Compose
  if docker compose version &>/dev/null 2>&1; then
    info "Docker Compose found"
    HAS_COMPOSE=true
  else
    HAS_COMPOSE=false
  fi

  # Check Python
  if command -v python3 &>/dev/null; then
    PY_VERSION=$(python3 --version | grep -oE '[0-9]+\.[0-9]+')
    info "Python $PY_VERSION found"
    HAS_PYTHON=true
  else
    HAS_PYTHON=false
    warn "Python 3 not found"
  fi

  # Check Node.js
  if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version)
    info "Node.js $NODE_VERSION found"
    HAS_NODE=true
  else
    HAS_NODE=false
    warn "Node.js not found"
  fi
}

# ---- Clone if needed ----
clone_repo() {
  if [ -f "docker-compose.yml" ] && grep -q "gridwolf" docker-compose.yml 2>/dev/null; then
    info "Already in Gridwolf directory"
    return
  fi

  step "2/5" "Cloning Gridwolf..."
  if [ -d "Gridwolf" ]; then
    info "Gridwolf directory exists, pulling latest..."
    cd Gridwolf && git pull origin main
  else
    git clone https://github.com/valinorintelligence/Gridwolf.git
    cd Gridwolf
  fi
  info "Repository ready"
}

# ---- Docker install ----
docker_install() {
  step "3/5" "Building with Docker..."
  docker compose up --build -d

  step "4/5" "Waiting for services..."
  echo -n "  "
  for i in $(seq 1 30); do
    if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
      echo ""
      info "Backend is ready"
      break
    fi
    echo -n "."
    sleep 2
  done

  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    info "Frontend is ready"
  fi
}

# ---- Native install ----
native_install() {
  if [ "$HAS_PYTHON" = false ]; then
    error "Python 3.9+ is required. Install it from https://python.org"
  fi
  if [ "$HAS_NODE" = false ]; then
    error "Node.js 18+ is required. Install it from https://nodejs.org"
  fi

  step "3/5" "Installing backend dependencies..."
  cd backend
  python3 -m pip install -e "." --quiet
  cd ..
  info "Backend dependencies installed"

  step "4/5" "Installing frontend dependencies..."
  cd frontend
  npm install --silent
  cd ..
  info "Frontend dependencies installed"

  step "5/5" "Starting Gridwolf..."

  # Start backend in background
  cd backend
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
  BACKEND_PID=$!
  cd ..

  # Start frontend in background
  cd frontend
  npm run dev -- --port 5174 &
  FRONTEND_PID=$!
  cd ..

  sleep 3
  info "Backend PID: $BACKEND_PID"
  info "Frontend PID: $FRONTEND_PID"

  # Save PIDs for stop script
  echo "$BACKEND_PID" > .gridwolf.backend.pid
  echo "$FRONTEND_PID" > .gridwolf.frontend.pid
}

# ---- Open browser ----
open_browser() {
  local URL="$1"
  if command -v open &>/dev/null; then
    open "$URL"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$URL"
  fi
}

# ---- Main ----
main() {
  banner
  detect_os
  check_prereqs
  clone_repo

  if [ "$HAS_DOCKER" = true ] && [ "$HAS_COMPOSE" = true ]; then
    info "Using Docker installation (recommended)"
    docker_install
    FRONTEND_URL="http://localhost:3000"
    BACKEND_URL="http://localhost:8000/docs"
  else
    info "Using native installation"
    native_install
    FRONTEND_URL="http://localhost:5174"
    BACKEND_URL="http://localhost:8000/docs"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  Gridwolf is running!${NC}"
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Frontend:${NC}  $FRONTEND_URL"
  echo -e "  ${BOLD}API Docs:${NC}  $BACKEND_URL"
  echo -e "  ${BOLD}Login:${NC}     Click 'Demo Login' — no credentials needed"
  echo ""
  if [ "$HAS_DOCKER" = true ]; then
    echo -e "  ${BOLD}Stop:${NC}      docker compose down"
    echo -e "  ${BOLD}Logs:${NC}      docker compose logs -f"
  else
    echo -e "  ${BOLD}Stop:${NC}      kill \$(cat .gridwolf.backend.pid) \$(cat .gridwolf.frontend.pid)"
  fi
  echo ""

  open_browser "$FRONTEND_URL"
}

main "$@"
