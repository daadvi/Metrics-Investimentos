@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ENVIAR_REPOSITORIO_EXISTENTE.ps1"
if errorlevel 1 (
 echo.
 echo Ocorreu um erro. Leia a mensagem acima antes de tentar novamente.
)
echo.
pause
