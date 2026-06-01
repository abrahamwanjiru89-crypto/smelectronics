@echo off
REM Start the server bound to all interfaces on port 8000 using the venv python
cd /d "%~dp0"
set HOST=0.0.0.0
set PORT=8000
"%~dp0.venv\Scripts\python.exe" server.py
pause
