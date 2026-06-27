@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ops\push-vercel-env.ps1" -EnvFile "%~dp0.env" -Targets production
endlocal
