@echo off
setlocal
cd /d "%~dp0"

set "PACKAGED=companion\release\win-unpacked\Lume Companion.exe"
set "ELECTRON=companion\node_modules\electron\dist\electron.exe"

if exist "%PACKAGED%" (
  if /i "%~1"=="--debug" (
    echo Abrindo a versao empacotada. Feche a janela ou use Ctrl+C para sair.
    "%PACKAGED%"
    exit /b %errorlevel%
  )
  start "" "%PACKAGED%"
  exit /b 0
)

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
  echo Abrindo pelo Electron do projeto. Feche a janela ou use Ctrl+C para sair.
  "%ELECTRON%" "companion" %2 %3 %4 %5
  exit /b %errorlevel%
)

start "" "%ELECTRON%" "companion" %2 %3 %4 %5
exit /b 0