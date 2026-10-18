@echo off
cd /d C:\PRJ381
call C:\PRJ381\build_all.bat Windows > C:\PRJ381\win_build_console.log 2>&1
echo EXITCODE=%ERRORLEVEL% >> C:\PRJ381\win_build_console.log
echo WIN_BUILD_DONE >> C:\PRJ381\win_build_console.log
