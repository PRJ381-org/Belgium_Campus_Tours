@echo off
echo === Windows Desktop cook+stage+package (skipbuild) ===
call "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project=C:\PRJ381\PRJ381.uproject -nop4 -unattended -utf8output -platform=Win64 -clientconfig=Development -serverconfig=Development -skipbuild -cook -allmaps -stage -pak -package -archive -archivedirectory=C:\PRJ381\Builds\Windows "-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bGenerateChunks=False" "-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bGenerateNoChunks=True" -log=C:\PRJ381\Saved\Logs\UAT_Windows_BuildCookRun_skipbuild.log > C:\PRJ381\win_build3.log 2>&1
if errorlevel 1 (echo EXITCODE_FAIL) else (echo EXITCODE_OK)
echo WIN_BUILD3_DONE >> C:\PRJ381\win_build3.log
