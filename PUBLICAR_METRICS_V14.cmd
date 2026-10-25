@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PUBLICAR_METRICS_V14.ps1"
if errorlevel 1 ( echo. & echo Houve um erro. Confira a mensagem acima. & pause )
