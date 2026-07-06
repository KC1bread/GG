@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 🚀 正在启动 Relativistic Voyager Alpha...
start http://localhost:5173
call npx vite --host 0.0.0.0
pause
