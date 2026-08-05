// 🔤 KHO FONT CHỮ — nguồn sự thật duy nhất cho MỌI chữ đắp lên video
// (phụ đề, hook, chữ tay, tiêu đề thumbnail).
//
// Vì sao có file này: trước đây mọi builder ASS hardcode Fontname = "Arial"
// → chữ Việt xấu, không đúng nhận diện. Nay:
//   • Bỏ file .otf/.ttf vào  assets/fonts/  → phần mềm TỰ THẤY, tự đọc tên
//     family thật trong font (bảng `name`), tự hiện lên giao diện.
//   • KHÔNG cần cài font vào Windows: khi đốt chữ, ffmpeg được trỏ
//     `ass=...:fontsdir=../assets/fonts` (mọi lệnh render đều chạy cwd = work/).
//   • Chọn 1 font cho cả job; chữ TO (hook/thumbnail) tự lấy biến thể ĐẬM NHẤT
//     cùng họ, chữ phụ đề lấy đúng biến thể người dùng chọn.
import fs from "node:fs";
import path from "node:path";
import { ASSETS, WORK } from "./util.mjs";

export const FONTS_DIR = path.join(ASSETS, "fonts");
try { fs.mkdirSync(FONTS_DIR, { recursive: true }); } catch { /* có rồi */ }

// Đường dẫn TƯƠNG ĐỐI từ work/ → assets/fonts (tránh phải escape đường dẫn ổ đĩa trong filtergraph).
export const FONTS_DIR_REL = path.relative(WORK, FONTS_DIR).split(path.sep).join("/");

// Cân nặng → điểm số, để chọn biến thể đậm nhất cùng họ cho chữ TO.
const WEIGHTS = { thin: 100, light: 300, regular: 400, book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, heavy: 900, black: 900 };

// Đọc bảng `name` của TTF/OTF để lấy TÊN HỌ THẬT (libass khớp theo tên này, không theo tên file).
function readFontNames(file) {
  const b = fs.readFileSync(file);
  if (b.length < 12) return null;
  const numTables = b.readUInt16BE(4);
  let off = null;
  for (let i = 0; i < numTables; i++) {
    const p = 12 + i * 16;
    if (p + 16 > b.length) break;
    if (b.toString("latin1", p, p + 4) === "name") off = b.readUInt32BE(p + 8);
  }
  if (off == null || off + 6 > b.length) return null;
  const count = b.readUInt16BE(off + 2);
  const strOff = off + b.readUInt16BE(off + 4);
  const names = {};
  for (let i = 0; i < count; i++) {
    const p = off + 6 + i * 12;
    if (p + 12 > b.length) break;
    const platform = b.readUInt16BE(p);
    const nameId = b.readUInt16BE(p + 6);
    const len = b.readUInt16BE(p + 8);
    const o = b.readUInt16BE(p + 10);
    const raw = b.slice(strOff + o, strOff + o + len);
    // platform 3 (Windows) = UTF-16BE; còn lại coi như latin1.
    const val = platform === 3 ? Buffer.from(raw).swap16().toString("utf16le") : raw.toString("latin1");
    if (!names[nameId]) names[nameId] = val.replace(/\0/g, "").trim();
  }
  return names;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let _cache = null;

// Quét assets/fonts → danh mục font dùng được. Kết quả cache trong RAM (bỏ file mới thì restart).
export function scanFonts(force = false) {
  if (_cache && !force) return _cache;
  const items = [];
  let files = [];
  try { files = fs.readdirSync(FONTS_DIR).filter((f) => /\.(otf|ttf)$/i.test(f)); } catch { files = []; }
  for (const f of files) {
    let names = null;
    try { names = readFontNames(path.join(FONTS_DIR, f)); } catch { names = null; }
    const family = (names && names[1]) || path.basename(f).replace(/\.(otf|ttf)$/i, "");
    // Họ gốc: ưu tiên "typographic family" (id 16) nếu sạch; fallback = bỏ đuôi cân nặng khỏi family.
    const base = String(names?.[16] || "").match(/^[\x20-\x7E]+$/) ? names[16] : family.replace(/\s+(Thin|Light|Regular|Book|Medium|SemiBold|DemiBold|Bold|ExtraBold|Heavy|Black)$/i, "");
    const wName = String(names?.[17] || family.replace(base, "") || "Regular").trim() || "Regular";
    const weight = WEIGHTS[wName.toLowerCase().replace(/\s+/g, "")] ?? 400;
    items.push({
      id: slug(path.basename(f).replace(/\.(otf|ttf)$/i, "")),
      file: f,
      family,          // ← Fontname ghi vào ASS
      base: base.trim(),
      weightName: wName,
      weight,
      // Font đã có sẵn nét đậm riêng (Bold/Black) → KHÔNG bật cờ Bold của ASS
      // (bật sẽ bị "fake bold" nhoè chữ).
      bold: weight >= 600 ? 0 : -1,
      label: `${base.trim()} ${wName}`.trim(),
    });
  }
  items.sort((a, b) => a.base.localeCompare(b.base) || a.weight - b.weight);
  _cache = items;
  return items;
}

// Danh sách gửi lên giao diện: font hệ thống (an toàn, luôn có) + font trong kho.
export function listFonts() {
  const custom = scanFonts();
  const system = [
    { id: "arial", family: "Arial", base: "Arial", label: "Arial (mặc định hệ thống)", weight: 400, bold: -1, system: true },
  ];
  return [...custom, ...system];
}

// Chọn font cho từng vai trò chữ.
//  role = "caption" → đúng biến thể đã chọn
//  role = "hook" | "thumb" | "overlay" → biến thể ĐẬM NHẤT cùng họ (chữ to phải dày mới nổi)
export function resolveFont(fontId, role = "caption") {
  const all = listFonts();
  const pick = all.find((f) => f.id === fontId) || all.find((f) => f.id === "arial");
  if (!pick || pick.system) return { fontName: pick?.family || "Arial", bold: -1 };
  if (role === "caption") return { fontName: pick.family, bold: pick.bold };
  const siblings = all.filter((f) => !f.system && f.base === pick.base);
  const heavy = siblings.sort((a, b) => b.weight - a.weight)[0] || pick;
  return { fontName: heavy.family, bold: heavy.bold };
}

// Bộ lọc ass= có kèm fontsdir → ffmpeg đọc font TRONG KHO, không cần cài vào máy.
// Dùng ở MỌI nơi đốt chữ (edit / longedit / voiceshort / thumb).
export function assFilter(assBasename) {
  const hasFonts = scanFonts().length > 0;
  return hasFonts ? `ass=${assBasename}:fontsdir=${FONTS_DIR_REL}` : `ass=${assBasename}`;
}
