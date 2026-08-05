// ⚙️ NGUỒN SỰ THẬT DUY NHẤT cho toàn phần mềm — mọi mặc định, nhận diện thương hiệu
// và "gu" biên tập chỉ khai báo Ở ĐÂY. Cả 7 route (server.mjs), các bộ não
// (autoclip/edit/longedit/voiceshort) và giao diện (qua /api/config) đều đọc từ file này.
//
// Vì sao: trước đây mặc định nằm rải rác 2 nơi (value trong index.html + `?? 0.18`
// trong server.mjs) và LỆCH NHAU giữa các tab (tab này film ON, tab kia OFF; model
// tab này medium, tab kia small…). Gom về một chỗ → video ra ĐỒNG NHẤT, không "hên xui".
import { loadSettings } from "./settings.mjs";

// ── 1. NHẬN DIỆN ────────────────────────────────────────────────────────────
// Phân biệt RÕ hai thứ hay bị lẫn:
//   • `system` = TỔ CHỨC TẠO RA PHẦN MỀM (hiện ở đầu trang + chân trang). Giữ nguyên.
//   • `name`   = THƯƠNG HIỆU CỦA BẠN — in lên thumbnail video bạn làm. Bạn tự khai.
// Bản bàn giao KHÔNG gắn sẵn thương hiệu của ai: khai trong tab ⚙️ Cấu hình
// (hoặc .env). Bỏ trống vẫn chạy bình thường, chỉ không in tên lên bìa video.
export const BRAND = {
  name: process.env.VSS_BRAND_NAME || "",                   // tên kênh/thương hiệu của BẠN (thumbnail)
  system: process.env.VSS_BRAND_SYSTEM || "Mentor Internet System", // đơn vị phát triển phần mềm
  tagline: "cắt · biên tập · thumbnail · đăng Lark",
  color: process.env.VSS_BRAND_COLOR || "#d3102e",          // màu nhấn (thumbnail, UI)
  // Lĩnh vực/chủ đề kênh — giúp AI chọn đoạn & viết caption ĐÚNG "chất" của bạn.
  niche: process.env.VSS_BRAND_NICHE || "chủ đề của kênh (phát triển bản thân, kinh doanh, kỹ năng…)",
  // Thư mục ảnh chân dung để dựng "bìa thương hiệu". Trống = bỏ qua bìa (fail an toàn).
  thumbPhotoDir: process.env.VSS_THUMB_DIR || "",
  logoFile: "logo-mentor.png", // thả logo CỦA BẠN vào assets/logo-mentor.png → tự đóng dấu lên video
  // Hashtag CỐ ĐỊNH gắn cuối MỌI caption. Trống = không gắn.
  hashtags: process.env.VSS_HASHTAGS || "",
};

// ── OVERLAY THƯƠNG HIỆU TỪ GIAO DIỆN ────────────────────────────────────────
// BRAND là object dùng chung — MỌI file import đều giữ CÙNG tham chiếu. Nên khi
// lưu cấu hình trong giao diện, ta MUTATE thẳng các trường của BRAND → thumbnail
// / caption / AI đổi ngay, KHÔNG cần khởi động lại phần mềm.
export function applyBrandSettings(patch = {}) {
  for (const k of ["name", "system", "color", "niche", "thumbPhotoDir", "hashtags"]) {
    if (patch[k] !== undefined && patch[k] !== null) BRAND[k] = String(patch[k]);
  }
  return BRAND;
}
// Nạp cấu hình đã lưu lúc khởi động (settings.local.json ưu tiên hơn .env).
try { applyBrandSettings(loadSettings().brand || {}); } catch { /* trống → dùng .env/mặc định */ }

// ── 2. MẶC ĐỊNH BIÊN TẬP DÙNG CHUNG ─────────────────────────────────────────
// Đặt tên rõ theo NGỮ CẢNH khung hình để short (9:16) và video dài (16:9) không đá nhau.
export const DEFAULTS = {
  // Nghe/gõ chữ
  model: "medium",           // whisper medium chuẩn hơn — THỐNG NHẤT mọi tab (trước: eval/edit/batch=small)
  lang: "vi",

  // Khung hình
  reframeShort: "blur",      // 9:16 nền mờ cho short
  reframeLong: "fit",        // 16:9 vừa khung cho video dài

  // Màu & hiệu ứng (áp cho MỌI pipeline như nhau)
  colorLevel: "clean",       // màu TRONG TRẺO (sáng/sạch/tự nhiên) — mặc định đẹp
  sharpen: 35,               // tăng nét vừa (0..100) — video nét hơn
  speed: 1.0,                // tốc độ toàn video (1.0=giữ nguyên; 1.2/1.5/2/3)
  captionStyle: "karaoke",
  // 🔤 Font chữ mặc định cho MỌI chữ trên video (id = tên file trong assets/fonts, viết-thường-gạch-nối).
  // "DT Phudu" = font phụ đề tiếng Việt, dấu rõ, nét dày → dễ đọc trên điện thoại.
  // Bỏ font mới vào assets/fonts/ là giao diện tự thấy. Muốn về font hệ thống: fontId = "arial".
  fontId: process.env.VSS_FONT || "dtphudu-bold",
  noText: false,             // 🚫 KHÔNG CHỮ: video trần, không phụ đề/hook/chữ tay
  smooth: "medium",          // làm mịn vừa (khử nhiễu nhẹ) — trước lệch off/medium
  voiceClean: "off",
  film: true,                // vignette + grain — BẬT đồng nhất (trước video dài tắt)
  punch: true,               // punch-zoom theo nhịp
  shake: false,              // camera shake — MẶC ĐỊNH TẮT: nội dung đào tạo (talking-head)
                             // rung nhẹ trông "ẩu"; bật tay khi cần chất năng động.
  flash: true,               // chớp trắng ở điểm cắt
  progress: true,            // thanh tiến trình
  normalize: true,           // chuẩn âm -14 LUFS

  // Âm lượng nhạc nền theo ngữ cảnh (0..1)
  musicVolShort: 0.18,
  musicVolLong: 0.14,
  musicVolVoice: 0.12,

  // Trám bối cảnh (b-roll)
  brollFill: "match",
  brollTransition: "fade",

  // Logo
  logoPos: "br",
  logoScale: 0.16,
  logoOpacity: 0.9,

  // SFX
  sfxVol: 0.6,

  // Cắt tự động (autoclip)
  minScore: 60,
  maxClips: 0,               // 0 = KHÔNG GIỚI HẠN, tự scale theo độ dài video
  burnHook: false,           // đắp chữ tiêu đề đầu video — tuỳ chọn
  makeThumb: true,
  makeContent: true,         // AI viết tiêu đề + caption đăng bài (mọi tính năng làm video)
  scoreClips: true,          // chấm thêm "Điểm kỹ thuật" (6 trục) cho mỗi short
  autoPostLark: false,       // ⚠️ XUẤT BẢN PHẢI CHỦ ĐỘNG — không tự đăng ngầm (trước: mặc định BẬT)
};

// ── 3. PRESET "GU" 1-BẤM ────────────────────────────────────────────────────
// Mỗi preset là một BỘ ĐÈ LÊN DEFAULTS. Dùng để đồng nhất phong cách nhanh.
export const PRESETS = {
  viral: {
    label: "⚡ Viral năng động",
    hint: "Phụ đề karaoke + hook + màu đậm + nhịp dồn — cho content ngắn bắt trend.",
    opts: { colorLevel: "high", captionStyle: "karaoke", punch: true, flash: true, film: true, burnHook: true },
  },
  cinematic: {
    label: "🎬 Kể chuyện điện ảnh",
    hint: "Màu nhẹ tự nhiên, nhạc êm dưới giọng, cắt mượt — cho câu chuyện chạm cảm xúc.",
    opts: { colorLevel: "low", captionStyle: "karaoke", punch: false, flash: false, film: true, shake: false, smooth: "high" },
  },
  clean: {
    label: "🧼 Sạch & trung thực",
    hint: "Ít can thiệp: chỉ cắt gọn + phụ đề, giữ màu gốc — cho nội dung nghiêm túc.",
    opts: { colorLevel: "off", punch: false, flash: false, film: false, shake: false, burnHook: false },
  },
};

// Trộn body người dùng gửi lên với DEFAULTS: chỉ lấy các key liệt kê, thiếu thì lấy default.
// Dùng trong server.mjs để KHÔNG lặp lại `body.x ?? DEFAULT` chi chít và không lệch nhau.
export function pick(body = {}, keys = []) {
  const out = {};
  for (const k of keys) out[k] = body[k] != null ? body[k] : DEFAULTS[k];
  return out;
}
