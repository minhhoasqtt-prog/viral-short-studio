// ✅ KIỂM TRA SẴN SÀNG — máy đã đủ đồ nghề chưa? Mỗi mục trả ok/đỏ + cách sửa.
// Dùng cho trang Hệ thống (và khi chuyển giao sang máy học viên).
import fs from "node:fs";
import path from "node:path";
import { run, PY, __root, WORK } from "./util.mjs";
import { hasNvenc } from "./ffmpeg.mjs";
import { listFonts } from "./fonts.mjs";
import { listFrames } from "./frames.mjs";
import { BRAND } from "./presets.mjs";

// shell chỉ cho công cụ dạng .cmd trên Windows (claude, lark-cli); exe thật (python, ffmpeg) chạy thẳng
// để cmd.exe không làm hỏng tham số có ngoặc/chấm phẩy.
async function tryRun(cmd, args, ms = 20000, shell = false) {
  return await Promise.race([
    run(cmd, args, { shell: shell && process.platform === "win32" }).then((r) => ({ ok: true, out: (r.out + r.err).trim() })).catch((e) => ({ ok: false, out: e.message })),
    new Promise((r) => setTimeout(() => r({ ok: false, out: "quá thời gian" }), ms)),
  ]);
}
const first = (s) => String(s || "").split(/\r?\n/).find((l) => l.trim()) || "";

export async function readiness() {
  const [ff, py, cl, lk, yt, gpu] = await Promise.all([
    tryRun("ffmpeg", ["-version"]),
    tryRun(PY, ["-c", "import faster_whisper;print(faster_whisper.__version__)"]),
    tryRun(process.env.VSS_CLAUDE || "claude", ["--version"], 20000, true),
    tryRun(process.env.VSS_LARK_CLI || "lark-cli", ["--version"], 20000, true),
    tryRun(process.env.VSS_YTDLP || "yt-dlp", ["--version"]),
    hasNvenc().catch(() => false),
  ]);
  let freeGB = null;
  try { const st = fs.statfsSync(WORK); freeGB = +((st.bavail * st.bsize) / 1e9).toFixed(1); } catch { /* bỏ */ }
  const thumbOk = !!BRAND.thumbPhotoDir && fs.existsSync(BRAND.thumbPhotoDir);
  const items = [
    { key: "ffmpeg", name: "FFmpeg (dựng video)", ok: ff.ok, info: first(ff.out).slice(0, 60), fix: "Cài ffmpeg và thêm vào PATH (CÀI ĐẶT.bat làm sẵn)." },
    { key: "whisper", name: "Bóc âm (faster-whisper)", ok: py.ok, info: py.ok ? "phiên bản " + first(py.out) : first(py.out).slice(0, 80), fix: "Chạy: pip install faster-whisper" },
    { key: "claude", name: "AI Claude (chọn đoạn, viết caption)", ok: cl.ok, info: first(cl.out).slice(0, 60), fix: "Cài Claude Code và đăng nhập (claude login)." },
    { key: "lark", name: "lark-cli (link Record Zoom Lark, báo Lark)", ok: lk.ok, info: first(lk.out).slice(0, 60), fix: "npm i -g lark-cli rồi lark-cli auth login." },
    { key: "ytdlp", name: "yt-dlp (link YouTube/FB/TikTok)", ok: yt.ok, info: first(yt.out).slice(0, 60), fix: "pip install -U yt-dlp" },
    { key: "gpu", name: "GPU NVENC (dựng nhanh)", ok: !!gpu, info: gpu ? "đang dùng GPU" : "đang dùng CPU (chậm hơn nhưng vẫn chạy)", fix: "Cập nhật driver NVIDIA mới.", optional: true },
    { key: "fonts", name: "Font chữ phụ đề", ok: listFonts().length > 0, info: listFonts().length + " font", fix: "Chép .otf/.ttf vào assets/fonts." },
    { key: "frames", name: "Khung thương hiệu", ok: listFrames().length > 0, info: listFrames().map((f) => f.name).join(", ") || "chưa có", fix: "Thêm thư mục assets/frames/<tên> (frame.png + frame.json).", optional: true },
    { key: "thumb", name: "Thư mục ảnh thumbnail", ok: thumbOk, info: BRAND.thumbPhotoDir || "chưa đặt", fix: "Gắn ổ chứa ảnh hoặc đặt VSS_THUMB_DIR.", optional: true },
    { key: "disk", name: "Dung lượng trống", ok: freeGB == null || freeGB > 20, info: freeGB == null ? "?" : freeGB + " GB", fix: "Chạy DỌN KHO hoặc dời work sang ổ lớn hơn." },
  ];
  return { ok: items.every((i) => i.ok || i.optional), items, root: __root, work: WORK, platform: process.platform };
}
