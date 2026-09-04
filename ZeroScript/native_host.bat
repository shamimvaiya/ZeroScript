@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul && (
    py -3 "%~dp0native_host.py"
    exit /b %errorlevel%
)
where python >nul 2>nul && (
    python "%~dp0native_host.py"
    exit /b %errorlevel%
)
exit /b 1

