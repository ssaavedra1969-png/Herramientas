@echo off
rem Crea la tarea programada "Falpat Informe Vencimientos": todos los viernes
rem a las 08:00 genera el PDF de vencimientos y lo manda por mail (si hay SMTP
rem en .env). Correrlo UNA VEZ como Administrador.
schtasks /Create /F /TN "Falpat Informe Vencimientos" /SC WEEKLY /D FRI /ST 08:00 /TR "\"%~dp0ejecutar-informe-vencimientos.bat\""
if %errorlevel% equ 0 (
  echo.
  echo Tarea creada: viernes 08:00 - "Falpat Informe Vencimientos"
) else (
  echo.
  echo ERROR: no se pudo crear la tarea. Correr este .bat como Administrador.
)
pause
