@echo off
chcp 65001 >nul
title Viral Short Studio - KIEM THU
cd /d "%~dp0"
node scripts\kiem-thu.mjs
pause
