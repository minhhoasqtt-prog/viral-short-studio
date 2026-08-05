// 🩺 KIỂM TRA HỆ THỐNG — chạy: node "KIỂM TRA HỆ THỐNG.mjs"
// Máy tự soát xem đã đủ công cụ và cấu hình chưa, TRƯỚC khi bạn mất công làm video.
// Không gọi AI, không tốn credits, không sửa gì cả — chỉ đọc và báo cáo.
process.removeAllListeners("warning"); // ẩn cảnh báo kỹ thuật của Node cho đỡ rối mắt
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === "win32";
let thieuBatBuoc = 0, thieuTuyChon = 0;

// shell=true cần cho các lệnh Node cài toàn cục (claude/lark-cli/yt-dlp là file .cmd shim,
// spawn không thấy nếu không qua shell). NHƯNG shell trên Windows lại phá hỏng tham số có
// dấu nháy (vd python -c "import x") → những lệnh đó phải gọi TRỰC TIẾP, không qua shell.
function chay(cmd, args, { dungShell = isWin } = {}) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf-8", shell: dungShell, timeout: 20000 });
    if (r.error || r.status !== 0) return null;
    return String(r.stdout || r.stderr || "").split(/\r?\n/)[0].trim();
  } catch { return null; }
}

function bao(ten, ket, batBuoc, goiY) {
  if (ket) { console.log(`  ✅ ${ten.padEnd(22)} ${ket.slice(0, 60)}`); return; }
  if (batBuoc) { thieuBatBuoc++; console.log(`  ❌ ${ten.padEnd(22)} THIẾU — ${goiY}`); }
  else { thieuTuyChon++; console.log(`  ⚠️  ${ten.padEnd(22)} chưa có — ${goiY}`); }
}

console.log("\n=== KIỂM TRA HỆ THỐNG — VIRAL SHORT STUDIO ===\n");

console.log("① CÔNG CỤ NỀN");
bao("Node.js", chay("node", ["-v"]), true, "chạy 'CÀI ĐẶT (chạy 1 lần)'");
bao("FFmpeg", chay("ffmpeg", ["-version"]), true, "chạy 'CÀI ĐẶT (chạy 1 lần)'");
bao("FFprobe", chay("ffprobe", ["-version"]), true, "cài kèm FFmpeg");
const py = process.env.VSS_PYTHON || (isWin ? "python" : "python3");
bao("Python", chay(py, ["--version"], { dungShell: false }), true, "cài Python 3.10+ (tránh bản Microsoft Store)");
bao("Whisper (nghe)", chay(py, ["-c", "import faster_whisper"], { dungShell: false }) !== null ? "faster-whisper OK" : null,
  true, "pip install faster-whisper");
bao("yt-dlp (tải link)", chay("yt-dlp", ["--version"]), false, "pip install yt-dlp — chỉ cần khi dùng link YouTube/FB");
bao("Claude CLI (AI)", chay("claude", ["--version"]), false, "npm i -g @anthropic-ai/claude-code rồi 'claude login' — thiếu thì AI chạy chế độ dự phòng");
bao("lark-cli (đăng Lark)", chay("lark-cli", ["--version"]), false, "npm i -g @larksuite/cli rồi 'lark-cli login' — chỉ cần nếu dùng Lark");

console.log("\n② TĂNG TỐC PHẦN CỨNG");
const gpu = chay("ffmpeg", ["-hide_banner", "-encoders"]);
const coNvenc = gpu !== null && (spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf-8", shell: isWin }).stdout || "").includes("h264_nvenc");
console.log(coNvenc
  ? "  ✅ GPU NVENC          có — render nhanh"
  : "  ⚠️  GPU NVENC          không thấy — vẫn chạy bằng CPU, chỉ lâu hơn");

console.log("\n③ CẤU HÌNH CỦA BẠN");
const sFile = path.join(ROOT, "settings.local.json");
let S = {};
try { if (fs.existsSync(sFile)) S = JSON.parse(fs.readFileSync(sFile, "utf-8")) || {}; } catch { /* file hỏng */ }
const lark = S.lark || {}, brand = S.brand || {};
const larkDu = !!(lark.baseToken && lark.tableId && lark.attachField);
console.log(larkDu
  ? `  ✅ Kết nối Lark Base   Base ${String(lark.baseToken).slice(0, 8)}… · bảng ${String(lark.tableId).slice(0, 8)}…`
  : "  ⚠️  Kết nối Lark Base   chưa khai — mở tab ⚙️ Cấu hình, dán link Base (bỏ qua cũng dùng được)");
console.log(brand.name
  ? `  ✅ Tên kênh            ${brand.name}`
  : "  ⚠️  Tên kênh            chưa khai — bìa video sẽ không in tên");
console.log(fs.existsSync(path.join(ROOT, "standards", "thuong-hieu.md"))
  ? "  ✅ Chất riêng của kênh standards/thuong-hieu.md"
  : "  ⚠️  Chất riêng của kênh chưa viết — AI chọn đoạn theo cách chung");

console.log("\n④ TÀI SẢN THƯƠNG HIỆU (tuỳ chọn)");
for (const [f, mo] of [
  ["assets/logo-mentor.png", "logo đóng dấu góc video"],
  ["assets/watermark.png", "watermark giữa đỉnh video"],
]) {
  console.log(fs.existsSync(path.join(ROOT, f))
    ? `  ✅ ${f.padEnd(24)} ${mo}`
    : `  ⚠️  ${f.padEnd(24)} chưa có — video ra sẽ không có ${mo}`);
}
const fonts = (() => { try { return fs.readdirSync(path.join(ROOT, "assets", "fonts")).filter((x) => /\.(otf|ttf)$/i.test(x)).length; } catch { return 0; } })();
console.log(`  ${fonts ? "✅" : "⚠️ "} Font phụ đề           ${fonts} font trong assets/fonts`);

console.log("\n⑤ Ổ ĐĨA");
try {
  const st = fs.statfsSync(ROOT);
  const freeGB = (st.bavail * st.bsize) / 1e9;
  console.log(freeGB < 20
    ? `  ⚠️  Còn trống ${freeGB.toFixed(1)} GB — nên dọn kho (DỌN KHO.bat), video chiếm nhiều chỗ`
    : `  ✅ Còn trống ${freeGB.toFixed(1)} GB`);
} catch { console.log("  ⚠️  Không đọc được dung lượng ổ"); }

console.log("\n" + "=".repeat(50));
if (thieuBatBuoc) {
  console.log(`❌ THIẾU ${thieuBatBuoc} công cụ BẮT BUỘC — chạy "CÀI ĐẶT (chạy 1 lần)" rồi kiểm tra lại.`);
  process.exit(1);
}
console.log(thieuTuyChon
  ? `✅ Đủ công cụ bắt buộc — chạy được. Còn ${thieuTuyChon} mục tuỳ chọn chưa khai (xem dấu ⚠️ ở trên).`
  : "✅ Mọi thứ sẵn sàng.");
