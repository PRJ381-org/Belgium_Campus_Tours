@echo off
cd /d C:\PRJ381
del /q "C:\PRJ381\Saved\Logs\win_build.done" 2>nul
call build_all.bat Windows > "C:\PRJ381\Saved\Logs\win_build_console.log" 2>&1
echo EXITCODE=%ERRORLEVEL%>> "C:\PRJ381\Saved\Logs\win_build_console.log"
echo done > "C:\PRJ381\Saved\Logs\win_build.done"
