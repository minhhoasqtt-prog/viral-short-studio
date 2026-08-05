@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   BAT DON KHO TU DONG — Viral Short Studio
echo   (moi dem 03:00 tu don file trung gian, giu nguon 3 ngay)
echo ============================================================
echo.
schtasks /create /tn "HMH-ViralStudio-DonKho" /tr "wscript.exe \"%~dp0DỌN KHO (tự động).vbs\"" /sc DAILY /st 03:00 /f
echo.
if %errorlevel%==0 (
  echo [OK] Da bat. Moi dem 3h may se tu don kho, khong hien cua so.
  echo      Xem lich su don o file: work\housekeep.log
) else (
  echo [LOI] Khong dang ky duoc. Thu bam chuot phai file nay ^> "Run as administrator".
)
echo.
echo (Muon TAT tu dong: chay lenh  schtasks /delete /tn "HMH-ViralStudio-DonKho" /f)
pause
