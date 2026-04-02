@echo off
:: Gridwolf — Windows Launcher
:: Double-click this file to start Gridwolf
:: Requires: Python 3.9+ and Node.js 18+

title Gridwolf - ICS/OT Security Platform
color 0B

echo.
echo    ╔══════════════════════════════════════════════╗
echo    ║          GRIDWOLF - OT Security              ║
echo    ║   Passive ICS/SCADA Network Discovery        ║
echo    ╚══════════════════════════════════════════════╝
echo.

:: Check if Docker is available
docker --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Docker detected - using containerized setup...
    echo [*] Building and starting containers...
    docker compose up --build -d
    echo.
    echo [+] Gridwolf is starting...
    timeout /t 10 /nobreak >nul
    echo [+] Opening browser...
    start http://localhost:3000
    echo.
    echo    Frontend:  http://localhost:3000
    echo    API Docs:  http://localhost:8000/docs
    echo    Login:     Click 'Demo Login'
    echo.
    echo    Stop:      docker compose down
    echo.
    pause
    exit /b
)

:: Native install fallback
echo [*] Docker not found - using native install...
echo.

:: Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Python 3.9+ is required. Download from https://python.org
    pause
    exit /b 1
)

:: Check Node
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js 18+ is required. Download from https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] Installing backend dependencies...
cd backend
python -m pip install -e "." --quiet
cd ..

echo [2/4] Installing frontend dependencies...
cd frontend
call npm install --silent
cd ..

echo [3/4] Starting backend server...
start /B "Gridwolf Backend" cmd /c "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo [4/4] Starting frontend server...
start /B "Gridwolf Frontend" cmd /c "cd frontend && npm run dev -- --port 5174"

timeout /t 5 /nobreak >nul

echo.
echo    ╔══════════════════════════════════════════════╗
echo    ║       Gridwolf is running!                   ║
echo    ╠══════════════════════════════════════════════╣
echo    ║  Frontend:  http://localhost:5174            ║
echo    ║  API Docs:  http://localhost:8000/docs       ║
echo    ║  Login:     Click 'Demo Login'               ║
echo    ╚══════════════════════════════════════════════╝
echo.

start http://localhost:5174
echo Press any key to stop Gridwolf...
pause >nul

taskkill /FI "WINDOWTITLE eq Gridwolf Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Gridwolf Frontend" /F >nul 2>&1
echo [+] Gridwolf stopped.
