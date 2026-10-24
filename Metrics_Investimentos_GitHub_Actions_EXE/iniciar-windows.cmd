@echo off
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 22.13 ou superior.
  pause
  exit /b 1
)
node launcher.mjs
pause
