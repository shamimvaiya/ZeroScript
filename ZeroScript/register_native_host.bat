:: SPDX-License-Identifier: GPL-3.0-or-later
@echo off
setlocal enabledelayedexpansion
title Register Devil-X Native Agent Host
cd /d "%~dp0"

echo.
echo ========================================================
echo   Devil-X Universal Background Agent Host Setup
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash if present
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "BAT_PATH=%SCRIPT_DIR%\native_host.bat"
set "JSON_PATH=%SCRIPT_DIR%\com.devilx.agent.json"
set "LEGACY_JSON_PATH=%SCRIPT_DIR%\com.zeroscript.agent.json"

:: Write com.devilx.agent.json with escaped absolute path for Windows
set "ESCAPED_BAT=%BAT_PATH:\=\\%"

(
  echo {
  echo   "name": "com.devilx.agent",
  echo   "description": "Devil-X Universal Local Agent Host",
  echo   "path": "!ESCAPED_BAT!",
  echo   "type": "stdio",
  echo   "allowed_origins": [
  echo     "chrome-extension://*/*"
  echo   ]
  echo }
) > "%JSON_PATH%"

(
  echo {
  echo   "name": "com.zeroscript.agent",
  echo   "description": "Devil-X Universal Local Agent Host (Legacy Compatibility)",
  echo   "path": "!ESCAPED_BAT!",
  echo   "type": "stdio",
  echo   "allowed_origins": [
  echo     "chrome-extension://*/*"
  echo   ]
  echo }
) > "%LEGACY_JSON_PATH%"

echo [*] Generated manifests:
echo     %JSON_PATH%
echo     %LEGACY_JSON_PATH%
echo [*] Native host runner: %BAT_PATH%
echo.

:: Register com.devilx.agent for Chrome, Edge, and Brave in HKCU
set "CHROME_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.devilx.agent"
set "EDGE_KEY=HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.devilx.agent"
set "BRAVE_KEY=HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.devilx.agent"

reg add "%CHROME_KEY%" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>nul
if %errorlevel% equ 0 (
    echo [+] Registered com.devilx.agent with Google Chrome
) else (
    echo [-] Could not register com.devilx.agent with Google Chrome
)

reg add "%EDGE_KEY%" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>nul
if %errorlevel% equ 0 (
    echo [+] Registered com.devilx.agent with Microsoft Edge
)

reg add "%BRAVE_KEY%" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>nul
if %errorlevel% equ 0 (
    echo [+] Registered com.devilx.agent with Brave Browser
)

:: Also register legacy key for backward compatibility
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.zeroscript.agent" /ve /t REG_SZ /d "%LEGACY_JSON_PATH%" /f >nul 2>nul
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.zeroscript.agent" /ve /t REG_SZ /d "%LEGACY_JSON_PATH%" /f >nul 2>nul
reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.zeroscript.agent" /ve /t REG_SZ /d "%LEGACY_JSON_PATH%" /f >nul 2>nul

echo.
echo ========================================================
echo   Setup Complete!
echo   The extension can now launch the bridge in background.
echo ========================================================
echo.
pause

