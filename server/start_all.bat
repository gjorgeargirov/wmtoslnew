@echo off
echo ========================================
echo Starting Migration App Servers
echo ========================================
echo.
echo This will start BOTH required servers:
echo   1. Web Server (port 8000)
echo   2. Proxy Server (port 8001)
echo.
echo Keep this window open!
echo.
echo After starting, open: http://localhost:8000/index.html
echo.
echo ========================================
echo.

REM Start proxy server in background
start "SnapLogic Proxy (Port 8001)" python proxy_server.py

REM Wait 2 seconds for proxy to start
timeout /t 2 /nobreak > nul

REM Start web server in foreground
echo Starting Web Server...
echo.
python server.py

pause

