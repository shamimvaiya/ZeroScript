@echo off
setlocal
title ZeroScript - Add Google AI Studio
cd /d "%~dp0"
echo.
echo   ZeroScript - Google AI Studio installer
echo   ----------------------------------------
echo.
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo   ERROR: Windows PowerShell was not found.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0add-google-ai-studio.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo   Done. Reload ZeroScript from chrome://extensions or edge://extensions.
) else (
  echo   The installer stopped.
)
echo.
pause
exit /b %EXIT_CODE%