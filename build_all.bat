@echo off
setlocal
title PRJ381 CI/CD Build Script

:: Usage: build_all.bat [All|Windows|Android|Quest|Validate]
:: Defaults to All. No cache deletion, interactive pause, or source-control operations.
set "BUILD_TARGET=%~1"
if not defined BUILD_TARGET set "BUILD_TARGET=All"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build_pipeline.ps1" -ProjectRoot "%~dp0." -Target "%BUILD_TARGET%"
set "BUILD_RESULT=%ERRORLEVEL%"
exit /b %BUILD_RESULT%
