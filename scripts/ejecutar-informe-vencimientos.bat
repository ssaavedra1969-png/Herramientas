@echo off
rem Ejecuta el informe semanal de vencimientos. Lo llama la tarea programada
rem "Falpat Informe Vencimientos" (ver instalar-tarea-vencimientos.bat).
cd /d "%~dp0.."
node scripts\informe-vencimientos-semanal.js --sin-abrir
