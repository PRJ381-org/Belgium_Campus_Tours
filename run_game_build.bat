@echo off
cd /d C:\PRJ381
call "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" PRJ381 Win64 Development -Project="C:\PRJ381\PRJ381.uproject" -Verbose -WaitMutex > C:\PRJ381\game_build.log 2>&1
echo EXITCODE=%ERRORLEVEL% >> C:\PRJ381\game_build.log
echo BUILD_DONE_MARKER >> C:\PRJ381\game_build.log
