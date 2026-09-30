// Viral Short Studio — web server local zero-dependency.
// Chạy: node server.mjs  → mở http://localhost:5178
import "./lib/env.mjs";   // ⚠️ PHẢI import ĐẦU TIÊN: nạp .env trước khi presets đọc cấu hình
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORK, __root, slug, run, procHooks, OUT_DIR, readJSON, writeJSON } from "./lib/util.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
import { spawn } from "node:child_process";
import { hasNvenc, probe, FFMPEG } from "./lib/ffmpeg.mjs";
import { evaluate } from "./lib/evaluate.mjs";
import { autoEdit } from "./lib/edit.mjs";
import { download, extractIdeas } from "./lib/extract.mjs";
import { askClaude, buildViralPrompt } from "./lib/ai.mjs";
import { autoClip, reclip } from "./lib/autoclip.mjs";
import { finalizeVideo } from "./lib/finalize.mjs";
import { postToLark, parseBaseUrl, probeBase, larkStatus } from "./lib/larkpost.mjs";
import { loadSettings, saveSettings } from "./lib/settings.mjs";
import { longEdit, concatVideos } from "./lib/longedit.mjs";
import { planVideoKeep, planVoiceKeep, finalKeepFromBlocks } from "./lib/reviewplan.mjs";
import { voiceShort } from "./lib/voiceshort.mjs";
import { runStandard } from "./lib/standard.mjs";
import { BRAND, DEFAULTS, PRESETS, applyBrandSettings } from "./lib/presets.mjs";
import { listFonts, FONTS_DIR } from "./lib/fonts.mjs";
import { publishOutputs } from "./lib/publish.mjs";
import { housekeep, workStats } from "./lib/housekeep.mjs";
import { resolveMusicInput } from "./lib/media-input.mjs";
import { isDriveUrl, driveDownloadFolder } from "./lib/drive.mjs";
import { interpretNote } from "./lib/director.mjs";
import { swapFrame, hasFrameLayer } from "./lib/doikhung.mjs";
import { sendLarkText } from "./lib/larknotify.mjs";
import { listKho } from "./lib/kho.mjs";
import { readiness } from "./lib/readiness.mjs";
import { listFrames, resolveFrame } from "./lib/frames.mjs";
import crypto from "node:crypto";

// 📝 "Đạo diễn": nếu body.note có lệnh → dịch thành cài đặt và GHI ĐÈ body cho các khoá
// người dùng đã ra lệnh (lệnh thắng mặc định), đồng thời đặt body.focus cho bộ chọn đoạn.
async function applyDirector(body, onLog = () => {}) {
  const note = (body.note || "").trim();
  if (!note) return;
  const d = await interpretNote(note, { onLog });
  for (const k of Object.keys(d)) { if (["focus", "explain", "musicMood"].includes(k)) continue; body[k] = d[k]; }
  body.focus = d.focus || note;
}

// Đọc bộ tuỳ chọn XUẤT BẢN dùng chung (Thumbnail + Content AI + đăng Lark) từ body.
// Áp GIỐNG NHAU cho mọi tính năng làm video → hành vi đồng nhất.
function publishOpts(body, loai) {
  return {
    makeThumb: body.makeThumb != null ? body.makeThumb : DEFAULTS.makeThumb,
    makeContent: body.makeContent != null ? body.makeContent : DEFAULTS.makeContent,
    postLark: body.postLark != null ? body.postLark : DEFAULTS.autoPostLark,
    thumbPhotoDir: body.thumbPhotoDir || BRAND.thumbPhotoDir,
    thumbName: body.thumbName || BRAND.name,
    loai: loai || "Video",
  };
}


// Tuỳ chọn dựng của từng tính năng — dùng CHUNG cho route chạy thẳng và route duyệt-rồi-render (plan/render).
function editJobOpts(body) {
  return {
    note: body.note || null, focus: body.focus || null,
    hookText: body.hookText || null,
    doCutSilence: body.doCutSilence !== false,
    removeFillers: !!body.removeFillers,
    reframe: body.reframe || "blur",
    doCaptions: body.doCaptions !== false,
    captionStyle: body.captionStyle || "karaoke",
    fontId: body.fontId || DEFAULTS.fontId,
    noText: !!body.noText,
    colorLevel: body.colorLevel || "clean",
    manual: body.manual || null,
    smooth: body.smooth || "off",
    sharpen: body.sharpen ?? DEFAULTS.sharpen,
    speed: body.speed ?? DEFAULTS.speed,
    aiCorrectText: !!body.aiCorrectText,
    punch: body.punch !== false,
    shake: body.shake !== false,
    film: body.film !== false,
    progress: body.progress !== false,
    flash: body.flash !== false,
    brollTransition: body.brollTransition || "fade",
    brollFolder: body.brollFolder || null,
    brollFill: body.brollFill || "match",
    aiBroll: !!body.aiBroll,
    aiBrollCount: body.aiBrollCount ?? 6,
    logoPath: resolveAsset(body.logoPath),
    logoPos: body.logoPos || "br",
    logoScale: body.logoScale ?? 0.16,
    logoOpacity: body.logoOpacity ?? 0.9,
    logoX: body.logoX ?? null,
    logoY: body.logoY ?? null,
    sfx: !!body.sfx,
    sfxVol: body.sfxVol ?? 0.6,
    stickers: !!body.stickers,
    stickerFolder: body.stickerFolder || null,
    stickerSize: body.stickerSize ?? 0.17,
    voiceClean: body.voiceClean || "off",
    musicPath: resolveAsset(body.musicPath),
    musicVol: body.musicVol ?? 0.18,
    normalize: body.normalize !== false,
    model: body.model || DEFAULTS.model,
    lang: body.lang || DEFAULTS.lang,
  };
}
function voiceJobOpts(body) {
  return {
    voiceVol: body.voiceVol ?? 1.0,
    musicPath: resolveAsset(body.musicPath), musicVol: body.musicVol ?? DEFAULTS.musicVolVoice,
    normalize: body.normalize !== false,
    colorLevel: body.colorLevel || DEFAULTS.colorLevel,
    smooth: body.smooth || DEFAULTS.smooth, film: body.film != null ? body.film : DEFAULTS.film,
    doCaptions: body.doCaptions !== false, captionStyle: body.captionStyle || DEFAULTS.captionStyle,
    fontId: body.fontId || DEFAULTS.fontId, noText: !!body.noText,
    hookText: body.hookText || null, progress: !!body.progress,
    brollFolder: body.brollFolder || null, brollFill: body.brollFill || DEFAULTS.brollFill,
    watermark: body.watermark !== false,
    reframe: body.reframe || "fill",
    transition: body.transition || "cut",
    model: body.model || DEFAULTS.model, lang: body.lang || DEFAULTS.lang,
  };
}
function longJobOpts(body) {
  return {
    note: body.note || null, focus: body.focus || null,
    removeFillers: !!body.removeFillers,
    doCutSilence: body.doCutSilence !== false,
    doCaptions: body.doCaptions !== false,
    captionStyle: body.captionStyle || DEFAULTS.captionStyle,
    fontId: body.fontId || DEFAULTS.fontId,
    noText: !!body.noText,
    colorLevel: body.colorLevel || DEFAULTS.colorLevel,
    manual: body.manual || null,
    smooth: body.smooth || DEFAULTS.smooth,
    sharpen: body.sharpen ?? DEFAULTS.sharpen,
    speed: body.speed ?? DEFAULTS.speed,
    aiCorrectText: !!body.aiCorrectText,
    film: body.film != null ? body.film : DEFAULTS.film,
    voiceClean: body.voiceClean || DEFAULTS.voiceClean,
    musicPath: resolveAsset(body.musicPath),
    musicVol: body.musicVol ?? DEFAULTS.musicVolLong,
    normalize: body.normalize !== false,
    watermark: body.watermark !== false,
    reframe: body.reframe || DEFAULTS.reframeLong,
    model: body.model || DEFAULTS.model,
    lang: body.lang || DEFAULTS.lang,
    transition: body.transition || "cut",
    introPath: body.introPath || null,
    outroPath: body.outroPath || null,
    aspect: body.aspect || "16:9",
    titleTop: body.titleTop || "",
    titleBottom: body.titleBottom || "",
    smartPrune: !!body.smartPrune,
    brollFolder: body.brollFolder || null,
    brollFill: body.brollFill || DEFAULTS.brollFill,
    makeThumb: false, // thumbnail do publish.mjs lo (một đường thống nhất mọi tính năng)
    maxMinutes: body.maxMinutes ?? 10,
  };
}
// Xuất bản TỪNG phần video dài (thumbnail + caption + Lark) — dùng chung /api/longedit và /api/longedit/render.
async function publishLongParts(r, body, base, onLog) {
  const multi = (r.parts || []).length > 1;
  const items = (r.parts || []).map((pt, i) => ({
    outPath: pt.outPath, thumbPath: pt.thumbPath || null,
    title: ((body.thumbTitle || body.titleTop || base).trim()) + (multi ? ` (Phần ${i + 1})` : ""),
    transcriptText: r.transcriptText,
  }));
  const pub = await publishOutputs(items, { ...publishOpts(body, "Video"), onLog });
  const parts = pub.map((it, i) => ({ ...r.parts[i], ...it }));
  return { ...r, parts };
}

const PORT = process.env.VSS_PORT || 5178;
const PUBLIC = path.join(__root, "public");
const OUT = OUT_DIR;
const UP = path.join(WORK, "uploads");
const PROJECTS = path.join(__root, "projects");   // dự án lưu ra FILE ổ cứng (đặt tên, mở lại, chuyển máy)
for (const d of [OUT, UP, PROJECTS]) fs.mkdirSync(d, { recursive: true });

// 🩹 CHỮA LÀNH đường dẫn asset (nhạc/logo/CTA) do giao diện nhớ path CŨ (vd khi dời phần mềm
// từ ổ H: sang ổ Y:): nếu file lưu không còn tồn tại thì tìm lại theo TÊN FILE trong uploads
// hiện tại. Không có thì trả nguyên path để lỗi vẫn báo rõ.
function resolveAsset(p) {
  if (!p) return null;
  if (fs.existsSync(p)) return p;
  const cand = path.join(UP, path.basename(p));
  if (fs.existsSync(cand)) return cand;
  return p;
}

// 🔗 NGUỒN = FILE hay LINK. Mọi ô "video nguồn" đều nhận cả hai:
//   • đường dẫn trên máy   → dùng như cũ
//   • link Google Drive    → tải bằng lib/drive.mjs (qua được trang xác nhận file lớn)
//   • link YouTube/FB/TikTok → tải bằng yt-dlp
// Tải xong nằm ở work/tai-ve/ và có nhớ đệm: cùng link thì lần sau không tải lại.
const isHttpUrl = (s) => /^https?:\/\//i.test(String(s || "").trim());

async function resolveSource(input, { onLog = () => {}, id = "dl" } = {}) {
  const s = String(input || "").trim();
  if (!s) return null;
  if (!isHttpUrl(s)) return resolveAsset(s);
  onLog(`⬇️ Nguồn là LINK, tải về trước: ${s}`);
  const f = await download(s, { onLog, id });
  if (!f || !fs.existsSync(f)) throw new Error("không tải được video từ link: " + s);
  return f;
}

// Danh sách nguồn (video dài ghép nhiều phần, clip bối cảnh…): tải tuần tự, giữ đúng thứ tự.
async function resolveSources(list, { onLog = () => {}, id = "dl" } = {}) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    out.push(await resolveSource(list[i], { onLog, id: `${id}-${i + 1}` }));
  }
  return out;
}

// Kiểm tra trước khi tạo job: link thì cho qua (tải trong job), file thì phải có thật.
function missingLocal(list) {
  return list.find((f) => !isHttpUrl(f) && !fs.existsSync(resolveAsset(f)));
}

// Nguồn dạng THƯ MỤC (chạy hàng loạt): thư mục trên máy, hoặc link THƯ MỤC Google Drive
// (cần VSS_DRIVE_API_KEY / VSS_DRIVE_OAUTH — xem lib/drive.mjs).
async function resolveFolderSource(input, { onLog = () => {} } = {}) {
  const s = String(input || "").trim();
  if (!isHttpUrl(s)) return s;
  if (!isDriveUrl(s)) throw new Error("Chỉ nhận link THƯ MỤC Google Drive ở ô thư mục: " + s);
  onLog("⬇️ Thư mục nguồn là link Google Drive, tải về trước…");
  return await driveDownloadFolder(s, { onLog, kinds: "video" });
}

// Dựng bộ opts cho autoClip từ body (dùng CHUNG cho 3 route: /autoclip, /autoclip/plan, /autoclip/render).
// Không lặp ~40 dòng ở mỗi route → 3 route luôn ĐỒNG NHẤT, không lệch mặc định.
function acOpts(body, jobId, extra = {}) {
  return {
    id: jobId,
    note: body.note || null, focus: body.focus || null,
    model: body.model || DEFAULTS.model,
    lang: body.lang || DEFAULTS.lang,
    minScore: body.minScore ?? DEFAULTS.minScore,
    maxClips: body.maxClips ?? DEFAULTS.maxClips,
    burnHook: !!body.burnHook,
    reframe: body.reframe || DEFAULTS.reframeShort,
    captionStyle: body.captionStyle || DEFAULTS.captionStyle,
    fontId: body.fontId || DEFAULTS.fontId,
    noText: !!body.noText,
    colorLevel: body.colorLevel || DEFAULTS.colorLevel,
    punch: body.punch != null ? body.punch : DEFAULTS.punch,
    shake: body.shake != null ? body.shake : DEFAULTS.shake,
    film: body.film != null ? body.film : DEFAULTS.film,
    progress: body.progress != null ? body.progress : DEFAULTS.progress,
    flash: body.flash != null ? body.flash : DEFAULTS.flash,
    normalize: body.normalize !== false,
    scoreClips: body.scoreClips != null ? body.scoreClips : DEFAULTS.scoreClips,
    musicPath: resolveAsset(body.musicPath),
    brollFolder: body.brollFolder || null,
    brollFill: body.brollFill || "match",
    manual: body.manual || null,
    smooth: body.smooth || "off",
    voiceClean: body.voiceClean || "off",
    brollTransition: body.brollTransition || "fade",
    aiBroll: !!body.aiBroll,
    aiBrollCount: body.aiBrollCount ?? 6,
    logoPath: resolveAsset(body.logoPath),
    logoPos: body.logoPos || "br",
    logoScale: body.logoScale ?? 0.16,
    logoOpacity: body.logoOpacity ?? 0.9,
    logoX: body.logoX ?? null,
    logoY: body.logoY ?? null,
    sfx: !!body.sfx,
    sfxVol: body.sfxVol ?? 0.6,
    stickers: !!body.stickers,
    stickerFolder: body.stickerFolder || null,
    aiCorrectText: !!body.aiCorrectText,
    sharpen: body.sharpen ?? DEFAULTS.sharpen,
    speed: body.speed ?? DEFAULTS.speed,
    makeThumb: body.makeThumb !== false,
    thumbStyle: body.thumbStyle || "frame",
    thumbPhotoDir: body.thumbPhotoDir || BRAND.thumbPhotoDir,
    thumbName: body.thumbName || BRAND.name,
    musicVol: body.musicVol ?? DEFAULTS.musicVolShort,
    ctaPath: resolveAsset(body.ctaPath),
    // 🆕 Điều khiển độ dài & "đủ ý" (giao diện gửi lên; thiếu thì 0 = auto).
    clipMinSec: body.clipMinSec ?? 0,
    clipMaxSec: body.clipMaxSec ?? 0,
    preferComplete: !!body.preferComplete,
    ...extra,
  };
}

// Đăng Lark các short đã dựng (chỉ khi autoPostLark bật). Dùng chung cho /autoclip và /autoclip/render.
async function maybeAutoPostLark(result, body, onLog) {
  if (!(body.autoPostLark != null ? body.autoPostLark : DEFAULTS.autoPostLark)) return;
  const ok = (result.clips || []).filter((c) => !c.error && c.outPath);
  onLog(`\n📤 Tự đăng ${ok.length} short lên Lark Base ...`);
  let posted = 0;
  for (let i = 0; i < ok.length; i++) {
    const c = ok[i];
    try {
      onLog(`  [${i + 1}/${ok.length}] đăng: ${c.title || path.basename(c.outPath)}`);
      const pr = await postToLark({
        videoPath: c.outPath, caption: c.caption || c.title || "",
        thumbPath: c.thumbPath || null, onLog: (l) => onLog("    " + l),
      });
      c.larkRecordId = pr.recordId; c.larkPosted = true; posted++;
    } catch (e) { onLog(`  ⚠ đăng lỗi short này: ${e.message}`); c.larkError = e.message; }
  }
  onLog(`✅ Đã đăng ${posted}/${ok.length} short lên Lark Base.`);
}

// ---- Kho việc (job): LƯU RA ĐĨA · HÀNG ĐỢI 1 việc nặng · HUỶ được · TIẾN ĐỘ % ----
// Việc lưu ở work/jobs/<id>.json → phần mềm khởi động lại vẫn biết việc nào dở, bấm "Chạy lại".
const JOBS_DIR = path.join(WORK, "jobs");
const LOG_DIR = path.join(__root, "logs");
const PREFS_FILE = path.join(__root, "prefs.json");
for (const d of [JOBS_DIR, LOG_DIR]) fs.mkdirSync(d, { recursive: true });
const jobs = new Map();
let jobSeq = 0;
const reqCtx = new AsyncLocalStorage();   // route + body của request (để "Chạy lại")
const jobCtx = new AsyncLocalStorage();   // việc đang chạy (để HUỶ giết đúng tiến trình con)
const LIGHT = new Set(["lark"]);       // việc nhẹ: chạy ngay, không xếp hàng
const queue = [];
let active = null;

procHooks.onSpawn = (child) => {
  const job = jobCtx.getStore();
  if (!job) return;
  job.procs.add(child);
  child.on("close", () => job.procs.delete(child));
  if (job.cancelled) killTree(child.pid);
};
function killTree(pid) {
  try {
    if (process.platform === "win32") spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
    else process.kill(pid, "SIGKILL");
  } catch { /* đã chết */ }
}
function jobView(job, full = false) {
  const v = { id: job.id, kind: job.kind, status: job.status, result: job.result, error: job.error,
    createdAt: job.createdAt, runAt: job.runAt || null, doneAt: job.doneAt || null, route: job.route };
  const p = job.progress;
  if (p) {
    v.progress = { pct: Math.round(p.pct || 0), label: p.label || "" };
    if (job.status === "running" && job.runAt && p.pct >= 3 && p.pct < 100) {
      const el = (Date.now() - job.runAt) / 1000;
      v.progress.etaSec = Math.round(el * (100 - p.pct) / p.pct);
    }
  }
  if (job.status === "queued") v.queuePos = queue.indexOf(job) + 1;
  if (full) v.log = job.log.slice(-200);
  return v;
}
function saveJob(job) {
  const { procs, fn, ...rest } = job;
  try { fs.writeFileSync(path.join(JOBS_DIR, job.id + ".json"), JSON.stringify({ ...rest, log: job.log.slice(-400) })); } catch { /* bỏ */ }
}
const saveTimers = new Map();
function saveLater(job) {
  if (saveTimers.has(job.id)) return;
  saveTimers.set(job.id, setTimeout(() => { saveTimers.delete(job.id); saveJob(job); }, 2000));
}
function newJob(kind) {
  const id = `${kind}-${Date.now()}-${++jobSeq}`;
  const rc = reqCtx.getStore();
  const job = { id, kind, status: "queued", log: [], result: null, error: null, startedAt: Date.now(), createdAt: Date.now(),
    route: rc?.route || null, body: rc?.body ?? null, progress: null, procs: new Set(), cancelled: false };
  jobs.set(id, job);
  saveJob(job);
  return job;
}

// 📈 Tiến độ % đọc từ chính dòng log (không phải sửa từng tính năng):
// "Bước n/t" → khung lớn · whisper "[ 12.3s]" / "phần i/n" / "[i/n]" / ffmpeg "time=" → phần nhỏ trong bước.
const hms = (s) => { const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0; };
function trackProgress(job, line) {
  const P = job.progress || (job.progress = { pct: 0, label: "", base: 0, span: 1, sub: 0, loop: null, ff: 0, ffDur: 0, wDur: 0, wantDur: false });
  let m;
  const step = (base, span, label) => { P.base = base; P.span = span; P.sub = 0; P.loop = null; P.ff = 0; P.label = label; };
  if ((m = /Bước (\d)\/(\d)/.exec(line))) step((m[1] - 1) / m[2], 1 / m[2], line.replace(/^[\s→]+/, "").slice(0, 90));
  else if ((m = /→ Bước (\d)[AB]?:/.exec(line))) step((m[1] - 1) / 5, 1 / 5, line.replace(/^[\s→]+/, "").slice(0, 90));
  if ((m = /\[whisper\] thoi luong: ([\d.]+)/.exec(line))) { P.wDur = +m[1]; if (!P.label) P.label = "Bóc âm…"; }
  else if (P.wDur && (m = /^\s*\[\s*([\d.]+)s\]/.exec(line))) P.sub = Math.min(1, +m[1] / P.wDur);
  else if ((m = /phân tích phần (\d+)\/(\d+)/.exec(line))) P.sub = (m[1] - 1) / m[2];
  else if ((m = /^\s*\[(\d+)\/(\d+)\]\s/.exec(line))) { P.loop = { i: +m[1], n: +m[2] }; P.ff = 0; P.sub = (P.loop.i - 1) / P.loop.n; }
  else if (/Input #0/.test(line)) P.wantDur = true;
  else if (P.wantDur && (m = /Duration: (\d+:\d+:[\d.]+)/.exec(line))) { P.ffDur = hms(m[1]); P.wantDur = false; }
  else if (P.ffDur && (m = /time=(\d+:\d+:[\d.]+)/.exec(line))) {
    P.ff = Math.min(1, hms(m[1]) / P.ffDur);
    P.sub = P.loop ? (P.loop.i - 1 + P.ff) / P.loop.n : Math.max(P.sub, P.ff);
  }
  P.pct = Math.min(99, Math.max(P.pct, (P.base + P.span * P.sub) * 100));
}
function jlog(job, line) {
  job.log.push(line);
  if (job.log.length > 2000) job.log.shift();
  try { trackProgress(job, line); } catch { /* bỏ */ }
  saveLater(job);
}
function logError(job) {
  try {
    const f = path.join(LOG_DIR, `loi-${new Date().toISOString().slice(0, 7)}.jsonl`);
    fs.appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), id: job.id, kind: job.kind, route: job.route, error: String(job.error || "").slice(0, 500) }) + "\n");
  } catch { /* bỏ */ }
}
function readPrefs() { try { return JSON.parse(fs.readFileSync(PREFS_FILE, "utf-8")); } catch { return {}; } }
async function notifyDone(job) {
  if (LIGHT.has(job.kind) || !readPrefs().notifyLark) return;
  if (!["done", "error"].includes(job.status)) return;
  const mins = Math.max(1, Math.round(((job.doneAt || Date.now()) - (job.runAt || job.createdAt)) / 60000));
  const text = job.status === "done"
    ? `🎬 Viral Short Studio: xong việc "${job.kind}" sau ${mins} phút. Mở phần mềm để xem.`
    : `⚠ Viral Short Studio: việc "${job.kind}" lỗi sau ${mins} phút: ${String(job.error || "").slice(0, 200)}`;
  try { await sendLarkText(text); } catch (e) { console.log("báo Lark lỗi:", e.message); }
}
async function runJob(job, fn) {
  job.fn = fn;
  if (LIGHT.has(job.kind)) return execJob(job);
  queue.push(job);
  pump();
}
function pump() {
  if (active || !queue.length) return;
  const job = queue.shift();
  active = job;
  execJob(job).finally(() => { active = null; pump(); });
}
async function execJob(job) {
  if (job.cancelled) { job.status = "cancelled"; job.error = "Anh đã huỷ việc này."; saveJob(job); return; }
  job.status = "running"; job.runAt = Date.now(); saveJob(job);
  await jobCtx.run(job, async () => {
    try {
      job.result = await job.fn((l) => jlog(job, l));
      job.status = job.cancelled ? "cancelled" : "done";
      if (job.progress) job.progress.pct = 100;
    } catch (e) {
      if (job.cancelled) { job.status = "cancelled"; job.error = "Anh đã huỷ việc này."; jlog(job, "⛔ Đã huỷ theo yêu cầu."); }
      else { job.error = e.message || String(e); job.status = "error"; jlog(job, "❌ LỖI: " + job.error); logError(job); }
    }
  });
  job.doneAt = Date.now();
  delete job.fn;
  saveJob(job);
  notifyDone(job);
}
function cancelJob(job) {
  job.cancelled = true;
  if (job.status === "queued") {
    const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1);
    job.status = "cancelled"; job.error = "Anh đã huỷ việc này."; job.doneAt = Date.now(); saveJob(job);
    return;
  }
  for (const c of job.procs) killTree(c.pid);
}
// Khởi động: nạp lại việc 7 ngày gần nhất; việc đang chạy/chờ lúc tắt → "bị ngắt", cho Chạy lại.
(function loadJobs() {
  try {
    const cut = Date.now() - 7 * 86400e3;
    for (const f of fs.readdirSync(JOBS_DIR)) {
      const fp = path.join(JOBS_DIR, f);
      let j; try { j = JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { continue; }
      if ((j.createdAt || j.startedAt || 0) < cut) { try { fs.unlinkSync(fp); } catch { /* bỏ */ } continue; }
      j.procs = new Set();
      if (j.status === "running" || j.status === "queued") {
        j.status = "interrupted";
        j.error = "Phần mềm đã khởi động lại khi việc này đang chạy hoặc đang chờ. Bấm “Chạy lại”.";
        saveJob(j);
      }
      jobs.set(j.id, j);
    }
  } catch { /* chưa có thư mục */ }
})();

// ---- Helpers HTTP ----
function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
async function readJSONBody(req) {
  const b = await readBody(req);
  let obj = {};
  try { obj = JSON.parse(b.toString("utf-8") || "{}"); } catch { obj = {}; }
  const st = reqCtx.getStore(); if (st) st.body = obj;
  return obj;
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg",
  ".png": "image/png", ".json": "application/json", ".srt": "text/plain",
  ".mov": "video/quicktime", ".mkv": "video/x-matroska", ".webm": "video/webm",
  ".m4v": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".ass": "text/plain; charset=utf-8",
};

// 🔒 AN TOÀN: mặc định CHỈ nghe trên chính máy (127.0.0.1). Muốn máy khác trong mạng dùng thì đặt
// VSS_HOST=0.0.0.0 VÀ VSS_PASS=<mật khẩu> (thiếu mật khẩu thì không mở ra mạng).
const PASS = process.env.VSS_PASS || "";
const HOST = (process.env.VSS_HOST && process.env.VSS_HOST !== "127.0.0.1" && PASS) ? process.env.VSS_HOST : "127.0.0.1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
function allowedRequest(req, u) {
  const host = String(req.headers.host || "").replace(/:\d+$/, "").toLowerCase();
  if (HOST === "127.0.0.1") return LOCAL_HOSTS.has(host);          // chặn cả trò đổi tên miền (DNS rebinding)
  const ck = /(?:^|;\s*)vss=([^;]+)/.exec(req.headers.cookie || "");
  return (ck && decodeURIComponent(ck[1]) === PASS) || u.searchParams.get("k") === PASS;
}
// /api/file chỉ trả tệp MEDIA; tệp chữ (.txt/.json/.ass/.srt) chỉ trong thư mục phần mềm; cấm .secrets/.env.
const MEDIA_EXT = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".opus", ".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const TEXT_EXT = new Set([".txt", ".json", ".ass", ".srt"]);
function insideApp(r) { const l = r.toLowerCase(); return [WORK, __root].some((d) => l.startsWith(path.resolve(d).toLowerCase() + path.sep)); }
function fileAllowed(f) {
  const r = path.resolve(String(f));
  if (/[\\/]\.secrets([\\/]|$)/i.test(r) || /\.env(\.|$)/i.test(path.basename(r))) return false;
  const ext = path.extname(r).toLowerCase();
  if (MEDIA_EXT.has(ext)) return true;
  return TEXT_EXT.has(ext) && insideApp(r);
}

const server = http.createServer((req, res) => reqCtx.run({ route: null, body: null }, () => handleRequest(req, res)));
async function handleRequest(req, res) {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;
  if (!allowedRequest(req, u)) { res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Chỉ dùng được trên máy chạy phần mềm."); }
  if (HOST !== "127.0.0.1" && u.searchParams.get("k") === PASS) res.setHeader("Set-Cookie", `vss=${encodeURIComponent(PASS)}; HttpOnly; SameSite=Strict; Path=/`);
  reqCtx.getStore().route = p;

  try {
    // ---- Tĩnh ----
    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      return send(res, 200, fs.readFileSync(path.join(PUBLIC, "index.html")), MIME[".html"]);
    }
    // Logo NHẬN DIỆN PHẦN MỀM — chỉ dùng cho GIAO DIỆN (header + favicon), KHÔNG đóng dấu lên video.
    //   assets/logo-app.png  = logo ngang trên đầu phần mềm
    //   assets/logo-mark.png = biểu tượng vuông → favicon tab trình duyệt
    // (Watermark trên video là chuyện khác: xem assets/logo-mentor.png trong lib/brand.mjs.)
    if (req.method === "GET" && (p === "/logo-app.png" || p === "/logo-mark.png")) {
      const f = path.join(__root, "assets", p.slice(1));
      if (fs.existsSync(f)) return send(res, 200, fs.readFileSync(f), MIME[".png"]);
      return send(res, 404, { error: "chưa có " + p.slice(1) + " trong assets" });
    }

    // Tệp giao diện: phục vụ MỌI tệp trong public/ (chặn thoát ra ngoài bằng ../).
    if (req.method === "GET" && !p.startsWith("/api/")) {
      let rel = ""; try { rel = decodeURIComponent(p).replace(/^\/+/, ""); } catch { rel = ""; }
      const f = path.resolve(PUBLIC, rel);
      if (rel && f.startsWith(PUBLIC + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        return send(res, 200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] || "application/octet-stream");
      }
    }

    // ---- Kiểm tra môi trường ----
    if (p === "/api/health") {
      const gpu = await hasNvenc().catch(() => false);
      // Cảnh báo sớm nếu thư mục ảnh thumbnail thương hiệu không truy cập được (vd ổ Y: chưa gắn).
      let thumbDirExists = false;
      try { thumbDirExists = !!BRAND.thumbPhotoDir && fs.existsSync(BRAND.thumbPhotoDir); } catch { thumbDirExists = false; }
      // Dung lượng TRỐNG của ổ chứa work/ — để UI cảnh báo "ổ gần đầy" (kho video phình).
      let freeGB = null;
      try { const st = fs.statfsSync(OUT); freeGB = +((st.bavail * st.bsize) / 1e9).toFixed(1); } catch { freeGB = null; }
      return send(res, 200, { ok: true, gpu, port: PORT, outDir: OUT, thumbDirExists, freeGB });
    }

    // ---- Cấu hình cho giao diện (NGUỒN SỰ THẬT DUY NHẤT: presets.mjs) ----
    // Giao diện nạp cái này khi mở → điền mặc định + tên thương hiệu + thư mục ảnh
    // đúng MỘT chỗ, không hardcode value trong index.html nữa.
    if (p === "/api/config") {
      const presetList = Object.entries(PRESETS).map(([key, v]) => ({ key, label: v.label, hint: v.hint }));
      return send(res, 200, { brand: BRAND, defaults: DEFAULTS, presets: presetList, fonts: listFonts(), lark: larkStatus() });
    }
    // ---- ⚙️ CẤU HÌNH (thương hiệu + Lark Base) — lưu settings.local.json, áp NGAY ----
    if (req.method === "GET" && p === "/api/settings") {
      const s = loadSettings();
      return send(res, 200, { lark: s.lark || {}, larkStatus: larkStatus(), notify: s.notify || {},
        brand: { name: BRAND.name, role: BRAND.role, niche: BRAND.niche, color: BRAND.color, thumbPhotoDir: BRAND.thumbPhotoDir, hashtags: BRAND.hashtags } });
    }
    if (req.method === "POST" && p === "/api/settings") {
      const body = await readJSONBody(req);
      const patch = {};
      if (body.lark && typeof body.lark === "object") patch.lark = body.lark;
      if (body.brand && typeof body.brand === "object") patch.brand = body.brand;
      if (body.notify && typeof body.notify === "object") patch.notify = { chatId: String(body.notify.chatId || "").trim() };
      saveSettings(patch);
      if (patch.brand) applyBrandSettings(patch.brand);
      return send(res, 200, { ok: true, larkStatus: larkStatus(), brand: BRAND });
    }
    if (req.method === "POST" && p === "/api/lark/probe") {
      const body = await readJSONBody(req);
      const parsed = parseBaseUrl(body.baseLink || "");
      const baseToken = (body.baseToken || parsed.baseToken || "").trim();
      const tableId = (body.tableId || parsed.tableId || "").trim();
      if (!baseToken) return send(res, 400, { error: "Chưa nhận ra mã Base từ link. Link đúng có dạng .../base/XXXXXXXX?table=tblYYYY" });
      try { return send(res, 200, { ok: true, ...(await probeBase({ baseToken, tableId, onLog: () => {} })) }); }
      catch (e) { return send(res, 200, { ok: false, error: e.message, baseToken, tableId }); }
    }

    // ---- 🔤 KHO FONT: bỏ .otf/.ttf vào assets/fonts → hiện ngay ở đây (mở lại phần mềm để quét lại) ----
    if (p === "/api/fonts") {
      return send(res, 200, { fonts: listFonts(), dir: FONTS_DIR, default: DEFAULTS.fontId });
    }

    // ---- Duyệt thư mục/ổ đĩa trên MÁY (cho nút "📁 Chọn" — app local nên đọc được) ----
    if (req.method === "GET" && p === "/api/browse") {
      const qp = u.searchParams.get("path") || "";
      const mode = u.searchParams.get("mode") || "dir"; // dir | file
      const ext = (u.searchParams.get("ext") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      try {
        // Gốc → liệt kê các ổ đĩa Windows (C: … Z:)
        if (!qp || qp === "root") {
          const drives = [];
          for (let i = 67; i <= 90; i++) {
            const d = String.fromCharCode(i) + ":\\";
            try { if (fs.existsSync(d)) drives.push(d); } catch { /* bỏ */ }
          }
          return send(res, 200, { cwd: "root", parent: null, drives, dirs: [], files: [] });
        }
        const st = fs.statSync(qp);
        const dir = st.isDirectory() ? qp : path.dirname(qp);
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const dirs = [], files = [];
        for (const en of entries) {
          try {
            if (en.isDirectory()) dirs.push(en.name);
            else if (mode === "file") {
              const x = path.extname(en.name).slice(1).toLowerCase();
              if (!ext.length || ext.includes(x)) files.push(en.name);
            }
          } catch { /* bỏ mục lỗi */ }
        }
        dirs.sort((a, b) => a.localeCompare(b, "vi"));
        files.sort((a, b) => a.localeCompare(b, "vi"));
        let parent = path.dirname(dir);
        if (parent === dir) parent = "root"; // đang ở gốc ổ đĩa → về danh sách ổ
        return send(res, 200, { cwd: dir, parent, drives: [], dirs, files, sep: path.sep });
      } catch (e) {
        return send(res, 400, { error: "Không mở được: " + e.message });
      }
    }

    // ---- DỰ ÁN: lưu/mở/liệt kê/xoá ra FILE ổ cứng (.vss.json) ----
    // Lưu THIẾT LẬP (mọi lựa chọn của 1 tab) thành file, đặt tên, mở lại, copy sang máy khác.
    if (req.method === "POST" && p === "/api/project/save") {
      const b = await readJSONBody(req);
      const name = String(b.name || "").trim();
      if (!name) return send(res, 400, { error: "thiếu tên dự án" });
      const dir = (b.dir && fs.existsSync(b.dir)) ? b.dir : PROJECTS;   // cho phép lưu vào thư mục tuỳ chọn
      const file = path.join(dir, `${slug(name)}.vss.json`);
      const payload = { name, mode: b.mode || "ac", data: b.data || {}, savedAt: new Date().toISOString(), version: 1 };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
      return send(res, 200, { ok: true, path: file, name });
    }
    if (req.method === "GET" && p === "/api/project/list") {
      const dir = (u.searchParams.get("dir") && fs.existsSync(u.searchParams.get("dir"))) ? u.searchParams.get("dir") : PROJECTS;
      let items = [];
      try {
        items = fs.readdirSync(dir).filter((f) => f.endsWith(".vss.json")).map((f) => {
          const fp = path.join(dir, f);
          let meta = {}; try { meta = JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { /* bỏ */ }
          const st = fs.statSync(fp);
          return { file: f, path: fp, name: meta.name || f.replace(/\.vss\.json$/, ""), mode: meta.mode || "?", savedAt: meta.savedAt || st.mtime.toISOString() };
        }).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
      } catch { /* bỏ */ }
      return send(res, 200, { dir, items });
    }
    if (req.method === "GET" && p === "/api/project/get") {
      const fp = u.searchParams.get("path");
      if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "không thấy file dự án" });
      try { return send(res, 200, JSON.parse(fs.readFileSync(fp, "utf-8"))); }
      catch (e) { return send(res, 400, { error: "file dự án hỏng: " + e.message }); }
    }
    if (req.method === "POST" && p === "/api/project/delete") {
      const b = await readJSONBody(req);
      if (!b.path || !fs.existsSync(b.path)) return send(res, 404, { error: "không thấy file" });
      if (!/\.vss\.json$/i.test(b.path)) return send(res, 403, { error: "chỉ xoá được file dự án .vss.json" });
      try { fs.unlinkSync(b.path); return send(res, 200, { ok: true }); }
      catch (e) { return send(res, 400, { error: e.message }); }
    }

    // ---- Upload file (raw body + header X-Filename) ----
    // Chống NẠP TRÙNG: băm nội dung; file y hệt đã có → trỏ vào bản cũ, không ghi bản thứ 2.
    if (req.method === "POST" && p === "/api/upload") {
      const name = decodeURIComponent(req.headers["x-filename"] || "video.mp4");
      const buf = await readBody(req);
      const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
      const idxFile = path.join(UP, ".index.json");
      let idx = {};
      try { idx = JSON.parse(fs.readFileSync(idxFile, "utf-8")); } catch { idx = {}; }
      if (idx[hash] && fs.existsSync(idx[hash])) {
        // chạm lại mtime để reset hạn ân 3 ngày (anh vừa dùng lại video này).
        try { const t = new Date(); fs.utimesSync(idx[hash], t, t); } catch { /* bỏ */ }
        return send(res, 200, { ok: true, path: idx[hash], name, dedup: true });
      }
      const ext = path.extname(name) || ".mp4";
      const safe = `${Date.now()}-${slug(name.replace(/\.[^.]+$/, ""))}${ext}`;
      const dest = path.join(UP, safe);
      fs.writeFileSync(dest, buf);
      idx[hash] = dest;
      try { fs.writeFileSync(idxFile, JSON.stringify(idx)); } catch { /* bỏ */ }
      return send(res, 200, { ok: true, path: dest, name });
    }

    // ---- Kho: xem dung lượng / dọn kho theo yêu cầu ----
    if (p === "/api/housekeep") {
      if (req.method === "GET") return send(res, 200, { stats: workStats() });
      // POST → dọn thật (hoặc ?dry=1 để xem trước). ttl ngày lấy từ query, mặc định 3.
      const dry = u.searchParams.get("dry") === "1";
      const ttlDays = Number(u.searchParams.get("ttl")) || 3;
      const report = housekeep({ ttlDays, dry, onLog: (l) => console.log(l) });
      return send(res, 200, { ok: true, report });
    }

    // ---- Phục vụ / tải file (preview, download) ----
    if (req.method === "GET" && p === "/api/file") {
      const f = u.searchParams.get("path");
      if (!f || !fs.existsSync(f)) return send(res, 404, { error: "không thấy file" });
      if (!fileAllowed(f)) return send(res, 403, { error: "Không cho phép đọc loại tệp này." });
      const stat = fs.statSync(f);
      const range = req.headers.range;
      const type = MIME[path.extname(f).toLowerCase()] || "application/octet-stream";
      // dl=1 → ép TẢI VỀ (không phát inline / không chuyển trang). Tên file UTF-8.
      const dispo = u.searchParams.get("dl")
        ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(f))}` }
        : {};
      if (range) {
        const [s, e] = range.replace("bytes=", "").split("-");
        const start = parseInt(s, 10);
        const end = e ? parseInt(e, 10) : stat.size - 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Content-Type": type, ...dispo,
        });
        return fs.createReadStream(f, { start, end }).pipe(res);
      }
      res.writeHead(200, { "Content-Length": stat.size, "Content-Type": type, ...dispo });
      return fs.createReadStream(f).pipe(res);
    }

    // ---- 🎞️ DẢI KHUNG HÌNH + SÓNG ÂM cho TRỤC DUYỆT kiểu CapCut ----
    // Trả về sprite JPEG (n khung hình xếp 1 hàng ngang) + ảnh waveform của video nguồn.
    // Lần đầu tạo hơi lâu (tuỳ độ dài video) → cache theo (path, mtime, size) trong work/cache.
    if (req.method === "GET" && p === "/api/filmstrip") {
      const f = u.searchParams.get("path");
      if (!f || !fs.existsSync(f)) return send(res, 404, { error: "không thấy file" });
      const st = fs.statSync(f);
      const key = crypto.createHash("md5").update(f + "|" + st.mtimeMs + "|" + st.size).digest("hex").slice(0, 16);
      const cacheDir = path.join(WORK, "cache");
      fs.mkdirSync(cacheDir, { recursive: true });
      const metaFile = path.join(cacheDir, `strip-${key}.json`);
      const cached = readJSON(metaFile);
      if (cached && (!cached.strip || fs.existsSync(path.join(cacheDir, `strip-${key}.jpg`)))) return send(res, 200, cached);
      const meta = await probe(f);
      const dur = Math.max(1, meta.duration || 1);
      // ~1 khung / 5s, kẹp 30..120 khung. skip_frame nokey = chỉ giải mã keyframe → nhanh gấp nhiều lần.
      const n = Math.max(30, Math.min(120, Math.round(dur / 5)));
      let stripFile = path.join(cacheDir, `strip-${key}.jpg`);
      // File CHỈ CÓ TIẾNG (giọng đọc voiceshort) → không có khung hình, chỉ trả sóng âm.
      // Cách nhanh: chỉ giải mã khung khoá. Video ngắn/ít khung khoá không đủ lấp dải → giải mã đầy đủ.
      const stripArgs = (fast) => ["-hide_banner", "-y", ...(fast ? ["-skip_frame", "nokey"] : []), "-i", f,
        "-vf", `fps=${(n / dur).toFixed(6)},scale=160:90:force_original_aspect_ratio=increase,crop=160:90,tile=${n}x1`,
        "-frames:v", "1", "-q:v", "5", stripFile];
      for (const fast of [true, false]) {
        try { fs.rmSync(stripFile, { force: true }); await run(FFMPEG, stripArgs(fast)); } catch { /* thử cách sau */ }
        if (fs.existsSync(stripFile) && fs.statSync(stripFile).size > 0) break;
      }
      if (!fs.existsSync(stripFile)) stripFile = null;
      let waveFile = null;
      if (meta.hasAudio) {
        waveFile = path.join(cacheDir, `wave-${key}.png`);
        try {
          await run(FFMPEG, [
            "-hide_banner", "-y", "-i", f,
            "-filter_complex", "aformat=channel_layouts=mono,compand,showwavespic=s=2400x120:colors=#2ea99a",
            "-frames:v", "1", waveFile,
          ]);
        } catch { waveFile = null; }
        if (waveFile && !fs.existsSync(waveFile)) waveFile = null;
      }
      const out = {
        ok: true, duration: dur, n, thumbW: 160, thumbH: 90,
        strip: stripFile ? "/api/file?path=" + encodeURIComponent(stripFile) : null,
        wave: waveFile ? "/api/file?path=" + encodeURIComponent(waveFile) : null,
      };
      writeJSON(metaFile, out);
      return send(res, 200, out);
    }

    // ---- Việc: xem · danh sách · huỷ · chạy lại ----
    if (req.method === "GET" && p === "/api/jobs") {
      const list = [...jobs.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 40)
        .map((j) => { const v = jobView(j); delete v.result; return v; });
      return send(res, 200, { items: list, activeId: active ? active.id : null, queued: queue.length });
    }
    if (p.startsWith("/api/job/")) {
      const [, , , id, act] = p.split("/");
      const job = jobs.get(id);
      if (!job) return send(res, 404, { status: "missing", error: "Không tìm thấy việc này (phần mềm đã khởi động lại hoặc việc quá 7 ngày)." });
      if (req.method === "GET" && !act) return send(res, 200, jobView(job, true));
      if (req.method === "POST" && act === "cancel") { cancelJob(job); return send(res, 200, { ok: true }); }
      if (req.method === "POST" && act === "rerun") {
        if (!job.route || !job.route.startsWith("/api/")) return send(res, 400, { error: "Việc này không chạy lại được." });
        const r = await fetch(`http://127.0.0.1:${PORT}${job.route}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `vss=${encodeURIComponent(PASS)}` }, body: JSON.stringify(job.body || {}) });
        return send(res, r.status, await r.json());
      }
    }
    // ---- 🔔 Tuỳ chọn: báo Lark khi xong ----
    if (p === "/api/prefs") {
      if (req.method === "POST") { const b = await readJSONBody(req); const cur = readPrefs(); const next = { ...cur, notifyLark: !!b.notifyLark }; fs.writeFileSync(PREFS_FILE, JSON.stringify(next, null, 2)); return send(res, 200, next); }
      return send(res, 200, readPrefs());
    }
    if (req.method === "POST" && p === "/api/prefs/test-lark") {
      try { await sendLarkText("🔔 Viral Short Studio: thử báo Lark thành công."); return send(res, 200, { ok: true }); }
      catch (e) { return send(res, 400, { error: e.message }); }
    }
    // ---- 📋 Lỗi trong N ngày (mặc định 7), gom theo nội dung ----
    if (req.method === "GET" && p === "/api/loi") {
      const days = Number(u.searchParams.get("days")) || 7, cut = Date.now() - days * 86400e3;
      const rows = [];
      try { for (const f of fs.readdirSync(LOG_DIR).filter((x) => /^loi-.*\.jsonl$/.test(x))) for (const l of fs.readFileSync(path.join(LOG_DIR, f), "utf-8").split("\n")) { try { const r = JSON.parse(l); if (Date.parse(r.at) >= cut) rows.push(r); } catch { /* bỏ */ } } } catch { /* bỏ */ }
      const groups = {};
      for (const r of rows) { const k = (r.kind + " · " + String(r.error).split("\n")[0]).slice(0, 140); (groups[k] = groups[k] || { key: k, count: 0, last: r.at }).count++; if (r.at > groups[k].last) groups[k].last = r.at; }
      return send(res, 200, { days, total: rows.length, groups: Object.values(groups).sort((a, b) => b.count - a.count) });
    }
    // ---- 🗂️ Kho video ----
    if (req.method === "GET" && p === "/api/kho") return send(res, 200, { items: await listKho(OUT), outDir: OUT });
    // ---- 🖼️ Danh sách khung (đọc từ assets/frames — thêm thư mục là có khung mới) ----
    if (req.method === "GET" && p === "/api/frames") {
      return send(res, 200, { items: listFrames().map((f) => ({ ...f, preview: fs.existsSync(path.join(PUBLIC, "frames", f.id + ".jpg")) ? `/frames/${f.id}.jpg` : `/api/frames/${f.id}/png` })) });
    }
    if (req.method === "GET" && /^\/api\/frames\/[\w-]+\/png$/.test(p)) {
      const fr = resolveFrame("frame:" + p.split("/")[3]);
      if (fr) return send(res, 200, fs.readFileSync(fr.png), MIME[".png"]);
      return send(res, 404, { error: "không có khung" });
    }
    // ---- ✅ Kiểm tra máy sẵn sàng ----
    if (req.method === "GET" && p === "/api/readiness") return send(res, 200, await readiness());

    // ---- ĐÁNH GIÁ ----
    if (req.method === "POST" && p === "/api/evaluate") {
      const { path: src, url, deep, model = DEFAULTS.model, lang = DEFAULTS.lang } = await readJSONBody(req);
      const input = url || src;
      if (!input || missingLocal([input])) return send(res, 400, { error: "thiếu/không thấy file (hoặc dán link YouTube/Drive)" });
      const job = newJob("eval");
      runJob(job, async (onLog) => {
        const file = await resolveSource(input, { onLog, id: job.id });
        const ev = await evaluate(file, { onLog, model, lang });
        if (deep) {
          try {
            ev.aiAnalysis = await askClaude(buildViralPrompt(ev), { onLog });
          } catch (e) { onLog("⚠ AI cloud lỗi: " + e.message); ev.aiAnalysis = null; }
        }
        delete ev._transcript;
        return ev;
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 🏅 CHẠY TIÊU CHUẨN (100 điểm) ----
    if (req.method === "POST" && p === "/api/standard") {
      const { path: src, url, model = DEFAULTS.model, lang = DEFAULTS.lang } = await readJSONBody(req);
      const input = url || src;
      if (!input || missingLocal([input])) return send(res, 400, { error: "thiếu/không thấy file (hoặc dán link YouTube/Drive)" });
      const job = newJob("standard");
      runJob(job, async (onLog) => {
        const file = await resolveSource(input, { onLog, id: job.id });
        const r = await runStandard(file, { onLog, model, lang });
        delete r.transcriptText;
        return r;
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- BIÊN TẬP ----
    if (req.method === "POST" && p === "/api/edit") {
      const body = await readJSONBody(req);
      const input = body.url || body.path;
      if (!input || missingLocal([input])) return send(res, 400, { error: "thiếu/không thấy file (hoặc dán link YouTube/Drive)" });
      const job = newJob("edit");
      runJob(job, async (onLog) => {
        const file = await resolveSource(input, { onLog, id: job.id });
        const base = slug(path.basename(file).replace(/\.[^.]+$/, ""));
        const outPath = path.join(OUT, `${base}-viral-${Date.now()}.mp4`);
        await applyDirector(body, onLog);
        const r = await autoEdit(file, { ...editJobOpts(body), onLog, id: job.id, outPath });
        // 🖼️✍️📤 Thumbnail + Content AI + (tuỳ chọn) đăng Lark — ĐỒNG NHẤT mọi tính năng làm video.
        const title = slug(path.basename(file).replace(/\.[^.]+$/, "")).replace(/-/g, " ");
        const pub = await publishOutputs([{ outPath: r.outPath, title, transcriptText: r.transcriptText }], { ...publishOpts(body, "Video"), onLog });
        return { ...r, ...pub[0], clips: pub };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 👁️ BIÊN TẬP PHA 1 — KẾ HOẠCH CẮT để DUYỆT (không render) ----
    if (req.method === "POST" && p === "/api/edit/plan") {
      const body = await readJSONBody(req);
      const input = body.url || body.path;
      if (!input || missingLocal([input])) return send(res, 400, { error: "thiếu/không thấy file (hoặc dán link YouTube/Drive)" });
      const job = newJob("editplan");
      runJob(job, async (onLog) => {
        const file = await resolveSource(input, { onLog, id: job.id });
        await applyDirector(body, onLog);
        const plan = await planVideoKeep(file, {
          removeFillers: !!body.removeFillers, doCutSilence: body.doCutSilence !== false,
          focus: body.focus || "", model: body.model || DEFAULTS.model, lang: body.lang || DEFAULTS.lang,
          silenceMax: 0.5, onLog,
        });
        onLog(`\n=== PHA DUYỆT XONG: ${plan.blocks.length} đoạn — duyệt trên trục thời gian rồi bấm render. ===`);
        return {
          planOnly: true, planKind: "edit", source: file,
          durationSec: plan.duration, sourceDuration: plan.duration,
          keep: plan.keep, clips: plan.blocks,
        };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 👁️ BIÊN TẬP PHA 2 — RENDER theo các đoạn ĐÃ DUYỆT ----
    if (req.method === "POST" && p === "/api/edit/render") {
      const body = await readJSONBody(req);
      const file = resolveAsset(body.source || body.path);
      if (!file || !fs.existsSync(file)) return send(res, 400, { error: "thiếu/không thấy video nguồn để render" });
      const blocks = Array.isArray(body.clips) ? body.clips : [];
      if (!blocks.length) return send(res, 400, { error: "chưa duyệt đoạn nào để render" });
      const job = newJob("edit");
      runJob(job, async (onLog) => {
        const meta = await probe(file);
        const keep = finalKeepFromBlocks(blocks, body.keep, meta.duration);
        if (!keep.length) throw new Error("các đoạn đã duyệt rỗng — kiểm tra lại trục thời gian");
        await applyDirector(body, onLog);
        const base = slug(path.basename(file).replace(/\.[^.]+$/, ""));
        const outPath = path.join(OUT, `${base}-viral-${Date.now()}.mp4`);
        const r = await autoEdit(file, {
          ...editJobOpts(body), onLog, id: job.id, outPath,
          keepRanges: keep, doCutSilence: false, removeFillers: false,
        });
        const title = base.replace(/-/g, " ");
        const pub = await publishOutputs([{ outPath: r.outPath, title, transcriptText: r.transcriptText }], { ...publishOpts(body, "Video"), onLog });
        return { ...r, ...pub[0], clips: pub };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 🎙️ SHORT LỒNG VOICE (9:16) ----
    if (req.method === "POST" && p === "/api/voiceshort") {
      const body = await readJSONBody(req);
      const clipsIn = (body.clips || []).map((s) => String(s).trim()).filter(Boolean);
      if (!clipsIn.length) return send(res, 400, { error: "chưa có video bối cảnh" });
      if (!body.voicePath || missingLocal([body.voicePath])) return send(res, 400, { error: "chưa có file giọng đọc (voice)" });
      const miss = missingLocal(clipsIn);
      if (miss) return send(res, 400, { error: "không thấy file: " + miss });
      const job = newJob("voiceshort");
      runJob(job, async (onLog) => {
        const clips = await resolveSources(clipsIn, { onLog, id: job.id });
        const voicePath = await resolveSource(body.voicePath, { onLog, id: job.id + "-voice" });
        const b0 = slug(path.basename(clips[0]).replace(/\.[^.]+$/, "")) || "voice-short";
        const outPath = path.join(OUT, `voice-${b0}-${Date.now()}.mp4`);
        const r = await voiceShort(clips, voicePath, { ...voiceJobOpts(body), onLog, id: job.id, outPath });
        // 🖼️✍️📤 Thumbnail + Content AI + (tuỳ chọn) đăng Lark — đồng nhất.
        const pub = await publishOutputs([{ outPath: r.outPath, title: body.hookText || "", transcriptText: r.transcriptText }], { ...publishOpts(body, "Video"), onLog });
        return { ...r, ...pub[0], clips: pub };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 👁️ VOICE PHA 1 — KẾ HOẠCH CẮT GIỌNG ĐỌC để DUYỆT (không render) ----
    if (req.method === "POST" && p === "/api/voiceshort/plan") {
      const body = await readJSONBody(req);
      if (!body.voicePath || missingLocal([body.voicePath])) return send(res, 400, { error: "chưa có file giọng đọc (voice)" });
      const job = newJob("voiceplan");
      runJob(job, async (onLog) => {
        const voiceFile = await resolveSource(body.voicePath, { onLog, id: job.id });
        const plan = await planVoiceKeep(voiceFile, { model: body.model || DEFAULTS.model, lang: body.lang || DEFAULTS.lang, onLog });
        onLog(`\n=== PHA DUYỆT XONG: ${plan.blocks.length} đoạn giọng đọc — duyệt/cắt gọn rồi bấm render. ===`);
        return {
          planOnly: true, planKind: "voiceshort", source: voiceFile,
          durationSec: plan.duration, sourceDuration: plan.duration,
          keep: plan.keep, clips: plan.blocks,
        };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 👁️ VOICE PHA 2 — RENDER với giọng đọc đã cắt theo duyệt ----
    if (req.method === "POST" && p === "/api/voiceshort/render") {
      const body = await readJSONBody(req);
      const clipsIn2 = (body.clips2 || body.sceneClips || []).map((s) => String(s).trim()).filter(Boolean);
      if (!clipsIn2.length) return send(res, 400, { error: "chưa có video bối cảnh" });
      const voiceFile = resolveAsset(body.source || body.voicePath);
      if (!voiceFile || !fs.existsSync(voiceFile)) return send(res, 400, { error: "thiếu/không thấy file giọng đọc" });
      const blocks = Array.isArray(body.clips) ? body.clips : [];
      if (!blocks.length) return send(res, 400, { error: "chưa duyệt đoạn giọng đọc nào" });
      const missV = missingLocal(clipsIn2);
      if (missV) return send(res, 400, { error: "không thấy file: " + missV });
      const job = newJob("voiceshort");
      runJob(job, async (onLog) => {
        const clips = await resolveSources(clipsIn2, { onLog, id: job.id });
        const meta = await probe(voiceFile);
        const keep = finalKeepFromBlocks(blocks, body.keep, meta.duration);
        if (!keep.length) throw new Error("các đoạn giọng đọc đã duyệt rỗng");
        const b0 = slug(path.basename(clips[0]).replace(/\.[^.]+$/, "")) || "voice-short";
        const outPath = path.join(OUT, `voice-${b0}-${Date.now()}.mp4`);
        const r = await voiceShort(clips, voiceFile, {
          ...voiceJobOpts(body), onLog, id: job.id, outPath, voiceKeepRanges: keep,
        });
        const pub = await publishOutputs([{ outPath: r.outPath, title: body.hookText || "", transcriptText: r.transcriptText }], { ...publishOpts(body, "Video"), onLog });
        return { ...r, ...pub[0], clips: pub };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 🎬 BIÊN TẬP VIDEO DÀI (YouTube 16:9) ----
    if (req.method === "POST" && p === "/api/longedit") {
      const body = await readJSONBody(req);
      const pathsIn = (body.paths || []).map((s) => String(s).trim()).filter(Boolean);
      if (!pathsIn.length) return send(res, 400, { error: "chưa có video đầu vào" });
      const missLong = missingLocal(pathsIn);
      if (missLong) return send(res, 400, { error: "không thấy file: " + missLong });
      const job = newJob("longedit");
      runJob(job, async (onLog) => {
        // Mỗi dòng có thể là đường dẫn máy HOẶC link (Drive/YouTube/FB) → tải trước, giữ đúng thứ tự ghép.
        const paths = await resolveSources(pathsIn, { onLog, id: job.id });
        const base = slug(path.basename(paths[0]).replace(/\.[^.]+$/, "")) || "video-dai";
        const outPath = path.join(OUT, `long-${base}-${Date.now()}.mp4`);
        await applyDirector(body, onLog);
        const r = await longEdit(paths, { ...longJobOpts(body), onLog, id: job.id, outPath });
        // 🖼️✍️📤 Thumbnail + Content AI + (tuỳ chọn) đăng Lark cho TỪNG phần — đồng nhất.
        return await publishLongParts(r, body, base, onLog);
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 👁️ VIDEO DÀI PHA 1 — GHÉP + KẾ HOẠCH CẮT để DUYỆT (không render) ----
    if (req.method === "POST" && p === "/api/longedit/plan") {
      const body = await readJSONBody(req);
      const pathsIn = (body.paths || []).map((s) => String(s).trim()).filter(Boolean);
      if (!pathsIn.length) return send(res, 400, { error: "chưa có video đầu vào" });
      const missLP = missingLocal(pathsIn);
      if (missLP) return send(res, 400, { error: "không thấy file: " + missLP });
      const job = newJob("longplan");
      runJob(job, async (onLog) => {
        const paths = await resolveSources(pathsIn, { onLog, id: job.id });
        await applyDirector(body, onLog);
        // Nhiều video → GHÉP TRƯỚC để duyệt trên MỘT trục thời gian thống nhất.
        let src = paths[0];
        if (paths.length > 1) {
          src = path.join(WORK, `${job.id}_concat.mp4`);
          onLog(`→ Ghép ${paths.length} video để duyệt trên một trục thời gian...`);
          await concatVideos(paths, src, onLog, body.transition || "cut", 0.6, 1920, 1080);
        }
        const plan = await planVideoKeep(src, {
          smartPrune: !!body.smartPrune, removeFillers: !!body.removeFillers,
          doCutSilence: body.doCutSilence !== false, focus: body.focus || "",
          model: body.model || DEFAULTS.model, lang: body.lang || DEFAULTS.lang,
          silenceMax: 0.6, onLog,
        });
        onLog(`\n=== PHA DUYỆT XONG: ${plan.blocks.length} đoạn — duyệt trên trục thời gian rồi bấm render. ===`);
        return {
          planOnly: true, planKind: "longedit", source: src,
          durationSec: plan.duration, sourceDuration: plan.duration,
          keep: plan.keep, clips: plan.blocks,
        };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 👁️ VIDEO DÀI PHA 2 — RENDER theo các đoạn ĐÃ DUYỆT ----
    if (req.method === "POST" && p === "/api/longedit/render") {
      const body = await readJSONBody(req);
      const file = resolveAsset(body.source);
      if (!file || !fs.existsSync(file)) return send(res, 400, { error: "thiếu/không thấy video nguồn (đã ghép) để render" });
      const blocks = Array.isArray(body.clips) ? body.clips : [];
      if (!blocks.length) return send(res, 400, { error: "chưa duyệt đoạn nào để render" });
      const job = newJob("longedit");
      runJob(job, async (onLog) => {
        const meta = await probe(file);
        const keep = finalKeepFromBlocks(blocks, body.keep, meta.duration);
        if (!keep.length) throw new Error("các đoạn đã duyệt rỗng — kiểm tra lại trục thời gian");
        await applyDirector(body, onLog);
        const base = slug(path.basename(file).replace(/\.[^.]+$/, "")) || "video-dai";
        const outPath = path.join(OUT, `long-${base}-${Date.now()}.mp4`);
        const r = await longEdit([file], {
          ...longJobOpts(body), onLog, id: job.id, outPath,
          keepRanges: keep, smartPrune: false, removeFillers: false, doCutSilence: false,
        });
        return await publishLongParts(r, body, base, onLog);
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- BÓC Ý TƯỞNG ----
    if (req.method === "POST" && p === "/api/extract") {
      const body = await readJSONBody(req);
      const job = newJob("extract");
      runJob(job, async (onLog) => {
        const file = await resolveSource(body.url || body.path, { onLog, id: job.id });
        if (!file || !fs.existsSync(file)) throw new Error("không có file/URL hợp lệ");
        const ideas = await extractIdeas(file, { onLog, lang: body.lang || "vi", model: body.model || "small" });
        if (body.deep) {
          try {
            const prompt = `Đây là 1 video short đang viral. Bóc "công thức" để tôi làm lại phiên bản của mình.
Thời lượng ${ideas.structure.durationSec}s, ${ideas.structure.cutsPerMin} cắt/phút.
HOOK: "${ideas.hook}"
TRANSCRIPT:
"""${(ideas.transcript||"").slice(0,3500)}"""
Hãy trả lời tiếng Việt, gọn: (1) công thức hook, (2) cấu trúc kịch bản theo mốc giây, (3) vì sao nó giữ chân, (4) 3 ý tưởng biến thể tôi có thể quay lại cho lĩnh vực của tôi.`;
            ideas.aiAnalysis = await askClaude(prompt, { onLog });
          } catch (e) { onLog("⚠ AI cloud lỗi: " + e.message); }
        }
        return ideas;
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 🧠 CẮT TỰ ĐỘNG (video dài → nhiều short) — 1 PHÁT (không duyệt) ----
    if (req.method === "POST" && p === "/api/autoclip") {
      const body = await readJSONBody(req);
      const job = newJob("autoclip");
      runJob(job, async (onLog) => {
        const file = await resolveSource(body.url || body.path, { onLog, id: job.id });
        if (!file || !fs.existsSync(file)) throw new Error("thiếu/không thấy file hoặc URL");
        await applyDirector(body, onLog);
        const result = await autoClip(file, acOpts(body, job.id, { onLog }));
        await maybeAutoPostLark(result, body, onLog);
        return result;
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 🧠 PHA 1 — CHỌN ĐOẠN để DUYỆT (không render): trả về danh sách đoạn đề xuất ----
    if (req.method === "POST" && p === "/api/autoclip/plan") {
      const body = await readJSONBody(req);
      const job = newJob("acplan");
      runJob(job, async (onLog) => {
        const file = await resolveSource(body.url || body.path, { onLog, id: job.id });
        if (!file || !fs.existsSync(file)) throw new Error("thiếu/không thấy file hoặc URL");
        await applyDirector(body, onLog);
        return await autoClip(file, acOpts(body, job.id, {
          onLog, planOnly: true,
          transcriptIn: body.transcriptFile ? resolveAsset(body.transcriptFile) : null,
        }));
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- 🧠 PHA 2 — RENDER các đoạn ANH ĐÃ DUYỆT (bỏ qua AI, tái dùng transcript) ----
    if (req.method === "POST" && p === "/api/autoclip/render") {
      const body = await readJSONBody(req);
      const job = newJob("autoclip");
      runJob(job, async (onLog) => {
        const file = resolveAsset(body.source || body.path);
        if (!file || !fs.existsSync(file)) throw new Error("thiếu/không thấy video nguồn để render");
        const clipsIn = Array.isArray(body.clips) ? body.clips : [];
        if (!clipsIn.length) throw new Error("chưa duyệt đoạn nào để render");
        const result = await autoClip(file, acOpts(body, job.id, {
          onLog, clipsIn,
          transcriptIn: body.transcriptFile ? resolveAsset(body.transcriptFile) : null,
        }));
        await maybeAutoPostLark(result, body, onLog);
        return result;
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- ✏️ TINH CHỈNH: dựng lại 1 short (đổi mốc cắt / sửa phụ đề / hiệu ứng) ----
    // ---- 🖼️ ĐỔI KHUNG không dựng lại (dùng lớp video sạch cất lúc dựng) ----
    if (req.method === "POST" && p === "/api/doi-khung") {
      const body = await readJSONBody(req);
      if (!body.path || !fs.existsSync(body.path)) return send(res, 400, { error: "không thấy video cần đổi khung" });
      if (!hasFrameLayer(body.path)) return send(res, 409, { error: "Video này dựng trước khi có tính năng Đổi khung", noLayer: true });
      const job = newJob("doikhung");
      runJob(job, async (onLog) => swapFrame(body.path, body.reframe || "blur", { onLog }));
      return send(res, 200, { jobId: job.id });
    }

    if (req.method === "POST" && p === "/api/reclip") {
      const body = await readJSONBody(req);
      if (!body.source || !fs.existsSync(body.source)) return send(res, 400, { error: "thiếu/không thấy video gốc để dựng lại" });
      const job = newJob("reclip");
      runJob(job, async (onLog) => reclip({
        onLog, id: job.id,
        source: body.source, transcriptFile: body.transcriptFile || null,
        start: body.start, end: body.end,
        segments: body.segments || null,
        reframe: body.reframe || "blur",
        captionStyle: body.captionStyle || "karaoke",
        fontId: body.fontId || DEFAULTS.fontId,
        noText: !!body.noText,
        colorLevel: body.colorLevel || "off",
        punch: !!body.punch, film: body.film !== false, progress: body.progress !== false,
        doCaptions: body.doCaptions !== false,
        voiceClean: body.voiceClean || "off", smooth: body.smooth || "off",
        hookText: body.hookText || null,
        speed: body.speed ?? 1,
        overlayText: body.overlayText || null, overlayPos: body.overlayPos || "bottom",
      }));
      return send(res, 200, { jobId: job.id });
    }

    // ---- 📤 ĐĂNG LÊN LARK BASE (video → Ảnh/video, caption → Nội dung) ----
    if (req.method === "POST" && p === "/api/lark-post") {
      const body = await readJSONBody(req);
      if (!body.videoPath || !fs.existsSync(body.videoPath)) return send(res, 400, { error: "thiếu/không thấy video để đăng" });
      const job = newJob("lark");
      runJob(job, async (onLog) => postToLark({
        videoPath: body.videoPath, caption: body.caption || "",
        thumbPath: body.thumbPath || null, onLog,
      }));
      return send(res, 200, { jobId: job.id });
    }

    // ---- 🏷️ NƯỚNG LOGO/NHẠC KHI TẢI (finalize) ----
    if (req.method === "POST" && p === "/api/finalize") {
      const body = await readJSONBody(req);
      const file = body.path;
      if (!file || !fs.existsSync(file)) return send(res, 400, { error: "thiếu/không thấy video" });
      const job = newJob("finalize");
      const base = slug(path.basename(file).replace(/\.[^.]+$/, ""));
      // Ghi bản "final" NGAY CẠNH short nguồn (trong thư mục lần cắt), giữ gọn.
      const outPath = path.join(path.dirname(file), `${base}-final-${Date.now()}.mp4`);
      runJob(job, async (onLog) => {
        const logoP = resolveAsset(body.logoPath), ctaP = resolveAsset(body.ctaPath);
        // Nhạc linh hoạt: file / THƯ MỤC (tự chọn) / LINK (tải yt-dlp) — như các tab biên tập.
        const musicP = await resolveMusicInput(resolveAsset(body.musicPath), { onLog });
        const logo = logoP ? {
          path: logoP, x: body.logoX ?? 92, y: body.logoY ?? 92,
          scale: body.logoScale ?? 0.16, opacity: body.logoOpacity ?? 0.9,
        } : null;
        const music = musicP ? { path: musicP, vol: body.musicVol ?? 0.18 } : null;
        const cta = ctaP ? { path: ctaP } : null;
        const color = body.color || null;
        const transition = body.transition || "fade";
        const out = await finalizeVideo(file, outPath, { color, logo, music, cta, transition, onLog });
        return { outPath: out };
      });
      return send(res, 200, { jobId: job.id });
    }

    // ---- HÀNG LOẠT ----
    if (req.method === "POST" && p === "/api/batch") {
      const body = await readJSONBody(req);
      const folderIn = String(body.folder || "").trim();
      if (!folderIn || (!isHttpUrl(folderIn) && !fs.existsSync(folderIn)))
        return send(res, 400, { error: "thiếu/không thấy thư mục (hoặc dán link THƯ MỤC Google Drive)" });
      const job = newJob("batch");
      runJob(job, async (onLog) => {
        const folder = await resolveFolderSource(folderIn, { onLog });
        const files = fs.readdirSync(folder)
          .filter((f) => /\.(mp4|mov|mkv|webm|avi)$/i.test(f))
          .map((f) => path.join(folder, f));
        if (!files.length) throw new Error("thư mục không có video");
        const mode = body.mode || "evaluate";
        const results = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          onLog(`\n===== [${i + 1}/${files.length}] ${path.basename(f)} =====`);
          try {
            if (mode === "edit") {
              const base = slug(path.basename(f).replace(/\.[^.]+$/, ""));
              const outPath = path.join(OUT, `${base}-viral-${Date.now()}.mp4`);
              const r = await autoEdit(f, {
                onLog, id: `${job.id}-${i}`, outPath,
                doCutSilence: body.doCutSilence !== false,
                reframe: body.reframe || "blur",
                doCaptions: body.doCaptions !== false,
                captionStyle: body.captionStyle || "karaoke",
                fontId: body.fontId || DEFAULTS.fontId,
                noText: !!body.noText,
                colorLevel: body.colorLevel || "medium",
                punch: body.punch !== false, shake: body.shake !== false,
                film: body.film !== false, progress: body.progress !== false,
                flash: body.flash !== false,
                brollFolder: body.brollFolder || null, brollFill: body.brollFill || "match",
                normalize: body.normalize !== false,
                model: body.model || DEFAULTS.model, lang: body.lang || DEFAULTS.lang,
              });
              results.push({ file: f, outPath: r.outPath });
            } else {
              const ev = await evaluate(f, { onLog, model: body.model || DEFAULTS.model, lang: body.lang || DEFAULTS.lang });
              delete ev._transcript;
              results.push({ file: f, overall: ev.overall, verdict: ev.verdict, dimensions: ev.dimensions });
            }
          } catch (e) {
            onLog("  ❌ " + e.message);
            results.push({ file: f, error: e.message });
          }
        }
        return { mode, count: files.length, results };
      });
      return send(res, 200, { jobId: job.id });
    }

    return send(res, 404, { error: "không tìm thấy route: " + p });
  } catch (e) {
    return send(res, 500, { error: e.message || String(e) });
  }
}

server.listen(PORT, HOST, () => {
  console.log(`\n  🎬 Viral Short Studio đang chạy:  http://localhost:${PORT}  (nghe tại ${HOST}${HOST === "127.0.0.1" ? ", chỉ máy này" : ", MỞ RA MẠNG có mật khẩu"})\n`);
  console.log(`  Thư mục xuất video: ${OUT}\n`);
  // 🧹 Dọn kho 1 lượt lúc khởi động (giữ nguồn 3 ngày). Không chặn server nếu lỗi.
  try { housekeep({ ttlDays: 3, onLog: (l) => console.log(l) }); } catch (e) { console.log("⚠ dọn kho lỗi: " + e.message); }
});
