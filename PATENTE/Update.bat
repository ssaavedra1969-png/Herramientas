@echo off
setlocal

cd /d "%~dp0.."
if errorlevel 1 (
  echo No se pudo abrir la carpeta del proyecto.
  pause
  exit /b 1
)

echo Publicando cambios de PATENTE en GitHub y Vercel...
echo.
call npm run subir:docs
set "RESULTADO=%ERRORLEVEL%"

echo.
if "%RESULTADO%"=="0" (
  echo Proceso finalizado. Revisa el resultado indicado arriba.
) else (
  echo El proceso termino con error %RESULTADO%. Revisa el mensaje anterior.
)

pause
exit /b %RESULTADO%
