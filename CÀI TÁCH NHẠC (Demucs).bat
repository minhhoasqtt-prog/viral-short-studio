@echo off
chcp 65001 >nul
title CÀI TÁCH NHẠC (Demucs) - Viral Short Studio
cd /d "%~dp0"
color 0B

echo.
echo   ==========================================================
echo      CÀI "TÁCH NHẠC (AI)" — DEMUCS  (chạy 1 lần)
echo   ==========================================================
echo.
echo   Sau khi cài xong, trong phần mềm chọn ô "Giữ giọng, khử tạp âm"
echo   = "🎤 Tách nhạc (AI)" để BỎ HẲN nhạc nền, chỉ giữ voice nhân vật.
echo.
echo   Cần: Python (đã cài ở bước CÀI ĐẶT chính). Dung lượng tải ~2GB.
echo.
pause

REM ---- Python có chưa? ----
where python >nul 2>&1
if errorlevel 1 (
  echo   [!] Chưa có Python. Hãy chạy "CÀI ĐẶT (chạy 1 lần).bat" trước rồi quay lại.
  echo.
  pause
  exit /b
)

python -m pip install --upgrade pip >nul 2>&1

REM ---- Có card NVIDIA không? Có thì cài torch bản GPU (CUDA) cho NHANH ----
where nvidia-smi >nul 2>&1
if errorlevel 1 (
  echo   --- Không thấy card NVIDIA -> cài torch bản CPU (chạy được, chậm hơn) ---
  python -m pip install --upgrade torch
) else (
  echo   --- Có card NVIDIA -> cài torch bản GPU CUDA 12.1 (nhanh) ---
  python -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/cu121
)

echo.
echo   --- Cài Demucs + soundfile ---
python -m pip install --upgrade demucs soundfile

echo.
echo   --- Kiểm tra ---
python -c "import demucs, torch; print('  [x] Demucs OK  |  CUDA (GPU):', torch.cuda.is_available())"
if errorlevel 1 (
  echo   [!] Cài chưa xong. Xem thông báo lỗi phía trên rồi thử chạy lại.
) else (
  echo.
  echo   ==========================================================
  echo    HOÀN TẤT! Mở phần mềm, chọn "🎤 Tách nhạc (AI)" là dùng được.
  echo   ==========================================================
)
echo.
pause
