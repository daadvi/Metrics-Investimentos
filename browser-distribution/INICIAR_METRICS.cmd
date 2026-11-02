@echo off
setlocal
cd /d "%~dp0"
title Metrics Investimentos - Navegador
where node >nul 2>nul
if errorlevel 1 (
 echo ERRO: Instale Node.js 22.13+ para iniciar o servidor local.
 pause
 exit /b 1
)
set "METRICS_SOURCE=%~dp0codigo"
if exist "%~dp0..\server.mjs" set "METRICS_SOURCE=%~dp0.."
if not exist "%METRICS_SOURCE%\server.mjs" (
 echo Primeira inicializacao: preparando a pasta do Metrics...
 node "%~dp0preparar-pasta.mjs"
 if errorlevel 1 (echo Preparacao falhou. & pause & exit /b 1)
)
set "PORT=4173"
echo Abrindo o Metrics em seu navegador padrao. Feche esta janela para encerrar o servidor.
node "%METRICS_SOURCE%\launcher.mjs"
if errorlevel 1 (
 echo O servidor encerrou com erro. Confira se a porta 4173 esta livre.
 pause
)
