:: SPDX-License-Identifier: GPL-3.0-or-later
@echo off
setlocal enabledelayedexpansion
title Register ZeroScript Native Agent Host
cd /d "%~dp0"

echo.
echo ========================================================
echo   ZeroScript Universal Background Agent Host Setup
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash if present
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "BAT_PATH=%SCRIPT_DIR%\native_host.bat"
set "JSON_PATH=%SCRIPT_DIR%\com.zeroscript.agent.json"

:: Write com.zeroscript.agent.json with escaped absolute path for Windows
set "ESCAPED_BAT=%BAT_PATH:\=\\%"

(
  echo {
  echo   "name": "com.zeroscript.agent",
  echo   "description": "ZeroScript Universal Local Agent Host",
  echo   "path": "!ESCAPED_BAT!",
  echo   "type": "stdio",
  echo   "allowed_origins": [
  echo     "chrome-extension://*/*"
  echo   ]
  echo }
) > "%JSON_PATH%"

echo [*] Generated manifest: %JSON_PATH%
echo [*] Native host runner: %BAT_PATH%
echo.

:: Register for Chrome, Edge, and Brave in HKCU
set "CHROME_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.zeroscript.agent"
set "EDGE_KEY=HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.zeroscript.agent"
set "BRAVE_KEY=HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.zeroscript.agent"

reg add "%CHROME_KEY%" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>nul
if %errorlevel% equ 0 (
    echo [+] Registered with Google Chrome
) else (
    echo [-] Could not register with Google Chrome
)

reg add "%EDGE_KEY%" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>nul
if %errorlevel% equ 0 (
    echo [+] Registered with Microsoft Edge
)

reg add "%BRAVE_KEY%" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>nul
if %errorlevel% equ 0 (
    echo [+] Registered with Brave Browser
)

echo.
echo ========================================================
echo   Setup Complete!
echo   The extension can now launch the bridge in background.
echo ========================================================
echo.
pause

