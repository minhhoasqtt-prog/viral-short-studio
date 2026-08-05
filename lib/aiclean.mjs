// Sửa ĐỘ CHÍNH XÁC của phụ đề bằng AI: whisper hay ra từ sai/vô nghĩa (nhất là tiếng Việt).
// Gửi transcript theo câu cho Claude sửa lại cho ĐÚNG NGHĨA, bỏ từ không rõ, rồi PHÂN BỔ LẠI
// mốc thời gian từng từ trong mỗi câu (giữ karaoke khớp ~đúng) — không cần whisper lại.
import { askClaude } from "./ai.mjs";

// Chia câu thành mảnh để gửi (giới hạn ký tự).
function chunk(segments, maxChars = 3500) {
  const chunks = [];
  let cur = [], len = 0;
  segments.forEach((s, i) => {
    const line = `${i}\t${(s.text || "").replace(/\s+/g, " ").trim()}`;
    if (len + line.length > maxChars && cur.length) { chunks.push(cur); cur = []; len = 0; }
    cur.push({ i, s }); len += line.length + 1;
  });
  if (cur.length) chunks.push(cur);
  return chunks;
}

function buildPrompt(items, lang) {
  const body = items.map(({ i, s }) => `${i}\t${(s.text || "").replace(/\s+/g, " ").trim()}`).join("\n");
  return `Đây là phụ đề tự động (${lang === "vi" ? "tiếng Việt" : lang}) gõ máy từ giọng nói, CÓ THỂ SAI: từ vô nghĩa, sai chính tả, nghe nhầm, lẫn tiếng Anh.
NHIỆM VỤ: với MỖI dòng (định dạng "index<TAB>nội dung"), sửa lại cho ĐÚNG CHÍNH TẢ và ĐÚNG NGHĨA tiếng Việt tự nhiên, GIỮ NGUYÊN ý và độ dài tương đương.
- Từ/cụm vô nghĩa hoặc không đoán được nghĩa thì BỎ HẲN (đừng bịa).
- KHÔNG thêm ý mới, KHÔNG dịch sang ngôn ngữ khác, KHÔNG thêm dấu câu thừa.
- Giữ tên riêng, thuật ngữ hợp lý.

DÒNG:
"""
${body}
"""

Trả về DUY NHẤT một mảng JSON hợp lệ (không giải thích, không markdown), mỗi phần tử: {"i":<index>,"t":"<nội dung đã sửa; chuỗi rỗng nếu nên bỏ cả câu>"}.`;
}

function parseArr(text) {
  if (!text) return [];
  let t = text.trim().replace(/```json/gi, "```").replace(/```/g, "");
  const a = t.indexOf("["), b = t.lastIndexOf("]");
  if (a === -1 || b === -1 || b < a) return [];
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return []; }
}

// Phân bổ text đã sửa thành các từ có mốc thời gian trong [start,end] của câu.
function redistribute(seg, corrected) {
  const words = String(corrected || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const dur = Math.max(0.2, seg.end - seg.start);
  const totalChars = words.reduce((s, w) => s + w.length + 1, 0);
  let t = seg.start;
  const out = [];
  for (const w of words) {
    const wdur = dur * ((w.length + 1) / totalChars);
    out.push({ start: +t.toFixed(3), end: +(t + wdur).toFixed(3), word: " " + w });
    t += wdur;
  }
  return out;
}

// Sửa cả transcript. Trả về transcript MỚI {words, segments, duration}. Lỗi → trả nguyên bản.
export async function correctTranscript(tr, { onLog = () => {}, lang = "vi" } = {}) {
  const segs = tr?.segments || [];
  if (!segs.length) return tr;
  onLog("→ AI soát & sửa chính tả phụ đề (bỏ từ vô nghĩa)...");
  const fixed = new Map();
  for (const items of chunk(segs)) {
    try {
      const ans = await askClaude(buildPrompt(items, lang), { onLog: () => {}, cache: true });
      for (const r of parseArr(ans)) {
        if (r && typeof r.i === "number") fixed.set(r.i, String(r.t ?? ""));
      }
    } catch (e) { onLog("  ⚠ AI sửa 1 phần lỗi: " + e.message); }
  }
  if (!fixed.size) { onLog("  (không sửa được — giữ nguyên)"); return tr; }

  const newSegs = [], newWords = [];
  let dropped = 0;
  segs.forEach((s, i) => {
    const corrected = fixed.has(i) ? fixed.get(i) : (s.text || "");
    const ws = redistribute(s, corrected);
    if (!ws.length) { dropped++; return; } // câu bị bỏ
    newWords.push(...ws);
    newSegs.push({ start: ws[0].start, end: ws[ws.length - 1].end, text: ws.map((w) => w.word.trim()).join(" "), words: ws });
  });
  onLog(`  đã sửa ${fixed.size} câu, bỏ ${dropped} câu không rõ nghĩa.`);
  return { words: newWords, segments: newSegs, duration: tr.duration, language: tr.language };
}
