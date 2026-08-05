// Đầu vào NHẠC & CẢNH TRÁM linh hoạt — dùng chung cho mọi tab biên tập:
//   Nhạc:      file giữ nguyên · THƯ MỤC → tự chọn ngẫu nhiên 1 bài · LINK → tải audio bằng yt-dlp.
//   Cảnh trám: thư mục giữ nguyên · LINK video (1 hay nhiều) → tải về thư mục cache rồi trám như thư mục.
// Tải về cache theo hash URL trong work/tai-ve/ → link đã tải thì DÙNG LẠI, không tải lần hai.
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { run, WORK } from "./util.mjs";
import { YTDLP } from "./extract.mjs";
import { isDriveUrl, parseDriveUrl, driveDownload, driveDownloadFolder } from "./drive.mjs";

const DL_DIR = path.join(WORK, "tai-ve");
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|opus|wma)$/i;
const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v)$/i;

const isUrl = (s) => /^https?:\/\//i.test(String(s || "").trim());
const urlKey = (u) => crypto.createHash("sha1").update(String(u).trim()).digest("hex").slice(0, 16);

function ensureDl(sub = "") {
  const d = sub ? path.join(DL_DIR, sub) : DL_DIR;
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Tìm file đã tải theo tiền tố key (tên file dạng "<key>-<tiêu đề>.<ext>").
function findByPrefix(dir, prefix, extRe) {
  try {
    const f = fs.readdirSync(dir).find((n) => n.startsWith(prefix) && extRe.test(n));
    return f ? path.join(dir, f) : null;
  } catch { return null; }
}

// 🎵 NHẠC: trả về đường dẫn 1 file nhạc dùng được (hoặc null nếu bỏ nhạc).
export async function resolveMusicInput(input, { onLog = () => {} } = {}) {
  const p = String(input || "").trim();
  if (!p) return null;

  // LINK DRIVE → tải thẳng file nhạc (yt-dlp không tải nổi file Drive thường)
  if (isDriveUrl(p)) {
    onLog("🎵 Nhạc từ link Google Drive…");
    return await driveDownload(p, { onLog, prefix: "nhac" });
  }

  // LINK → tải audio (cache theo URL)
  if (isUrl(p)) {
    const dir = ensureDl();
    const key = "nhac-" + urlKey(p);
    const hit = findByPrefix(dir, key, AUDIO_EXT);
    if (hit) { onLog(`🎵 nhạc từ link (dùng lại bản đã tải): ${path.basename(hit)}`); return hit; }
    onLog("🎵 Tải nhạc từ link bằng yt-dlp...");
    await run(YTDLP, [
      "-f", "bestaudio/best", "-x", "--audio-format", "m4a",
      "--no-playlist", "--restrict-filenames",
      "-o", path.join(dir, `${key}-%(title).50s.%(ext)s`), p,
    ], { onLog: (l) => onLog("  " + l) });
    const got = findByPrefix(dir, key, AUDIO_EXT);
    if (!got) throw new Error("Không tải được nhạc từ link: " + p);
    onLog(`🎵 nhạc đã tải: ${path.basename(got)}`);
    return got;
  }

  // THƯ MỤC → chọn ngẫu nhiên 1 bài (mỗi lần dựng một bài khác nhau cho đa dạng)
  let st = null;
  try { st = fs.statSync(p); } catch { return p; /* để tầng dưới báo lỗi đường dẫn như cũ */ }
  if (st.isDirectory()) {
    const tracks = fs.readdirSync(p).filter((n) => AUDIO_EXT.test(n));
    if (!tracks.length) { onLog("⚠ thư mục nhạc không có file audio (mp3/m4a/wav...) → bỏ nhạc nền"); return null; }
    const pick = tracks[Math.floor(Math.random() * tracks.length)];
    onLog(`🎵 chọn ngẫu nhiên từ thư mục nhạc (${tracks.length} bài): ${pick}`);
    return path.join(p, pick);
  }
  return p; // file như cũ
}

// 🎞️ CẢNH TRÁM: trả về đường dẫn 1 THƯ MỤC b-roll dùng được (hoặc null nếu bỏ).
// Nhận nhiều link cách nhau bởi ";" hoặc xuống dòng hoặc khoảng trắng trước "http".
// Tên file tải về giữ TIÊU ĐỀ video → khớp từ khóa lời nói như thư mục thường.
export async function resolveBrollInput(input, { onLog = () => {} } = {}) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const parts = raw.split(/[;\n\r]+|\s+(?=https?:\/\/)/).map((s) => s.trim()).filter(Boolean);
  const urls = parts.filter(isUrl);
  if (!urls.length) return raw; // thư mục local như cũ

  // Chỉ 1 link THƯ MỤC Drive → dùng thẳng thư mục đã tải làm kho b-roll.
  if (urls.length === 1 && isDriveUrl(urls[0])) {
    try {
      if (parseDriveUrl(urls[0]).kind === "folder") {
        onLog("🎞️ Cảnh trám từ THƯ MỤC Google Drive…");
        return await driveDownloadFolder(urls[0], { onLog, kinds: "video+image" });
      }
    } catch (e) { onLog("⚠ " + e.message); }
  }

  const dir = ensureDl("broll-" + urlKey(urls.join("|")));
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const key = "clip-" + urlKey(u);

    // Link Drive (file hoặc thư mục) → tải bằng drive.mjs, đổ chung vào thư mục b-roll này.
    if (isDriveUrl(u)) {
      onLog(`🎞️ Cảnh trám ${i + 1}/${urls.length}: Google Drive…`);
      try {
        const info = parseDriveUrl(u);
        if (info.kind === "folder") {
          const src = await driveDownloadFolder(u, { onLog, kinds: "video+image" });
          for (const n of fs.readdirSync(src)) {
            const to = path.join(dir, n);
            if (!fs.existsSync(to)) fs.copyFileSync(path.join(src, n), to);
          }
        } else {
          await driveDownload(u, { onLog, dir, prefix: "clip" });
        }
      } catch (e) { onLog(`  ⚠ link Drive này lỗi, bỏ qua: ${e.message}`); }
      continue;
    }

    if (findByPrefix(dir, key, VIDEO_EXT)) { onLog(`🎞️ cảnh trám ${i + 1}/${urls.length}: dùng lại bản đã tải`); continue; }
    onLog(`🎞️ Tải cảnh trám ${i + 1}/${urls.length} bằng yt-dlp...`);
    try {
      await run(YTDLP, [
        "-f", "mp4/bestvideo[ext=mp4]+bestaudio/best", "--merge-output-format", "mp4",
        "--no-playlist", "--restrict-filenames",
        "-o", path.join(dir, `${key}-%(title).60s.%(ext)s`), u,
      ], { onLog: (l) => onLog("  " + l) });
    } catch (e) { onLog(`  ⚠ link này lỗi, bỏ qua: ${e.message}`); }
  }
  const MEDIA_EXT = /\.(mp4|mov|mkv|webm|m4v|jpg|jpeg|png|webp|gif)$/i;
  const got = (() => { try { return fs.readdirSync(dir).filter((n) => MEDIA_EXT.test(n)); } catch { return []; } })();
  if (!got.length) { onLog("⚠ không tải được cảnh trám nào từ link → bỏ b-roll"); return null; }
  onLog(`🎞️ thư viện cảnh trám từ link: ${got.length} clip (${dir})`);
  return dir;
}
