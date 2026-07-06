#!/bin/bash
# CÀI "TÁCH NHẠC (AI)" — DEMUCS cho Viral Short Studio (macOS). Chạy 1 lần.
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
clear
echo "=========================================================="
echo "   CÀI \"TÁCH NHẠC (AI)\" — DEMUCS  (chạy 1 lần)"
echo "=========================================================="
echo
echo "Sau khi cài, trong phần mềm chọn \"Giữ giọng, khử tạp âm\""
echo "= \"🎤 Tách nhạc (AI)\" để bỏ nhạc nền, chỉ giữ voice."
echo

# Dùng CHUNG môi trường .venv với bước cài chính (nếu có), không thì python3 hệ thống.
if [ -x "$DIR/.venv/bin/python" ]; then
  PY="$DIR/.venv/bin/python"
else
  PY="python3"
fi
echo "Python: $PY"
echo

"$PY" -m pip install --upgrade pip >/dev/null 2>&1
echo "--- Cài torch + demucs + soundfile (tải ~2GB, có thể lâu) ---"
"$PY" -m pip install --upgrade torch demucs soundfile

echo
echo "--- Kiểm tra ---"
"$PY" -c "import demucs, torch; print('  [x] Demucs OK | MPS(GPU):', getattr(getattr(torch,'backends',None),'mps',None) and torch.backends.mps.is_available())" \
  && echo "HOÀN TẤT! Mở phần mềm, chọn '🎤 Tách nhạc (AI)'." \
  || echo "[!] Cài chưa xong — xem lỗi phía trên."
echo
read -n 1 -s -r -p "Nhấn phím bất kỳ để đóng..."
