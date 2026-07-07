@echo off
chcp 65001 >nul
title CÀI ĐẶT - Viral Short Studio
cd /d "%~dp0"
color 0B

echo.
echo   ==========================================================
echo      VIRAL SHORT STUDIO  -  CÀI ĐẶT CÔNG CỤ (chạy 1 lần)
echo   ==========================================================
echo.
echo   Trình này sẽ kiểm tra và cài các công cụ cần thiết:
echo     1) Node.js   2) FFmpeg   3) Python + Whisper
echo     4) yt-dlp    5) Claude CLI (bộ não AI)
echo     6) lark-cli  (đăng video lên Lark Base) + đăng nhập
echo.
pause

set NEEDREOPEN=0

REM ---- winget có sẵn không? ----
where winget >nul 2>&1
if errorlevel 1 (
  echo   [!] Máy chưa có "winget" (App Installer). Hãy cài "App Installer" từ Microsoft Store rồi chạy lại.
  echo.
)

REM ================= 1) NODE.JS =================
echo.
echo   --- [1/6] Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo   [ ] Chưa có Node.js -> đang cài...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set NEEDREOPEN=1
) else (
  for /f "delims=" %%v in ('node -v') do echo   [x] Đã có Node.js %%v
)

REM ================= 2) FFMPEG =================
echo.
echo   --- [2/6] FFmpeg ---
where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo   [ ] Chưa có FFmpeg -> đang cài...
  winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
  set NEEDREOPEN=1
) else (
  echo   [x] Đã có FFmpeg
)

REM ================= 3) PYTHON =================
REM Tránh "bẫy Python của Microsoft Store": KHÔNG tin `where python` vì có thể trúng
REM alias giả (mở Store, pip không cài được). Ưu tiên trình khởi chạy `py` (đáng tin).
echo.
echo   --- [3/6] Python ---
set "PYCMD="
py -3 --version >nul 2>&1 && set "PYCMD=py -3"
if not defined PYCMD (
  python --version 2>nul | findstr /I /C:"Python 3" >nul 2>&1 && set "PYCMD=python"
)
if not defined PYCMD (
  echo   [ ] Chưa có Python thật -> đang cài...
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  set NEEDREOPEN=1
) else (
  for /f "delims=" %%v in ('%PYCMD% --version 2^>^&1') do echo   [x] Đã có %%v
)

if "%NEEDREOPEN%"=="1" (
  echo.
  echo   ==========================================================
  echo    ĐÃ CÀI CÔNG CỤ NỀN. Vui lòng ĐÓNG cửa sổ này và
  echo    CHẠY LẠI "CÀI ĐẶT" một lần nữa để hoàn tất các bước sau.
  echo   ==========================================================
  echo.
  pause
  exit /b
)

REM ---- Ghi đường dẫn Python THẬT vào .env để phần mềm luôn gọi đúng ----
REM (lúc chạy có thể trúng alias Store; ghi cứng đường dẫn thật cho chắc.)
set "PYEXE="
for /f "delims=" %%p in ('%PYCMD% -c "import sys;print(sys.executable)" 2^>nul') do set "PYEXE=%%p"
if defined PYEXE (
  findstr /B /C:"VSS_PYTHON=" ".env" >nul 2>&1 || (
    >>".env" echo VSS_PYTHON=%PYEXE%
    echo   [x] Đã ghi đường dẫn Python vào .env
  )
)

REM ================= 4) WHISPER + YT-DLP (pip) =================
echo.
echo   --- [4/6] Whisper (gõ chữ) + yt-dlp ---
%PYCMD% -m pip install --upgrade pip >nul 2>&1
echo   Đang cài faster-whisper + yt-dlp (có thể mất vài phút)...
%PYCMD% -m pip install --upgrade faster-whisper yt-dlp
echo   Đang cài thư viện tăng tốc GPU (bỏ qua nếu máy không có card NVIDIA)...
%PYCMD% -m pip install --upgrade nvidia-cublas-cu12 nvidia-cudnn-cu12 >nul 2>&1

REM ================= 5) CLAUDE CLI =================
echo.
echo   --- [5/6] Claude CLI (bộ não AI chọn đoạn) ---
where claude >nul 2>&1
if errorlevel 1 (
  echo   [ ] Chưa có Claude CLI -> đang cài...
  call npm install -g @anthropic-ai/claude-code
) else (
  echo   [x] Đã có Claude CLI
)

REM ================= 6) LARK-CLI (đăng lên Lark Base) =================
echo.
echo   --- [6/6] lark-cli (đăng video lên Lark Base của bạn) ---
where lark-cli >nul 2>&1
if errorlevel 1 (
  echo   [ ] Chưa có lark-cli -> đang cài...
  call npm install -g @larksuite/cli
) else (
  echo   [x] Đã có lark-cli
)

echo.
echo   ==========================================================
echo    ĐĂNG NHẬP (làm 1 lần) — cần cho AI và cho đăng Lark
echo   ==========================================================
echo.
echo   (a) ĐĂNG NHẬP CLAUDE (tài khoản Anthropic) — cho "bộ não AI".
echo       Không cần AI thì đóng cửa sổ đăng nhập là được.
pause
call claude login

echo.
echo   (b) ĐĂNG NHẬP LARK — để đăng video lên Lark Base của BẠN.
echo       Nếu KHÔNG dùng Lark, gõ  n  rồi Enter để bỏ qua.
set "DOLARK="
set /p DOLARK=  Đăng nhập Lark bây giờ? (Y/n):
if /I not "%DOLARK%"=="n" call lark-cli login

echo.
echo   ==========================================================
echo    HOÀN TẤT! Giờ bấm đúp "MỞ PHẦN MỀM" để dùng.
echo    (Chạy "TẠO LỐI TẮT MÀN HÌNH" để có biểu tượng ngoài Desktop)
echo    Lần cắt ĐẦU TIÊN sẽ tải model nghe-chữ (~1.5GB) — cần mạng, hơi lâu.
echo   ==========================================================
echo.
pause
