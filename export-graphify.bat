@echo off
setlocal
cd /d "%~dp0"

rem Timestamp like 2026-10-01_2230 (locale-independent)
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set STAMP=%%i

rem Project name = name of the folder this .bat sits in
for %%i in ("%CD%") do set PROJECT=%%~nxi

set OUTDIR=graphify-exports

echo.
echo [1/3] Extracting code graph...
python -m graphify . --code-only
if errorlevel 1 goto :fail

echo.
echo [2/3] Building report...
python -m graphify cluster-only . --no-label --no-viz
if errorlevel 1 goto :fail

if not exist "graphify-out\GRAPH_REPORT.md" (
    echo.
    echo ERROR: graphify-out\GRAPH_REPORT.md was not created.
    goto :fail
)

echo.
echo [3/3] Saving dated copy...
if not exist "%OUTDIR%" mkdir "%OUTDIR%"
copy /y "graphify-out\GRAPH_REPORT.md" "%OUTDIR%\%PROJECT%_GRAPH_REPORT_%STAMP%.md" >nul
if errorlevel 1 goto :fail

echo.
echo Done: %OUTDIR%\%PROJECT%_GRAPH_REPORT_%STAMP%.md
start "" "%OUTDIR%"
pause
exit /b 0

:fail
echo.
echo Export failed. See the messages above.
pause
exit /b 1
