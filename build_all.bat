@echo off
title PRJ381 CI/CD Build Script

:: Adjust this path to match your exact Unreal Engine 5 installation directory version
set UAT_BAT="C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat"
set PROJECT_FILE="%~dp0PRJ381.uproject"

:: Output directories for each platform build
set ARCHIVE_DIR_WIN="%~dp0Builds\Windows"
set ARCHIVE_DIR_ANDROID="%~dp0Builds\Android"
set ARCHIVE_DIR_QUEST="%~dp0Builds\Quest3"

echo ========================================
echo Clearing cached build data...
echo ========================================
:: These commands delete the cached folders to prevent the Error_ObbNotFound bug
rmdir /s /q "%~dp0Binaries"
rmdir /s /q "%~dp0Intermediate"
rmdir /s /q "%~dp0Saved"
echo Cache cleared successfully!

echo ========================================
echo Building PRJ381 for Windows Desktop...
echo ========================================
call %UAT_BAT% BuildCookRun -project=%PROJECT_FILE% -noP4 -platform=Win64 -clientconfig=Development -serverconfig=Development -clean -cook -allmaps -build -stage -pak -package -archive -archivedirectory=%ARCHIVE_DIR_WIN%

echo ========================================
echo Building PRJ381 for Android Mobile...
echo ========================================
call %UAT_BAT% BuildCookRun -project=%PROJECT_FILE% -noP4 -platform=Android -cookflavor=Multi -clientconfig=Development -serverconfig=Development -clean -cook -allmaps -build -stage -pak -package -archive -archivedirectory=%ARCHIVE_DIR_ANDROID%

echo ========================================
echo Building PRJ381 for Meta Quest 3...
echo ========================================
:: The Quest relies on the ASTC texture compression flavor
call %UAT_BAT% BuildCookRun -project=%PROJECT_FILE% -noP4 -platform=Android -cookflavor=ASTC -clientconfig=Development -serverconfig=Development -clean -cook -allmaps -build -stage -pak -package -archive -archivedirectory=%ARCHIVE_DIR_QUEST%

echo ========================================
echo CI/CD Build Pipeline Complete!
echo ========================================
pause