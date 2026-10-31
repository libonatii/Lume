@echo off
setlocal
cd /d "%~dp0"

set "ELECTRON=companion\node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON%" (
  echo.
  echo Lume Companion: o Electron ainda nao esta instalado.
  echo Rode uma vez, nesta pasta:
  echo     npm install --prefix companion
  echo.
  pause
  exit /b 1
)

if /i "%~1"=="--debug" (
  echo Abrindo em modo debug. Feche a janela ou use Ctrl+C para sair.
  "%ELECTRON%" "companion" %2 %3 %4 %5
  exit /b %errorlevel%
)

start "" "%ELECTRON%" "companion" %2 %3 %4 %5
exit /b 0