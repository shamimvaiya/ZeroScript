:: SPDX-License-Identifier: GPL-3.0-or-later
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Devil-X Desktop Master Hub
cd /d "%~dp0"

echo.
echo =========================================================================
echo   Devil-X Master Hub - Native Desktop Control Panel
echo =========================================================================
echo.
echo   [1/2] Looking for Python...

where py >nul 2>nul && (
    echo   [2/2] Launching Devil-X Desktop GUI...
    py -3 desktop_hub.py
    goto :end
)

where python >nul 2>nul && (
    echo   [2/2] Launching Devil-X Desktop GUI...
    python desktop_hub.py
    goto :end
)

echo   ERROR: Python not found on your system!
echo   Please install Python from https://www.python.org/
pause

:end
