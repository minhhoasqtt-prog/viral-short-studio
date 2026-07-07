#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// lam-video.mjs — Cầu nối: 1 đường dẫn video → Viral Short Studio → biên tập → (Lark)
//
// Dùng ĐỘC LẬP (tự chọn video, gọi phần mềm) hoặc cho trợ lý AI (TÔM / Bộ Não) gọi
// khi bạn ra lệnh "làm video". KHÔNG chứa bí mật — mọi thứ cấu hình qua biến môi trường.
//
// Zero-dependency, Node >= 18 (dùng fetch built-in). Chạy được Windows + macOS + Linux.
//
//   node lam-video.mjs [--video "<đường-dẫn>"] [--mode autoclip|longedit]
//                      [--note "..."] [--lark] [--no-open] [--max-minutes 10]
//
// Cấu hình (biến môi trường, đều TÙY CHỌN):
//   VSS_PORT         cổng phần mềm (mặc định 5178)
//   VSS_STUDIO_DIR   thư mục cài Viral Short Studio (mặc định: tự dò từ vị trí file này)
//   VSS_VIDEO_IN     thư mục chứa video đầu vào (mặc định: <studio>/videos-vao)
//                    → đây là nơi TÔM/Bộ Não lưu video, hoặc bạn tự thả video vào.
//
// Cờ dòng lệnh:
//   --video     đường dẫn video cụ thể (bỏ trống = video MỚI NHẤT trong VSS_VIDEO_IN)
//   --mode      autoclip (cắt short 9:16 — mặc định) | longedit (video dài 16:9)
//   --note      "chỉ đạo đạo diễn" cho AI (vd "giữ đoạn nói về bán hàng")
//   --lark      BẬT đẩy lên Lark Base (mặc định TẮT; chỉ chạy nếu bạn đã cấu hình Lark trong app)
//   --no-open   không mở cửa sổ app (chạy ngầm)
//   --max-minutes  (longedit) tách phần nếu dài hơn (mặc định 10)
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const VIDEO_EXT = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".flv"]);

// ── Dò thư mục cài Studio: env → đi ngược lên tìm server.mjs → mặc định 3 cấp trên ──
function findStudioDir() {
  if (process.env.VSS_STUDIO_DIR) return process.env.VSS_STUDIO_DIR;
  let d = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(d, "server.mjs"))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return path.resolve(__dirname, "..", "..", "..", ".."); // fallback: gốc repo
}

const STUDIO_DIR = findStudioDir();
const PORT = process.env.VSS_PORT || 5178;
const BASE_URL = `http://localhost:${PORT}`;
const VIDEO_IN = process.env.VSS_VIDEO_IN || path.join(STUDIO_DIR, "videos-vao");

// ── Tham số dòng lệnh ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { mode: "autoclip", lark: false, open: true, note: "", video: "", url: "", maxMinutes: 10 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--video") a.video = argv[++i] || "";
    else if (k === "--url") a.url = (argv[++i] || "").trim();
    else if (k === "--mode") a.mode = (argv[++i] || "autoclip").toLowerCase();
    else if (k === "--note") a.note = argv[++i] || "";
    else if (k === "--max-minutes") a.maxMinutes = Number(argv[++i] || 10);
    else if (k === "--lark") a.lark = true;
    else if (k === "--no-open") a.open = false;
  }
  // Nếu --video thực ra là 1 link (YouTube/FB/Drive/TikTok) → coi như --url
  if (!a.url && /^https?:\/\//i.test(a.video)) { a.url = a.video; a.video = ""; }
  if (a.mode !== "longedit") a.mode = "autoclip";
  return a;
}

const log = (...x) => console.log(...x);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Chọn video mới nhất trong thư mục đầu vào nếu không chỉ định ──────────────
function newestVideoIn(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => { const p = path.join(dir, f); return { p, mtime: fs.statSync(p).mtimeMs }; })
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? files[0].p : null;
}

// ── Bảo đảm app đang chạy (health), nếu chưa thì bật server ẩn ────────────────
async function health() {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`${BASE_URL}/api/health`, { signal: ctl.signal });
    clearTimeout(to);
    return r.ok;
  } catch { return false; }
}
async function ensureUp() {
  if (await health()) { log("✅ Studio đang chạy."); return true; }
  if (!fs.existsSync(path.join(STUDIO_DIR, "server.mjs"))) {
    log(`✖ Không thấy server.mjs trong ${STUDIO_DIR}. Đặt biến VSS_STUDIO_DIR trỏ đúng thư mục cài Viral Short Studio.`);
    return false;
  }
  log("▶ Studio chưa chạy — bật server…");
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: STUDIO_DIR, detached: true, stdio: "ignore", windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 60; i++) {          // chờ tối đa ~60s (whisper/model nạp lâu lần đầu)
    await sleep(1000);
    if (await health()) { log("✅ Studio đã sẵn sàng."); return true; }
  }
  log("✖ Studio không lên sau 60s.");
  return false;
}

// ── Mở cửa sổ app (đa nền tảng) để xem tiến trình ────────────────────────────
function openApp() {
  try {
    if (IS_MAC) {
      spawn("open", [BASE_URL], { detached: true, stdio: "ignore" }).unref();
    } else if (IS_WIN) {
      const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
      const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
      if (fs.existsSync(edge)) spawn(edge, [`--app=${BASE_URL}`, "--window-size=1180,900"], { detached: true, stdio: "ignore" }).unref();
      else if (fs.existsSync(chrome)) spawn(chrome, [`--app=${BASE_URL}`], { detached: true, stdio: "ignore" }).unref();
      else spawn("cmd", ["/c", "start", "", BASE_URL], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else {
      spawn("xdg-open", [BASE_URL], { detached: true, stdio: "ignore" }).unref();
    }
    log("🖥️ Đã mở cửa sổ app.");
  } catch (e) { log("⚠ Không mở được cửa sổ app:", e.message); }
}

// ── Nộp job biên tập ─────────────────────────────────────────────────────────
async function submit(source, a, isUrl) {
  const endpoint = a.mode === "longedit" ? "/api/longedit" : "/api/autoclip";
  // Tính năng biên tập đều BẬT sẵn theo mặc định của app; ở đây chỉ bật thêm ĐẨY LARK nếu --lark.
  const common = {
    note: a.note || null,
    makeThumb: true, makeContent: true,           // thumbnail + AI viết tiêu đề/caption
    postLark: a.lark, autoPostLark: a.lark,        // autoclip đọc autoPostLark, longedit đọc postLark
  };
  // URL (YouTube/FB/Drive/TikTok): app tự tải bằng yt-dlp — chỉ autoclip nhận url.
  const body = isUrl
    ? { url: source, ...common }
    : a.mode === "longedit"
      ? { paths: [source], aspect: "16:9", maxMinutes: a.maxMinutes, ...common }
      : { path: source, ...common };

  const r = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.jobId) throw new Error(`Nộp job lỗi (${r.status}): ${JSON.stringify(j).slice(0, 300)}`);
  return j.jobId;
}

// ── Theo dõi job tới khi xong, in log mới ────────────────────────────────────
async function follow(jobId) {
  let seen = 0;
  for (;;) {
    let j;
    try { j = await fetch(`${BASE_URL}/api/job/${jobId}`).then((x) => x.json()); }
    catch { await sleep(3000); continue; }
    const lines = j.log || [];
    for (; seen < lines.length; seen++) log("   " + lines[seen]);
    if (j.status === "done") return j;
    if (j.status === "error") throw new Error(j.error || "job lỗi");
    await sleep(3000);
  }
}

// ── Tóm tắt kết quả ──────────────────────────────────────────────────────────
function summarize(mode, j, larkOn) {
  const out = [];
  if (mode === "longedit") {
    const ps = j?.result?.parts || [];
    out.push(`🎬 Biên tập xong video dài 16:9 — ${ps.length || 1} phần:`);
    ps.forEach((p, i) => out.push(`   • Phần ${i + 1}: ${p.outPath}${p.larkPosted ? " · ✅ Lark" : ""}`));
    if (!ps.length && j?.result?.outPath) out.push(`   • ${j.result.outPath}`);
  } else {
    const cs = j?.result?.clips || [];
    out.push(`✂️ Cắt xong ${cs.length} short:`);
    cs.slice(0, 12).forEach((c, i) => out.push(`   • Short ${i + 1}${c.score ? ` (${c.score}đ)` : ""}: ${c.outPath}${c.larkPosted ? " · ✅ Lark" : ""}`));
    if (cs.length > 12) out.push(`   … và ${cs.length - 12} short nữa`);
  }
  if (larkOn) out.push("📤 Đã đẩy lên Lark Base (cho các mục thành công).");
  return out.join("\n");
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  const a = parseArgs(process.argv.slice(2));

  // Nguồn = LINK (ưu tiên) hoặc FILE trong thư mục đầu vào
  let source, isUrl = false;
  if (a.url) {
    isUrl = true;
    source = a.url;
    if (a.mode === "longedit") { log("ℹ Link chỉ hỗ trợ cắt short (autoclip) — chuyển sang autoclip."); a.mode = "autoclip"; }
    log(`🔗 Link nguồn: ${source}`);
  } else {
    try { fs.mkdirSync(VIDEO_IN, { recursive: true }); } catch {}
    source = a.video || newestVideoIn(VIDEO_IN);
    if (!source) {
      log(`❌ Không tìm thấy video. Thả video vào:\n   ${VIDEO_IN}\nhoặc truyền --video "<đường-dẫn>", hoặc dán link bằng --url.`);
      process.exit(1);
    }
    if (!fs.existsSync(source)) { log("❌ Không thấy file:", source); process.exit(1); }
    log(`🎥 Video: ${source}`);
  }
  log(`⚙️  Chế độ: ${a.mode === "longedit" ? "Video dài 16:9 (longedit)" : "Cắt short tự động (autoclip)"} · Lark: ${a.lark ? "BẬT" : "tắt"}`);
  log(`📁 Studio: ${STUDIO_DIR}`);

  if (!(await ensureUp())) { log("❌ Không bật được Studio."); process.exit(1); }
  if (a.open) openApp();

  log(isUrl ? "📨 Nộp LINK vào Studio (app tự tải bằng yt-dlp) để biên tập…" : "📨 Nộp video vào Studio để biên tập…");
  const jobId = await submit(source, a, isUrl);
  log(`🔖 Job: ${jobId} — đang biên tập (theo dõi log bên dưới)…`);
  const j = await follow(jobId);

  log("\n" + summarize(a.mode, j, a.lark));
  log("\n✅ XONG.");
})().catch((e) => { console.error("❌ Lỗi:", e.message); process.exit(1); });
