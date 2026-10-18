@echo off
setlocal EnableDelayedExpansion
title PRJ381 CI/CD Build Script

:: Usage: build_all.bat [All|Windows|Android|Quest|Validate] [--ci]
set "BUILD_TARGET=%~1"
set "CI_MODE=%~2"
if not defined BUILD_TARGET set "BUILD_TARGET=All"

:: Strip trailing backslash from script directory
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "PS_SCRIPT=%PROJECT_ROOT%\scripts\build_pipeline.ps1"
if not exist "%PS_SCRIPT%" (
    if exist "%PROJECT_ROOT%\build_pipeline.ps1" (
        set "PS_SCRIPT=%PROJECT_ROOT%\build_pipeline.ps1"
    ) else (
        echo [ERROR] Cannot find build_pipeline.ps1 in "%PROJECT_ROOT%\scripts\" or "%PROJECT_ROOT%\"
        if /i not "%CI_MODE%"=="--ci" pause
        exit /b 1
    )
)

if not exist "%PROJECT_ROOT%\Saved\Logs" mkdir "%PROJECT_ROOT%\Saved\Logs"

echo ============================================================
echo Starting PRJ381 Build Pipeline
echo Project Root : "%PROJECT_ROOT%"
echo Target       : "%BUILD_TARGET%"
echo Script       : "%PS_SCRIPT%"
echo ============================================================

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -Target "%BUILD_TARGET%"
set "BUILD_RESULT=%ERRORLEVEL%"

echo.
if not "%BUILD_RESULT%"=="0" (
    echo ============================================================
    echo [BUILD FAILED] Exit code: %BUILD_RESULT%
    echo Check "%PROJECT_ROOT%\Saved\Logs\" for UAT logs.
    echo ============================================================
    if /i not "%CI_MODE%"=="--ci" pause
) else (
    echo ============================================================
    echo [BUILD SUCCEEDED] All requested stages completed.
    echo ============================================================
    if /i not "%CI_MODE%"=="--ci" pause
)

exit /b %BUILD_RESULT%