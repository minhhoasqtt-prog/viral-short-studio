#!/bin/bash
# ==========================================================
#   VIRAL SHORT STUDIO — CÀI ĐẶT CÔNG CỤ cho macOS (chạy 1 lần)
#   Cài: Homebrew · Node.js · FFmpeg · Python · faster-whisper
#        · yt-dlp · Claude CLI (bộ não AI)
# ==========================================================
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"

echo ""
echo "  =========================================================="
echo "     VIRAL SHORT STUDIO  -  CÀI ĐẶT (macOS)"
echo "  =========================================================="
echo ""

# ---------- 1) Homebrew ----------
echo "  --- [1/6] Homebrew ---"
if ! command -v brew >/dev/null 2>&1; then
  echo "  [ ] Chưa có Homebrew -> đang cài (có thể hỏi MẬT KHẨU MÁY của bạn)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo "  [x] Đã có Homebrew"
fi
# Nạp brew vào phiên hiện tại (Apple Silicon /opt/homebrew · Intel /usr/local)
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ]   && eval "$(/usr/local/bin/brew shellenv)"

if ! command -v brew >/dev/null 2>&1; then
  echo "  [!] Vẫn chưa dùng được Homebrew. Hãy đóng cửa sổ, mở lại file này lần nữa."
  read -r -p "  Nhấn Enter để thoát... " _; exit 1
fi

# ---------- 2) Node · FFmpeg · Python ----------
echo ""
echo "  --- [2/6] Node.js · FFmpeg · Python ---"
for pkg in node python; do
  if brew list "$pkg" >/dev/null 2>&1; then
    echo "  [x] Đã có $pkg"
  else
    echo "  [ ] Cài $pkg..."
    brew install "$pkg"
  fi
done

# --- FFmpeg PHẢI CÓ libass (phụ đề) + freetype + fontconfig ---
# Homebrew 2026 tách formula: bản "ffmpeg" thường BỎ libass/freetype/fontconfig
# → lỗi "No such filter: 'ass'" / phụ đề không hiện. Ta dò và tự vá bằng ffmpeg-full.
has_libass() { ffmpeg -hide_banner -filters 2>/dev/null | grep -qE '^[[:space:]]*[A-Z.]+[[:space:]]+ass[[:space:]]'; }

echo ""
echo "  --- FFmpeg (kèm libass cho phụ đề) ---"
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "  [ ] Cài ffmpeg..."
  brew install ffmpeg
else
  echo "  [x] Đã có ffmpeg"
fi

if has_libass; then
  echo "  [x] ffmpeg đã có libass (phụ đề chạy được)."
else
  echo "  [!] ffmpeg THIẾU libass → cài bản đầy đủ 'ffmpeg-full' và link đè..."
  # Cách 1: formula ffmpeg-full (đủ libass/freetype/fontconfig)
  if brew install ffmpeg-full 2>/dev/null; then
    brew link --overwrite --force ffmpeg-full 2>/dev/null
  else
    # Cách 2 (dự phòng): tap homebrew-ffmpeg với các tuỳ chọn libass/freetype/fontconfig
    echo "  [i] Không có 'ffmpeg-full' → dùng tap homebrew-ffmpeg (biên dịch, lâu hơn)..."
    brew tap homebrew-ffmpeg/ffmpeg 2>/dev/null
    brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-libass --with-freetype --with-fontconfig 2>/dev/null
    brew link --overwrite --force homebrew-ffmpeg/ffmpeg/ffmpeg 2>/dev/null
  fi
  hash -r 2>/dev/null
  if has_libass; then
    echo "  [x] Đã vá xong — ffmpeg giờ có libass (phụ đề chạy được)."
  else
    echo "  [!] VẪN thiếu libass. Thử thủ công trong Terminal:"
    echo "        brew install ffmpeg-full && brew link --overwrite --force ffmpeg-full"
    echo "      (hoặc: brew reinstall ffmpeg). Phụ đề có thể không hiện tới khi vá được."
  fi
fi

# ---------- 3) Môi trường Python riêng (.venv) ----------
# Để faster-whisper + yt-dlp nằm gọn trong thư mục phần mềm, không đụng hệ thống.
echo ""
echo "  --- [3/6] Môi trường Python riêng (.venv) ---"
if [ ! -d "$DIR/.venv" ]; then
  python3 -m venv "$DIR/.venv"
fi
echo "  [ ] Cài faster-whisper + yt-dlp (có thể mất vài phút)..."
"$DIR/.venv/bin/python" -m pip install --upgrade pip >/dev/null 2>&1
"$DIR/.venv/bin/python" -m pip install --upgrade faster-whisper yt-dlp

# ---------- 4) Claude CLI ----------
echo ""
echo "  --- [4/7] Claude CLI (bộ não AI) ---"
if ! command -v claude >/dev/null 2>&1; then
  echo "  [ ] Cài Claude CLI..."
  npm install -g @anthropic-ai/claude-code
else
  echo "  [x] Đã có Claude CLI"
fi

# ---------- 5) lark-cli (đăng lên Lark Base) ----------
echo ""
echo "  --- [5/7] lark-cli (đăng video lên Lark Base của bạn) ---"
if ! command -v lark-cli >/dev/null 2>&1; then
  echo "  [ ] Cài lark-cli..."
  npm install -g @larksuite/cli
else
  echo "  [x] Đã có lark-cli"
fi

# ---------- 6) Cho phép bấm-đúp các file .command khác ----------
echo ""
echo "  --- [6/7] Mở khoá double-click cho các file .command ---"
chmod +x "$DIR/MỞ PHẦN MỀM (Mac).command" "$DIR/TẮT PHẦN MỀM (Mac).command" \
         "$DIR/CÀI TÁCH NHẠC (Mac).command" 2>/dev/null
echo "  [x] Xong"

# ---------- 7) Đăng nhập (Claude + Lark) ----------
echo ""
echo "  --- [7/7] Đăng nhập (làm 1 lần) ---"
echo "  (a) ĐĂNG NHẬP CLAUDE (cần tài khoản Anthropic) — cho bộ não AI."
echo "      Cửa sổ đăng nhập sẽ mở bằng trình duyệt. Không cần AI thì gõ n."
read -r -p "  Đăng nhập Claude bây giờ? (Y/n) " ans
if [ "$ans" != "n" ] && [ "$ans" != "N" ]; then
  claude login
fi
echo ""
echo "  (b) ĐĂNG NHẬP LARK — để đăng video lên Lark Base của BẠN."
echo "      Nếu KHÔNG dùng Lark, gõ n rồi Enter để bỏ qua."
read -r -p "  Đăng nhập Lark bây giờ? (Y/n) " ansl
if [ "$ansl" != "n" ] && [ "$ansl" != "N" ]; then
  lark-cli login
fi

echo ""
echo "  =========================================================="
echo "   HOÀN TẤT! Giờ bấm đúp \"MỞ PHẦN MỀM (Mac).command\" để dùng."
echo "  =========================================================="
echo ""
read -r -p "  Nhấn Enter để đóng... " _
