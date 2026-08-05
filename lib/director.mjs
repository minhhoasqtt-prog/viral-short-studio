// 📝 "ĐẠO DIỄN" — đọc GHI CHÚ / LỆNH bằng lời của người dùng rồi dịch thành CÀI ĐẶT biên tập.
// Trả về object chỉ gồm các key HỢP LỆ (whitelist) để ghi đè tuỳ chọn trước khi dựng.
import { askClaude } from "./ai.mjs";

const ALLOWED = {
  colorLevel: ["clean", "medium", "high", "low", "off"],
  brollTransition: ["fade", "slide", "slideup"],
  captionStyle: ["karaoke", "word", "line"],
};
const BOOL = ["removeFillers", "smartPrune", "sfx", "stickers", "film", "punch", "shake", "flash", "aiCorrectText", "doCaptions", "aiBroll"];

function clampInt(v, lo, hi) { const n = Math.round(Number(v)); return isNaN(n) ? null : Math.max(lo, Math.min(hi, n)); }

function buildPrompt(note) {
  return `Người dùng RA LỆNH cách biên tập một video ngắn/viral. Hãy dịch mệnh lệnh thành CÀI ĐẶT máy hiểu.
LỆNH CỦA NGƯỜI DÙNG:
"""${note}"""

CHỈ trả về DUY NHẤT một JSON hợp lệ (không giải thích ngoài JSON, không markdown). Chỉ đưa vào các khoá mà lệnh CÓ ĐỀ CẬP (khoá không nhắc tới thì BỎ, đừng bịa):
{
  "colorLevel": "clean|medium|high|low|off",      // tông màu: trong trẻo/điện ảnh/đậm/nhẹ/tắt
  "sharpen": 0-100,                                  // độ nét
  "speed": 1.0-3.0,                                  // tốc độ video (1=thường, 1.5, 2, 3...)
  "brollTransition": "fade|slide|slideup",          // kiểu chuyển cảnh
  "removeFillers": true/false,                       // cắt tiếng đệm à/ừ + khoảng chết
  "smartPrune": true/false,                          // bỏ chào hỏi/lan man, chỉ giữ phần giá trị (video dài)
  "sfx": true/false,                                 // hiệu ứng âm thanh whoosh
  "stickers": true/false,                            // nhãn/sticker động
  "film": true/false,                                // vignette + grain
  "punch": true/false,                               // zoom giật theo nhịp
  "flash": true/false,                               // flash chuyển cảnh
  "aiCorrectText": true/false,                       // AI sửa chính tả phụ đề
  "doCaptions": true/false,                          // có phụ đề hay không
  "hookText": "chuỗi hook chữ to đầu video hoặc bỏ trống",
  "musicMood": "mô tả loại nhạc muốn (vd: sôi động, nhẹ nhàng) hoặc bỏ",
  "focus": "TÓM TẮT 1-2 câu: nội dung/đoạn cần GIỮ & nhấn mạnh theo ý người dùng (để AI chọn đoạn đúng ý)",
  "explain": "1 câu ngắn tiếng Việt tóm tắt bạn đã hiểu lệnh thế nào"
}`;
}

// Lọc kết quả về đúng whitelist + kiểu dữ liệu.
function sanitize(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, allowed] of Object.entries(ALLOWED)) {
    if (typeof obj[k] === "string" && allowed.includes(obj[k])) out[k] = obj[k];
  }
  for (const k of BOOL) if (typeof obj[k] === "boolean") out[k] = obj[k];
  const sh = clampInt(obj.sharpen, 0, 100); if (sh != null) out.sharpen = sh;
  const sp = Number(obj.speed); if (!isNaN(sp) && sp >= 0.5 && sp <= 3) out.speed = Math.round(sp * 100) / 100;
  if (typeof obj.hookText === "string" && obj.hookText.trim()) out.hookText = obj.hookText.trim().slice(0, 60);
  if (typeof obj.musicMood === "string" && obj.musicMood.trim()) out.musicMood = obj.musicMood.trim().slice(0, 80);
  if (typeof obj.focus === "string" && obj.focus.trim()) out.focus = obj.focus.trim().slice(0, 400);
  if (typeof obj.explain === "string" && obj.explain.trim()) out.explain = obj.explain.trim().slice(0, 200);
  return out;
}

function parseJSON(text) {
  if (!text) return null;
  let t = text.trim().replace(/```json/gi, "```").replace(/```/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

// Đọc ghi chú → trả cài đặt đã lọc. Lỗi/không có note → {}.
export async function interpretNote(note, { onLog = () => {} } = {}) {
  const n = String(note || "").trim();
  if (!n) return {};
  onLog("📝 Đọc ghi chú / lệnh của bạn...");
  let raw;
  try { raw = await askClaude(buildPrompt(n), { onLog: () => {}, cache: true }); }
  catch (e) { onLog("  ⚠ Không đọc được lệnh (" + e.message + ") → dùng cài đặt thường"); return {}; }
  const s = sanitize(parseJSON(raw));
  if (s.explain) onLog("  → Hiểu lệnh: " + s.explain);
  const applied = Object.keys(s).filter((k) => !["focus", "explain", "musicMood"].includes(k));
  if (applied.length) onLog("  → Áp dụng: " + applied.join(", "));
  return s;
}
