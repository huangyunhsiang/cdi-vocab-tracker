@echo off
rem CDI Vocab Tracker launcher (ASCII only, see LESSONS 2026-07-03)
rem Fixed port for this project: 8770 (one fixed port per project)
cd /d %~dp0
set PORT=8770
netstat -ano | findstr LISTENING | findstr /C:":%PORT% " >nul
if errorlevel 1 (
  start "cdi-vocab-server" /min python -m http.server %PORT%
  timeout /t 1 /nobreak >nul
)
start "" http://localhost:%PORT%/
