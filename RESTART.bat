@echo off
chcp 65001 >nul
title Viral Short Studio - KHOI DONG LAI
cd /d "%~dp0"
echo.
echo   ===========================================
echo    KHOI DONG LAI VIRAL SHORT STUDIO
echo   ===========================================
echo.
echo   Dang tat server cu tren cong 5178 (neu co)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5178 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 >nul
echo   Dang khoi dong ban MOI...
echo.
start "" http://localhost:5178
node server.mjs
pause
