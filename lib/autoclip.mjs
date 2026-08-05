// 🧠 BỘ NÃO SĂN KHOẢNH KHẮC — video dài → nhiều short viral tự động.
// Luồng: gõ chữ TOÀN video (1 lần) → Claude chấm & chọn các ĐOẠN ĐẮT GIÁ
// (vừa có triết lý/insight, vừa viral) → mỗi đoạn: cắt + bỏ tiếng đệm (à/ừ/ờ)
// + đắp hook chữ to + phụ đề động + hiệu ứng → xuất short + file caption gợi ý.
import path from "node:path";
import fs from "node:fs";
import { run, WORK, slug, __root } from "./util.mjs";
import { FFMPEG, probe, hasNvenc } from "./ffmpeg.mjs";
import { transcribeWords } from "./transcribe.mjs";
import { autoEdit } from "./edit.mjs";
import { planClipCuts, remapTranscript } from "./fillers.mjs";
import { askClaude } from "./ai.mjs";
import { makeThumbnail } from "./thumb.mjs";
import { makeBrandThumb, pickPhoto } from "./thumbcard.mjs";
import { appendBrandTags } from "./publish.mjs";
import { evaluate } from "./evaluate.mjs";
import { DEFAULTS, BRAND } from "./presets.mjs";

const OUT = path.join(WORK, "out");
fs.mkdirSync(OUT, { recursive: true });

const fmtMS = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Nhãn thời gian GIỜ ĐỊA PHƯƠNG (máy = GMT+7) cho tên thư mục — KHÔNG dùng toISOString (ra UTC lệch).
function runStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function parseMS(v) {
  if (typeof v === "number") return v;
  const m = String(v || "").match(/(\d+)\s*:\s*(\d+)/);
  if (m) return +m[1] * 60 + +m[2];
  const f = parseFloat(v);
  return isFinite(f) ? f : null;
}

// Đọc "chất riêng" của kênh để AI chấm đoạn bám đúng thương hiệu.
// CHỈ đọc file TRONG thư mục phần mềm (không dò ra ngoài máy người dùng):
//   standards/thuong-hieu.md  ← bạn tự viết: kênh nói về gì, giọng điệu, giá trị cốt lõi.
// Không có file → bỏ qua, AI vẫn chấm bình thường.
function brandRubric() {
  try {
    const p = path.join(__root, "standards", "thuong-hieu.md");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8").slice(0, 1200);
  } catch { /* bỏ qua */ }
  return "";
}

// Cắt transcript thành các mảnh ~maxChars, GỐI ĐẦU (overlap) để 1 ý không bị chia đôi
// giữa 2 chunk → AI luôn thấy trọn ý ở ít nhất 1 chunk (dedup theo thời gian khử trùng).
function chunkSegments(segments, maxChars = 4200, overlap = 6) {
  const lines = segments.map((s) => `[${fmtMS(s.start)}] ${s.text}`);
  const chunks = [];
  let i = 0;
  while (i < lines.length) {
    let j = i, len = 0;
    while (j < lines.length && (j === i || len + lines[j].length + 1 <= maxChars)) { len += lines[j].length + 1; j++; }
    chunks.push(lines.slice(i, j));
    if (j >= lines.length) break;
    i = Math.max(i + 1, j - overlap); // lùi lại `overlap` dòng cho chunk kế
  }
  return chunks;
}

export function buildSelectPrompt(linesText, brand = "", floor = 50, focus = "", lenOpts = {}) {
  const { preferComplete = false, minSec = 16, maxSec = 150 } = lenOpts;
  const lenRule = `\n📏 ĐỘ DÀI MONG MUỐN: mỗi đoạn khoảng ${minSec}–${maxSec} giây. ${preferComplete
    ? "⭐ ƯU TIÊN ĐỦ Ý HƠN NGẮN GỌN: thà DÀI mà trọn mạch (đủ đầu–thân–kết, không hụt bối cảnh) còn hơn ngắn mà cụt. Lùi mốc đầu về câu ĐẶT VẤN ĐỀ, kéo mốc cuối tới câu CHỐT trọn vẹn."
    : "Ưu tiên gọn nhưng vẫn phải TRỌN Ý (đủ đầu–thân–kết)."}\n`;
  return `Bạn là biên tập viên video short (TikTok/Reels/YouTube Shorts) cho kênh${BRAND.name ? ` "${BRAND.name}"` : ""} — chủ đề ${BRAND.niche || "theo nội dung video"}.
Dưới đây là một phần transcript CÓ MỐC THỜI GIAN [phút:giây] của video dài.
${brand ? `\nBỐI CẢNH THƯƠNG HIỆU (để chấm đúng "chất"):\n"""${brand}"""\n` : ""}${focus ? `\n⭐ YÊU CẦU RIÊNG CỦA NGƯỜI DÙNG (ƯU TIÊN CAO NHẤT — chọn & ưu tiên đúng ý này):\n"""${focus}"""\n` : ""}
🎯 MỤC TIÊU TỐI THƯỢNG: mỗi short tạo SỰ CHUYỂN HÓA ở người nghe — xem xong họ VỠ RA / THAY ĐỔI NHẬN THỨC về MỘT điều, "rõ hình, rõ khái niệm". Giá trị chuyển hóa QUAN TRỌNG HƠN viral.

⭐ QUY TẮC VÀNG — MỖI SHORT = ĐÚNG MỘT TRỌNG ĐIỂM: mỗi đoạn chỉ dạy DUY NHẤT MỘT khái niệm/nguyên lý/bài học, TRỌN VẸN & TỰ ĐỨNG ĐỘC LẬP (nêu khái niệm → làm rõ bằng ví dụ/hình ảnh → chốt lại). KHÔNG gộp nhiều ý vào một short. Nếu một khúc chứa NHIỀU trọng điểm → TÁCH thành NHIỀU short, mỗi cái một trọng điểm.

🔢 SỐ LƯỢNG: KHÔNG GIỚI HẠN — có bao nhiêu trọng điểm giá trị thì chọn bấy nhiêu; quét kỹ cả video, đừng bỏ sót đoạn dạy trọn được điều gì. Thà nhiều short mỗi cái một ý rõ ràng còn hơn ít short gộp nhiều ý.

NHIỆM VỤ: chọn các ĐOẠN mỗi đoạn MỘT TRỌNG ĐIỂM. Ưu tiên đoạn thoả:
(A) GIÁ TRỊ/TRIẾT LÝ: chứa một insight, một góc nhìn "aha", một nguyên lý khiến người xem NGỘ ra điều gì đó${BRAND.niche ? ` về ${BRAND.niche}` : ""} — TỰ ĐỨNG ĐỘC LẬP, không cần ngữ cảnh trước đó.
(B) VIRAL: có câu mở mạnh hoặc một "punch line" đáng chia sẻ, dễ khiến người xem tag/chia sẻ.
(C) CẢM XÚC (TIÊU CHÍ CHÍNH — ưu tiên cao): đoạn phải KHIẾN NGƯỜI XEM RUNG ĐỘNG — xúc động, truyền cảm hứng, nổi da gà, cay mắt, hoặc bừng tỉnh. Cảm xúc mạnh nhất thường nằm ở: một CÂU CHUYỆN CÁ NHÂN/trải nghiệm thật, sự tổn thương/thành thật, một sự thật phũ phàng nói thẳng, hoặc một mạch DẪN LÊN CAO TRÀO rồi chốt bằng một câu đắt. ƯU TIÊN đoạn có cảm xúc thật hơn đoạn chỉ "đúng mà khô".

✅ ĐỦ NGHĨA (QUAN TRỌNG BẬC NHẤT — nhiều video hay bị lỗi cắt cụt, đừng để xảy ra):
- Mỗi đoạn phải là MỘT Ý TRỌN VẸN đọc lên NGHE ĐỦ NGHĨA, có ĐẦU–THÂN–KẾT: (mở) nêu/đặt vấn đề → (thân) giải thích/ví dụ → (kết) chốt lại bài học. Người lạ xem đúng đoạn này, KHÔNG xem gì trước/sau, vẫn HIỂU TRỌN.
- LÙI mốc bắt đầu về câu ĐẶT VẤN ĐỀ/DẪN NHẬP (đừng bắt đầu giữa lúc đang giải thích dở). KÉO mốc kết tới câu CHỐT trọn vẹn (đừng dừng khi ý chưa xong, đừng dừng ở "thì", "mà", "nên là", "cái mà…").
- Nếu một ý cần 60–120 giây mới trọn thì CỨ ĐỂ DÀI — thà dài mà đủ nghĩa còn hơn ngắn mà cụt. TRÁNH đoạn < 18 giây trừ khi đó là một câu chốt cực mạnh tự đủ nghĩa.
- Nếu đoạn chỉ nghe được nửa ý (thiếu mở HOẶC thiếu kết trong transcript) thì BỎ, đừng chọn.

QUY TẮC:
- BẮT ĐẦU ở đầu một câu, KẾT THÚC ở CÂU CHỐT TRỌN VẸN — một kết "có hậu"/đủ ý (câu tổng kết, bài học rút ra, lời khuyên). TUYỆT ĐỐI không kết giữa chừng một ý đang dang dở.
- Thà ÍT mà CHẤT. Bỏ qua đoạn chào hỏi, lan man, ví dụ vụn, quảng cáo.
- KHÔNG chọn hai đoạn trùng nội dung.
- Với MỖI đoạn, chỉ ra CÂU CAO TRÀO: câu đắt nhất/lay động nhất trong đoạn (chép NGUYÊN VĂN từ transcript) và mốc [m:ss] nơi câu đó bắt đầu — đây là điểm sẽ được nhấn (zoom/nhạc dâng).

${lenRule}
TRANSCRIPT:
"""
${linesText}
"""

Trả về DUY NHẤT một mảng JSON hợp lệ (không kèm giải thích, không markdown), mỗi phần tử:
{"start":"m:ss","end":"m:ss","score":<0-100 theo GIÁ TRỊ CHUYỂN HÓA là chính>,"concept":"<TÊN 1 TRỌNG ĐIỂM/khái niệm duy nhất của đoạn, cụm ngắn>","transformation":"<sau khi xem người nghe VỠ RA/THAY ĐỔI điều gì — 1 câu>","emotion":"<tông cảm xúc 1-3 chữ>","emotionScore":<0-100 mức lay động>,"climax":"<câu đúc kết/cao trào chép nguyên văn>","climaxTime":"m:ss","title":"<tiêu đề ngắn nêu đúng trọng điểm>","hook":"<hook 3-8 chữ IN lên đầu video>","caption":"<caption đăng bài + 2-3 hashtag>","philosophy":"<khái niệm/insight đoạn này trao>","reason":"<vì sao đoạn này chuyển hóa người xem>"}
Chọn TẤT CẢ đoạn có MỘT trọng điểm giá trị (score >= ${floor}), KHÔNG giới hạn số lượng. Chỉ trả [] khi TOÀN là chào hỏi/ồn/vô nghĩa.`;
}

// Bóc mảng JSON từ text Claude (chịu được rào ```json, chữ thừa, ngoặc lồng).
export function parseClips(text) {
  if (!text) return [];
  let t = String(text).replace(/```json/gi, "```").replace(/```/g, "").trim();
  // 1) Thử: từ '[' đầu tiên, khớp ']' theo ĐỘ SÂU ngoặc (bỏ qua ] nằm trong chuỗi).
  const arr = extractBalancedArray(t);
  if (arr) { try { return JSON.parse(arr); } catch { /* xuống vá */ } }
  // 2) Thử nguyên chuỗi (nếu Claude trả object đơn hoặc mảng sạch).
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : [j]; } catch { /* vá */ }
  // 3) Vá thô: lấy từng object {...} (kể cả khi mảng hỏng dấu phẩy).
  const out = [];
  const re = /\{[^{}]*\}/g; let m;
  while ((m = re.exec(t))) { try { out.push(JSON.parse(m[0])); } catch { /* skip */ } }
  return out;
}

// Trích chuỗi "[...]" cân ngoặc đầu tiên (tôn trọng chuỗi & escape).
function extractBalancedArray(t) {
  const a = t.indexOf("[");
  if (a === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = a; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === "[") depth++;
      else if (ch === "]") { depth--; if (depth === 0) return t.slice(a, i + 1); }
    }
  }
  return null;
}

// Chuẩn hoá + lọc + khử trùng lặp (đoạn chồng lấn > 40% → giữ điểm cao hơn).
export function normalizeClips(raw, dur, { minScore = 68, minSec = 8, maxSec = 140, maxClips = 30 } = {}) {
  const cand = [];
  for (const c of raw || []) {
    let s = parseMS(c.start), e = parseMS(c.end);
    if (s == null || e == null) continue;
    s = Math.max(0, s); e = Math.min(dur, e);
    if (e - s > maxSec) e = s + maxSec;   // trần rộng, snapClip sẽ canh cuối câu
    if (e - s < minSec) continue;
    const score = Number(c.score) || 0;
    if (score < minScore) continue;
    cand.push({
      start: +s.toFixed(2), end: +e.toFixed(2), score,
      title: (c.title || "").toString().slice(0, 120).trim() || "Khoảnh khắc đắt giá",
      hook: (c.hook || "").toString().slice(0, 40).trim(),
      caption: (c.caption || "").toString().trim(),
      philosophy: (c.philosophy || "").toString().trim(),
      reason: (c.reason || "").toString().trim(),
      // Trọng điểm + chuyển hóa (mỗi short 1 khái niệm rõ ràng)
      concept: (c.concept || "").toString().slice(0, 120).trim(),
      transformation: (c.transformation || "").toString().slice(0, 240).trim(),
      // Cảm xúc (đợt 5): tông + mức lay động + câu cao trào (để nhấn về sau).
      emotion: (c.emotion || "").toString().slice(0, 30).trim(),
      emotionScore: Number(c.emotionScore) || 0,
      climax: (c.climax || "").toString().slice(0, 240).trim(),
      climaxTime: parseMS(c.climaxTime),
    });
  }
  cand.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const c of cand) {
    const overlap = kept.some((k) => {
      const ov = Math.min(c.end, k.end) - Math.max(c.start, k.start);
      return ov > 0 && ov / Math.min(c.end - c.start, k.end - k.start) > 0.4;
    });
    if (!overlap) kept.push(c);
    if (maxClips > 0 && kept.length >= maxClips) break;
  }
  // xuất theo thứ tự thời gian cho dễ theo dõi
  return kept.sort((a, b) => a.start - b.start);
}

// Phương án DỰ PHÒNG khi Claude không trả đoạn nào: chia video theo CÂU thành
// các cửa sổ ~40–70s (kết ở ranh giới câu), để anh luôn có short mà cắt.
export function heuristicClips(segments, dur, { maxClips = 8, target = 55, hardMax = 80 } = {}) {
  const out = [];
  let win = [];
  const flush = () => {
    if (!win.length) return;
    const s = win[0].start, e = win[win.length - 1].end;
    if (e - s < 12) { win = []; return; }
    const text = win.map((x) => x.text).join(" ").replace(/\s+/g, " ").trim();
    const firstWords = text.split(/\s+/).slice(0, 6).join(" ");
    out.push({
      start: +s.toFixed(2), end: +Math.min(dur, e).toFixed(2), score: 60,
      title: text.slice(0, 70).trim() || "Khoảnh khắc trong chương trình",
      hook: firstWords.toUpperCase().slice(0, 38),
      caption: text.slice(0, 200).trim(),
      philosophy: "", reason: "Chọn tự động theo mật độ lời nói (AI không chấm được).",
    });
    win = [];
  };
  for (const seg of segments) {
    win.push(seg);
    const len = win[win.length - 1].end - win[0].start;
    if (len >= target) flush();
    else if (len >= hardMax) flush();
  }
  flush();
  return out.slice(0, maxClips);
}

// Cắt thô 1 đoạn (giữ các keep-range, bỏ đệm + khoảng chết) → file mp4 sạch.
async function roughCut(input, keep, outPath, onLog) {
  const vSel = keep.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join("+");
  const useGpu = await hasNvenc();
  await run(FFMPEG, [
    "-hide_banner", "-y", "-i", input,
    "-filter_complex",
    `[0:v]select='${vSel}',setpts=N/FRAME_RATE/TB[v];[0:a]aselect='${vSel}',asetpts=N/SR/TB[a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", useGpu ? "h264_nvenc" : "libx264", "-preset", useGpu ? "p4" : "veryfast",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", outPath,
  ], { onLog: (l) => onLog("    " + l) });
  return outPath;
}

// Canh đoạn theo RANH GIỚI CÂU: bắt đầu ở đầu câu, KẾT ở cuối câu trọn vẹn (có hậu).
// Không cắt cứng giữa câu → đủ ý. Cho phép dài hơn để trọn ý (tới maxSec).
export function snapClip(segments, aiStart, aiEnd, dur, { tailPad = 0.6, minSec = 16, maxSec = 150, pauseGap = 0.38 } = {}) {
  if (!segments.length) return { start: Math.max(0, aiStart), end: Math.min(dur, aiEnd) };
  // start = đầu câu gần nhất KHÔNG muộn hơn aiStart (lùi về đầu câu).
  let si = 0;
  for (let k = 0; k < segments.length; k++) { if (segments[k].start <= aiStart + 1.0) si = k; else break; }
  // Lùi start về đầu MẠCH NÓI: nếu câu trước dính liền (khoảng ngưng nhỏ) → còn giữa ý → lùi tiếp (giới hạn ~2.5s).
  while (si > 0 && (segments[si].start - segments[si - 1].end) < pauseGap && (segments[si].start - segments[si - 1].start) < 2.5) si--;
  const start = Math.max(0, segments[si].start - 0.15);
  // end = cuối câu chứa/kế tiếp aiEnd.
  let ei = segments.length - 1;
  for (let k = 0; k < segments.length; k++) { if (segments[k].end >= aiEnd - 0.6) { ei = k; break; } }
  // KÉO end tới KHOẢNG NGƯNG TỰ NHIÊN: nếu câu sau nói liền mạch (ngưng nhỏ) → ý chưa dứt → kéo tiếp (tới maxSec).
  while (ei < segments.length - 1 && (segments[ei + 1].start - segments[ei].end) < pauseGap && (segments[ei + 1].end - start) <= maxSec) ei++;
  let end = Math.min(dur, segments[ei].end + tailPad);
  // Nếu quá dài, lùi về cuối câu gần maxSec nhất (vẫn trọn câu).
  if (end - start > maxSec) {
    let cut = start + maxSec;
    for (let k = segments.length - 1; k >= 0; k--) {
      if (segments[k].end <= start + maxSec && segments[k].end > start + minSec) { cut = segments[k].end + tailPad; break; }
    }
    end = Math.min(dur, cut);
  }
  if (end - start < minSec) end = Math.min(dur, start + minSec);
  return { start: +start.toFixed(2), end: +end.toFixed(2) };
}

// Trích 1 MẠCH LIỀN [start,end] — KHÔNG cắt vụn bên trong → tiếng khớp hình tuyệt đối.
// Seek chính xác + ép CFR 30fps + resample audio async để video/audio luôn cùng độ dài.
async function extractSpan(input, start, dur, out, onLog) {
  const useGpu = await hasNvenc();
  await run(FFMPEG, [
    "-hide_banner", "-y",
    "-ss", start.toFixed(3), "-i", input, "-t", dur.toFixed(3),
    "-map", "0:v:0", "-map", "0:a:0",
    "-vsync", "cfr", "-r", "30",
    "-af", "aresample=async=1:min_hard_comp=0.100:first_pts=0",
    "-c:v", useGpu ? "h264_nvenc" : "libx264", "-preset", useGpu ? "p4" : "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    out,
  ], { onLog: (l) => onLog("    " + l) });
  return out;
}

// Đổi TỐC ĐỘ 1 clip (0.5–2.0×): video setpts + audio atempo. Dùng cho pacing (nhanh/chậm).
async function applySpeed(input, speed, out, onLog) {
  const sp = Math.max(0.5, Math.min(2.0, Number(speed) || 1));
  const useGpu = await hasNvenc();
  await run(FFMPEG, [
    "-hide_banner", "-y", "-i", input,
    "-filter_complex", `[0:v]setpts=${(1 / sp).toFixed(4)}*PTS[v];[0:a]atempo=${sp.toFixed(4)}[a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", useGpu ? "h264_nvenc" : "libx264", "-preset", useGpu ? "p4" : "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out,
  ], { onLog: (l) => onLog("    " + l) });
  return out;
}

// Co giãn mốc phụ đề theo tốc độ (2× → mốc chia đôi) để karaoke khớp video đã đổi tốc độ.
function scaleTranscript(pre, speed) {
  const f = 1 / (Number(speed) || 1);
  return {
    words: (pre.words || []).map((w) => ({ start: +(w.start * f).toFixed(3), end: +(w.end * f).toFixed(3), word: w.word })),
    segments: (pre.segments || []).map((s) => ({ start: +(s.start * f).toFixed(3), end: +(s.end * f).toFixed(3), text: s.text })),
    duration: +((pre.duration || 0) * f).toFixed(3),
  };
}

// Dời transcript về mốc 0 cho đoạn [start,end], GIỮ NGUYÊN mọi từ (không bỏ đệm) → khớp tiếng.
export function shiftTranscript(words, segments, start, end) {
  const w = (words || []).filter((x) => x.end > start && x.start < end)
    .map((x) => ({ start: +(Math.max(start, x.start) - start).toFixed(3), end: +(Math.min(end, x.end) - start).toFixed(3), word: x.word }));
  const seg = (segments || []).filter((s) => s.end > start && s.start < end)
    .map((s) => ({ start: +(Math.max(start, s.start) - start).toFixed(3), end: +(Math.min(end, s.end) - start).toFixed(3), text: s.text }));
  return { words: w, segments: seg, duration: +(end - start).toFixed(3) };
}

// ---- Hàm chính ----
export async function autoClip(input, opts = {}) {
  const {
    onLog = () => {}, id = "ac", model = "medium", lang = "vi",
    minScore = 68, maxClips = 0, burnHook = true,
    // tuỳ chọn biên tập truyền thẳng xuống autoEdit
    reframe = DEFAULTS.reframeShort, captionStyle = DEFAULTS.captionStyle, colorLevel = DEFAULTS.colorLevel,
    punch = DEFAULTS.punch, shake = DEFAULTS.shake, film = DEFAULTS.film, progress = DEFAULTS.progress, flash = DEFAULTS.flash,
    scoreClips = DEFAULTS.scoreClips,
    normalize = true, musicPath = null, brollFolder = null, brollFill = "match",
    manual = null, smooth = "off", sharpen = DEFAULTS.sharpen ?? 0, voiceClean = "off", brollTransition = "fade", aiBroll = false, aiBrollCount = 6,
    aiCorrectText = false, stickers = false, stickerFolder = null,
    focus = "", note = null, speed = 1.0,
    logoPath = null, logoPos = "br", logoScale = 0.16, logoOpacity = 0.9, logoX = null, logoY = null,
    sfx = false, sfxVol = 0.6, makeThumb = true, ctaPath = null,
    thumbStyle = "frame", thumbPhotoDir = null, thumbName = "",
    musicVol = 0.18,
    fontId = DEFAULTS.fontId, noText = false,   // 🔤 font chữ · 🚫 không chữ (xem lib/fonts.mjs)
    // 🆕 PHA DUYỆT (2 pha): planOnly = chỉ CHỌN đoạn (không render) để anh duyệt trước.
    // clipsIn = danh sách đoạn ĐÃ DUYỆT (bỏ qua AI, render thẳng theo mốc anh chốt).
    // transcriptIn = tái dùng transcript đã lưu (khỏi gõ chữ lại).
    planOnly = false, clipsIn = null, transcriptIn = null,
    // 🆕 Điều khiển ĐỘ DÀI & "đủ ý": clipMinSec/clipMaxSec (giây), preferComplete = ưu tiên kéo trọn mạch.
    clipMinSec = 0, clipMaxSec = 0, preferComplete = false,
  } = opts;

  const useApproved = Array.isArray(clipsIn) && clipsIn.length > 0;
  // Trần/sàn độ dài đoạn: anh chỉnh trên giao diện; preferComplete nâng sàn để đủ ý.
  const MIN_SEC = clipMinSec > 0 ? clipMinSec : (preferComplete ? 24 : 16);
  const MAX_SEC = clipMaxSec > 0 ? clipMaxSec : 150;
  const snapOpts = { minSec: MIN_SEC, maxSec: MAX_SEC };

  const meta0 = await probe(input);
  onLog(`=== BỘ NÃO SĂN KHOẢNH KHẮC ===`);
  onLog(`Video dài ${Math.round(meta0.duration)}s (${(meta0.duration / 60).toFixed(1)} phút).`);

  // Mỗi LẦN CẮT = một THƯ MỤC RIÊNG trong work/out (ngày-giờ-tên video) cho gọn gàng.
  const RUN_OUT = path.join(OUT, `${runStamp()}-${slug(path.basename(input).replace(/\.[^.]+$/, "")) || "video"}`);
  fs.mkdirSync(RUN_OUT, { recursive: true });
  onLog(`📁 Thư mục xuất lần này: ${path.basename(RUN_OUT)}`);

  // 1) Gõ chữ toàn video (1 lần duy nhất) — HOẶC tái dùng transcript đã lưu (pha render/duyệt lại).
  let words = [], segments = [], transcriptFile = null;
  if (transcriptIn && fs.existsSync(transcriptIn)) {
    onLog("→ Bước 1/4: tái dùng transcript đã lưu (khỏi gõ chữ lại)...");
    try {
      const t = JSON.parse(fs.readFileSync(transcriptIn, "utf-8"));
      words = t.words || []; segments = t.segments || []; transcriptFile = transcriptIn;
      onLog(`  xong (tái dùng): ${words.length} từ, ${segments.length} câu.`);
    } catch (e) { onLog("  ⚠ đọc transcript cũ lỗi, sẽ gõ lại: " + e.message); }
  }
  if (!segments.length) {
    onLog("→ Bước 1/4: gõ chữ toàn bộ video (word-level)... có thể lâu với video dài.");
    const tr = await transcribeWords(input, { model, lang, onLog: (l) => onLog("  " + l) });
    words = tr.words || [];
    segments = tr.segments || [];
    onLog(`  xong: ${words.length} từ, ${segments.length} câu.`);
  }
  if (!segments.length) throw new Error("Không nghe được lời trong video (transcript rỗng).");

  // Lưu transcript ĐẦY ĐỦ ra file → để lớp Tinh chỉnh/Duyệt dựng lại 1 short (đổi mốc cắt / sửa
  // phụ đề) mà KHÔNG phải gõ chữ lại. Bám theo id job nên mỗi lần cắt có 1 file riêng.
  if (!transcriptFile) {
    transcriptFile = path.join(RUN_OUT, `${id}-transcript.json`);
    try {
      fs.writeFileSync(transcriptFile, JSON.stringify({ source: input, duration: meta0.duration, words, segments }));
      onLog(`  💾 lưu transcript để tinh chỉnh: ${path.basename(transcriptFile)}`);
    } catch (e) { onLog("  ⚠ không lưu được transcript: " + e.message); }
  }

  // 2) CHỌN ĐOẠN — hoặc dùng danh sách anh ĐÃ DUYỆT, hoặc để AI chấm.
  let clips;
  if (useApproved) {
    // Pha RENDER: render đúng các đoạn anh chốt (giữ nguyên mốc anh đã kéo, KHÔNG canh lại).
    onLog(`→ Bước 2/4: dùng ${clipsIn.length} đoạn ANH ĐÃ DUYỆT (bỏ qua AI).`);
    clips = clipsIn
      .map((c) => ({
        start: Math.max(0, Number(c.start) || 0),
        end: Math.min(meta0.duration, Number(c.end) || 0),
        score: Number(c.score) || 0,
        title: (c.title || "Khoảnh khắc đắt giá").toString().slice(0, 120).trim(),
        hook: (c.hook || "").toString().slice(0, 40).trim(),
        caption: (c.caption || "").toString().trim(),
        philosophy: (c.philosophy || "").toString().trim(),
        reason: (c.reason || "").toString().trim(),
        concept: (c.concept || "").toString().slice(0, 120).trim(),
        transformation: (c.transformation || "").toString().slice(0, 240).trim(),
        emotion: (c.emotion || "").toString().slice(0, 30).trim(),
        emotionScore: Number(c.emotionScore) || 0,
        climax: (c.climax || "").toString().slice(0, 240).trim(),
        climaxTime: c.climaxTime != null ? Number(c.climaxTime) : null,
      }))
      .filter((c) => c.end - c.start >= 1)
      .sort((a, b) => a.start - b.start);
  } else {
    onLog("→ Bước 2/4: AI chấm & chọn đoạn đắt giá (triết lý + viral)...");
    if (preferComplete) onLog(`  ⭐ Ưu tiên ĐỦ Ý: kéo trọn mạch nói (mỗi đoạn ≥ ${MIN_SEC}s, tối đa ${MAX_SEC}s).`);
    const brand = brandRubric();
    const chunks = chunkSegments(segments);
    onLog(`  chia transcript thành ${chunks.length} phần để phân tích.`);
    const floor = Math.min(50, Number(minScore) || 68);
    let raw = [];
    for (let i = 0; i < chunks.length; i++) {
      onLog(`  phân tích phần ${i + 1}/${chunks.length}...`);
      try {
        const ans = await askClaude(buildSelectPrompt(chunks[i].join("\n"), brand, floor, focus, { preferComplete, minSec: MIN_SEC, maxSec: MAX_SEC }), { onLog: (l) => onLog("    " + l), cache: true, model: "claude-sonnet-4-6", timeoutMs: 420000 });
        const got = parseClips(ans);
        onLog(`    → AI trả ${(ans || "").length} ký tự, đọc được ${got.length} ứng viên.`);
        if (!got.length && ans) onLog(`    (mẫu AI: ${String(ans).replace(/\s+/g, " ").slice(0, 160)})`);
        raw = raw.concat(got);
      } catch (e) { onLog("    ⚠ AI lỗi phần này: " + e.message); }
    }

    // Số short: 0/để trống = KHÔNG GIỚI HẠN → tự scale theo độ dài (~6 short/phút là trần an toàn).
    const capClips = (maxClips && maxClips > 0) ? maxClips : Math.max(20, Math.ceil(meta0.duration / 60 * 6));
    if (!(maxClips > 0)) onLog(`  Số short: TỰ ĐỘNG theo độ dài video (trần an toàn ~${capClips}). Lấy đủ mọi trọng điểm giá trị.`);

    // Chốt đoạn: thử ngưỡng anh chọn, RỖNG thì tự hạ dần rồi mới dùng dự phòng.
    const normOpts = { minScore, maxClips: capClips, minSec: MIN_SEC, maxSec: MAX_SEC };
    clips = normalizeClips(raw, meta0.duration, normOpts);
    if (!clips.length && raw.length) {
      for (const ms of [minScore - 10, 45, 30, 0]) {
        clips = normalizeClips(raw, meta0.duration, { ...normOpts, minScore: ms });
        if (clips.length) { onLog(`  (hạ ngưỡng xuống ${ms} → có ${clips.length} đoạn)`); break; }
      }
    }
    if (!clips.length) {
      onLog("  ⚠ AI không chọn được đoạn nào → DÙNG DỰ PHÒNG: chia theo câu nói.");
      clips = heuristicClips(segments, meta0.duration, { maxClips: Math.min(capClips, 12) });
    }
  }
  onLog(`  CHỐT ${clips.length} đoạn để dựng short.`);
  if (!clips.length) throw new Error("Video hầu như không có lời nói liền mạch để cắt (transcript quá thưa). Kiểm tra tiếng trong video có rõ không, hoặc thử video khác.");

  // 🆕 PHA DUYỆT: chỉ CHỌN (canh câu + trích phụ đề đoạn) rồi TRẢ VỀ cho anh duyệt — KHÔNG render.
  if (planOnly) {
    const preview = clips.map((c) => {
      const span = snapClip(segments, c.start, c.end, meta0.duration, snapOpts);
      const seg = shiftTranscript(words, segments, span.start, span.end).segments;
      const climaxRel = (c.climaxTime != null && c.climaxTime >= span.start && c.climaxTime <= span.end)
        ? +(c.climaxTime - span.start).toFixed(2) : null;
      return {
        ...c, sourceStart: span.start, sourceEnd: span.end,
        duration: +(span.end - span.start).toFixed(2),
        segments: seg, previewText: seg.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim(),
        climaxAtSec: climaxRel,
      };
    });
    onLog(`\n=== PHA DUYỆT XONG: ${preview.length} đoạn đề xuất — chờ anh duyệt rồi mới render. ===`);
    return {
      planOnly: true, source: input, transcriptFile,
      sourceDuration: meta0.duration, durationSec: Math.round(meta0.duration),
      totalWords: words.length, picked: preview.length, outDir: RUN_OUT, clips: preview,
      editOpts: { reframe, captionStyle, colorLevel, punch, shake, film, progress, voiceClean, smooth, burnHook, speed },
    };
  }

  // 3+4) Dựng từng short: cắt sạch đệm → biên tập viral → xuất + caption
  const useGpu = await hasNvenc();
  onLog(`→ Bước 3/4: dựng ${clips.length} short (${useGpu ? "GPU" : "CPU"})...`);
  const results = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const tag = `[${i + 1}/${clips.length}]`;
    onLog(`\n${tag} "${c.title}"  (${fmtMS(c.start)}–${fmtMS(c.end)}, điểm ${c.score})`);
    try {
      // Canh theo câu (đủ ý, kết có hậu) rồi trích MẠCH LIỀN → tiếng khớp hình tuyệt đối.
      // Đoạn ĐÃ DUYỆT → giữ NGUYÊN mốc anh chốt (không canh lại). Còn lại → canh câu theo min/max.
      const span = useApproved
        ? { start: Math.max(0, c.start), end: Math.min(meta0.duration, c.end) }
        : snapClip(segments, c.start, c.end, meta0.duration, snapOpts);
      const rough = path.join(WORK, `${id}-c${i}-rough.mp4`);
      onLog(`  ✂ trích mạch liền ${fmtMS(span.start)}–${fmtMS(span.end)} (${(span.end - span.start).toFixed(0)}s, canh trọn câu)...`);
      await extractSpan(input, span.start, span.end - span.start, rough, onLog);

      const pre = shiftTranscript(words, segments, span.start, span.end);
      const base = slug(c.title) || `clip-${i + 1}`;
      const outPath = path.join(RUN_OUT, `${String(i + 1).padStart(2, "0")}-${base}-${Date.now()}.mp4`);

      // 🔥 Mốc CÂU CAO TRÀO tương đối trong short (video gốc → dời về đầu short) để NHẤN
      // (zoom chậm đẩy vào + nhạc dâng). Chỉ khi mốc nằm trong đoạn đã cắt.
      const climaxRel = (c.climaxTime != null && c.climaxTime >= span.start && c.climaxTime <= span.end)
        ? +(c.climaxTime - span.start).toFixed(2) : null;

      // KHÔNG nướng logo/nhạc ở đây — để anh chỉnh SAU rồi bám khi tải (finalize).
      const r = await autoEdit(rough, {
        onLog: (l) => onLog("  " + l), id: `${id}-c${i}`, outPath,
        doCutSilence: false, // mạch liền, không cắt trong
        reframe, doCaptions: true, captionStyle, fontId, noText,
        colorLevel, manual, smooth, sharpen, voiceClean, punch, shake, film, progress, flash, brollTransition,
        brollFolder, brollFill, aiBroll, aiBrollCount, normalize, aiCorrectText,
        sfx, sfxVol, stickers, stickerFolder, speed,
        // Nhạc nền upfront: nếu anh chèn nhạc ở tab Cắt tự động → BÁM vào từng short
        // (autoEdit tự aloop=loop=-1 nên nhạc ngắn hơn video sẽ TỰ LẶP).
        musicPath: musicPath || null, musicVol,
        preTranscript: pre,
        hookText: burnHook ? (c.hook || c.title) : null,
        climaxAtSec: climaxRel,   // 🔥 nhấn cao trào (zoom chậm + nhạc dâng) tại câu đắt nhất
        ctaPath,   // CTA cuối video (③ CTA hoặc assets/cta.mp4) — mọi short đều có CTA
      });
      // cập nhật mốc nguồn theo span đã canh (để .txt + UI hiển thị đúng)
      c.start = span.start; c.end = span.end;

      // ⏩ Short đã TĂNG TỐC → co giãn mốc phụ đề theo (chữ trong video đã nén theo tốc độ,
      // nên timeline/điểm kỹ thuật/segments trả về UI cũng phải cùng thang thời gian).
      const spUsed = Math.max(0.5, Math.min(3, Number(speed) || 1));
      const preOut = Math.abs(spUsed - 1) > 0.01 ? scaleTranscript(pre, spUsed) : pre;

      // 📊 ĐIỂM KỸ THUẬT (6 trục: hook/nhịp/giữ chân/âm thanh/định dạng/phụ đề) cho short vừa dựng.
      // KHÁC "Điểm nội dung" (c.score do AI chấm triết lý+viral+cảm xúc). Tái dùng transcript
      // đã có (pre) → KHÔNG gõ chữ lại. Fail an toàn: lỗi thì bỏ điểm này, không chặn short.
      let tech = null;
      if (scoreClips) {
        try {
          tech = await evaluate(outPath, { doTranscript: false, preTranscript: preOut, onLog: () => {} });
          onLog(`  📊 điểm kỹ thuật: ${tech.overall}/100 — ${tech.verdict}`);
        } catch (e) { onLog("  ⚠ chấm điểm kỹ thuật lỗi: " + e.message); }
      }

      // Thumbnail: bản THƯƠNG HIỆU (nền đỏ + ảnh chân dung + tiêu đề) nếu có thư mục ảnh,
      // ngược lại dùng bản trích khung từ short.
      let thumbPath = null;
      if (makeThumb) {
        try {
          if (thumbStyle === "brand" && thumbPhotoDir) {
            const photo = pickPhoto(thumbPhotoDir, c.title || c.hook || String(i));
            if (!photo) throw new Error("thư mục ảnh trống hoặc không đọc được: " + thumbPhotoDir);
            thumbPath = outPath.replace(/\.mp4$/, "-thumb.png");
            await makeBrandThumb(photo, c.title || c.hook || "Video", thumbPath, { name: thumbName, id: `${id}-c${i}`, onLog });
          } else {
            thumbPath = outPath.replace(/\.mp4$/, "-thumb.jpg");
            const dd = r.meta.duration || 6;
            await makeThumbnail(outPath, c.hook || c.title, thumbPath, { id: `${id}-c${i}`, atSec: Math.min(dd - 0.5, Math.max(5, dd * 0.35)), fontId });
          }
          onLog(`  🖼️ thumbnail: ${path.basename(thumbPath)}`);
        } catch (e) { onLog("  ⚠ thumbnail lỗi: " + e.message); thumbPath = null; }
      }

      // File caption gợi ý cạnh video
      const txt = `TIÊU ĐỀ: ${c.title}
TRỌNG ĐIỂM: ${c.concept || c.philosophy || "?"}
NGƯỜI XEM CHUYỂN HÓA: ${c.transformation || "?"}
HOOK (chữ đầu video): ${c.hook}

CAPTION ĐĂNG BÀI:
${appendBrandTags(c.caption)}

TRIẾT LÝ / INSIGHT: ${c.philosophy}
CẢM XÚC: ${c.emotion || "?"}${c.emotionScore ? ` (${c.emotionScore}/100)` : ""}
CÂU CAO TRÀO: ${c.climax || "?"}${c.climaxTime != null ? ` [${fmtMS(c.climaxTime)}]` : ""}
VÌ SAO VIRAL: ${c.reason}
ĐIỂM NỘI DUNG (AI chấm triết lý+viral+cảm xúc): ${c.score}/100${tech ? `
ĐIỂM KỸ THUẬT (6 trục hook/nhịp/giữ chân/âm thanh/định dạng/phụ đề): ${tech.overall}/100 — ${tech.verdict}` : ""}
Nguồn: ${fmtMS(c.start)}–${fmtMS(c.end)} của video gốc
`;
      fs.writeFileSync(outPath.replace(/\.mp4$/, ".txt"), txt, "utf-8");
      try { fs.unlinkSync(rough); } catch { /* dọn tạm */ }

      onLog(`  ✅ xong: ${path.basename(outPath)} (${r.meta.duration.toFixed(0)}s)`);
      results.push({
        ...c, outPath, txtPath: outPath.replace(/\.mp4$/, ".txt"), thumbPath, duration: r.meta.duration,
        // Dữ liệu cho lớp Tinh chỉnh: mốc trong video GỐC + phụ đề đã dời về 0 (co giãn theo tốc độ).
        sourceStart: span.start, sourceEnd: span.end, segments: preOut.segments || [],
        climaxAtSec: climaxRel,   // đã tính ở trên (dùng cho cả nhấn cao trào + marker timeline)
        // Điểm kỹ thuật (song song điểm nội dung c.score) — để UI hiện 2 điểm.
        techScore: tech ? tech.overall : null,
        techVerdict: tech ? tech.verdict : null,
      });
    } catch (e) {
      onLog(`  ❌ lỗi đoạn này: ${e.message}`);
      results.push({ ...c, error: e.message });
    }
  }

  onLog(`\n=== XONG: ${results.filter((r) => !r.error).length}/${clips.length} short ===`);
  return {
    source: input,
    sourceDuration: meta0.duration,
    durationSec: Math.round(meta0.duration),
    totalWords: words.length,
    picked: clips.length,
    outDir: RUN_OUT,
    clips: results,
    // Cho lớp Tinh chỉnh: file transcript + bộ hiệu ứng đã dùng (để seed panel sửa).
    transcriptFile,
    editOpts: { reframe, captionStyle, colorLevel, punch, shake, film, progress, voiceClean, smooth, burnHook, speed },
  };
}

// Đổi text phụ đề đã sửa vào transcript đã dời-về-0.
// - Câu KHÔNG đổi: giữ nguyên timing word-level gốc (karaoke chuẩn xác).
// - Câu ĐÃ sửa: chia đều các từ mới trong khoảng thời gian của câu (để karaoke vẫn chạy).
// - Câu để TRỐNG: bỏ (ẩn phụ đề đoạn đó).
function applyEditedSegments(shifted, editedTexts) {
  if (!editedTexts) return shifted;
  const words = [], segs = [];
  (shifted.segments || []).forEach((s, i) => {
    const orig = (s.text || "").trim();
    const edited = editedTexts[i] != null ? String(editedTexts[i]).trim() : orig;
    if (!edited) return; // câu bị xoá → ẩn
    if (edited === orig) {
      words.push(...(shifted.words || []).filter((w) => w.end > s.start - 0.01 && w.start < s.end + 0.01));
      segs.push({ start: s.start, end: s.end, text: orig });
    } else {
      const toks = edited.split(/\s+/).filter(Boolean);
      const span = Math.max(0.2, s.end - s.start);
      const per = span / toks.length;
      toks.forEach((w, k) => words.push({ start: +(s.start + k * per).toFixed(3), end: +(s.start + (k + 1) * per).toFixed(3), word: w }));
      segs.push({ start: s.start, end: s.end, text: edited });
    }
  });
  return { words, segments: segs, duration: shifted.duration };
}

// 🔁 DỰNG LẠI 1 SHORT theo tinh chỉnh: đổi mốc cắt (trim), sửa phụ đề, bật/tắt hiệu ứng.
// KHÔNG gõ chữ lại (đọc transcript đã lưu), KHÔNG nướng logo/nhạc (để lớp finalize làm sau).
export async function reclip(opts = {}) {
  const {
    onLog = () => {}, id = "rc", source, transcriptFile,
    start, end, segments: editedTexts = null,
    reframe = "blur", captionStyle = "karaoke", colorLevel = "off",
    punch = false, film = true, progress = true, doCaptions = true,
    voiceClean = "off", smooth = "off", hookText = null,
    speed = 1, overlayText = null, overlayPos = "bottom",
    fontId = DEFAULTS.fontId, noText = false,
  } = opts;

  if (!source || !fs.existsSync(source)) throw new Error("không thấy video nguồn để dựng lại");
  const meta0 = await probe(source);
  const s = Math.max(0, Math.min(meta0.duration - 0.5, Number(start)));
  const e = Math.max(s + 1, Math.min(meta0.duration, Number(end)));

  let words = [], segs = [];
  try {
    if (transcriptFile && fs.existsSync(transcriptFile)) {
      const t = JSON.parse(fs.readFileSync(transcriptFile, "utf-8"));
      words = t.words || []; segs = t.segments || [];
    }
  } catch (err) { onLog("⚠ đọc transcript lỗi: " + err.message); }

  let pre = shiftTranscript(words, segs, s, e);
  pre = applyEditedSegments(pre, editedTexts);

  let rough = path.join(WORK, `${id}-rough.mp4`);
  onLog(`✂ trích lại ${fmtMS(s)}–${fmtMS(e)} (${(e - s).toFixed(1)}s) từ video gốc...`);
  await extractSpan(source, s, e - s, rough, onLog);

  // Đổi tốc độ (nếu ≠ 1×): re-encode nhanh/chậm + co giãn mốc phụ đề để karaoke vẫn khớp.
  const sp = Math.max(0.5, Math.min(2.0, Number(speed) || 1));
  if (Math.abs(sp - 1) > 0.01) {
    onLog(`⏩ đổi tốc độ ${sp.toFixed(2)}×...`);
    const spun = path.join(WORK, `${id}-speed.mp4`);
    await applySpeed(rough, sp, spun, onLog);
    try { fs.unlinkSync(rough); } catch { /* dọn */ }
    rough = spun;
    pre = scaleTranscript(pre, sp);
  }

  // Ghi bản dựng lại vào ĐÚNG thư mục lần cắt (cạnh transcript), không rải ra out gốc.
  const runDir = (transcriptFile && fs.existsSync(transcriptFile)) ? path.dirname(transcriptFile) : OUT;
  const outPath = path.join(runDir, `refine-${id}-${Date.now()}.mp4`);
  const r = await autoEdit(rough, {
    onLog: (l) => onLog(l), id: `${id}-e`, outPath,
    doCutSilence: false, reframe, doCaptions: doCaptions !== false, captionStyle, fontId, noText,
    colorLevel, punch, shake: false, film, progress, flash: false,
    voiceClean, smooth, normalize: true,
    preTranscript: pre, hookText: hookText || null,
    overlayText: overlayText || null, overlayPos: overlayPos || "bottom",
  });
  try { fs.unlinkSync(rough); } catch { /* dọn tạm */ }

  return {
    outPath, meta: r.meta,
    sourceStart: s, sourceEnd: e, duration: +(r.meta.duration || (e - s)).toFixed(2),
    segments: pre.segments || [],
  };
}
