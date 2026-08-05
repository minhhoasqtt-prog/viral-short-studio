@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === DON KHO — Viral Short Studio ===
echo (giu nguon 3 ngay, xoa nguon cu + file thao, gom file roi)
echo.
node -e "import('./lib/housekeep.mjs').then(m=>m.housekeep({ttlDays:3,onLog:console.log})).catch(e=>{console.log('LOI: '+e.message);process.exit(1)})"
echo.
pause
