// 🏷️ THƯƠNG HIỆU — logo watermark CHUẨN: LUÔN góc TRÊN-TRÁI, cân xứng, tự cắt sát viền.
// Chuẩn hoá 1 chỗ để mọi mode dùng chung → không phải chỉnh đi chỉnh lại.
import path from "node:path";
import fs from "node:fs";
import { run, WORK, __root, PY, SCRIPTS } from "./util.mjs";

// CHÚ Ý: đây là logo ĐÓNG DẤU LÊN VIDEO. Không có file này ⇒ video ra SẠCH (không watermark góc).
// Logo nhận diện GIAO DIỆN phần mềm là file khác: assets/logo-app.png (chỉ hiện trong app, không lên video).
const RAW = path.join(__root, "assets", "logo-mentor.png");
const TRIM = path.join(WORK, "cache", "logo-trim.png");

// Tỉ lệ CHUẨN (theo bề ngang khung) — để logo luôn cân xứng ở mọi khung hình.
export const WM = { scale: 0.17, marginFrac: 0.03 };

// 🌟 WATERMARK GIỮA (Hoangminhhoa.com) — canh GIỮA ngang, gần đỉnh, LUÔN có ở MỌI video.
// Ưu tiên assets/watermark.png (mỗi người tự thả ảnh của mình); không có thì dùng watermark-hmh.png (máy chủ phần mềm).
const CENTER_RAW = fs.existsSync(path.join(__root, "assets", "watermark.png"))
  ? path.join(__root, "assets", "watermark.png") : path.join(__root, "assets", "watermark-hmh.png");
const CENTER_TRIM = path.join(WORK, "cache", "watermark-hmh-trim.png");
export const CENTER_WM = { scale: 0.5, opacity: 0.6, topFrac: 0.05 };
// Trả bản ĐÃ CẮT SÁT VIỀN (bỏ viền trong suốt) để chữ nằm đúng trên đỉnh như mẫu.
export async function brandCenterWatermark() {
  try {
    if (!fs.existsSync(CENTER_RAW)) return null;
    const rs = fs.statSync(CENTER_RAW).mtimeMs;
    const ts = fs.existsSync(CENTER_TRIM) ? fs.statSync(CENTER_TRIM).mtimeMs : 0;
    if (ts >= rs) return CENTER_TRIM;
    fs.mkdirSync(path.dirname(CENTER_TRIM), { recursive: true });
    await run(PY, [path.join(SCRIPTS, "trim_logo.py"), CENTER_RAW, CENTER_TRIM]);
    return fs.existsSync(CENTER_TRIM) ? CENTER_TRIM : CENTER_RAW;
  } catch { return fs.existsSync(CENTER_RAW) ? CENTER_RAW : null; }
}

// Trả về đường dẫn logo ĐÃ CẮT SÁT VIỀN (cache). Không có file → null (bỏ qua watermark).
export async function brandLogo() {
  try {
    if (!fs.existsSync(RAW)) return null;
    const rs = fs.statSync(RAW).mtimeMs;
    const ts = fs.existsSync(TRIM) ? fs.statSync(TRIM).mtimeMs : 0;
    if (ts >= rs) return TRIM;
    fs.mkdirSync(path.dirname(TRIM), { recursive: true });
    await run(PY, [path.join(SCRIPTS, "trim_logo.py"), RAW, TRIM]);
    return fs.existsSync(TRIM) ? TRIM : RAW;
  } catch { return fs.existsSync(RAW) ? RAW : null; }
}

// Chèn watermark góc TRÊN-TRÁI vào filtergraph. Trả về {complex, v, idxNext} đã nối.
// args: mảng args ffmpeg (sẽ push -loop -i logo). v: label video hiện tại. idx: chỉ số input kế.
export function watermarkOverlay({ args, complex, v, idx, logoPath, targetW }, logoScaleFilter) {
  if (!logoPath) return { complex, v, idx };
  const m = Math.round(WM.marginFrac * targetW);
  args.push("-loop", "1", "-i", logoPath);
  const wIdx = idx;
  complex += `;[${wIdx}:v]${logoScaleFilter({ scale: WM.scale, opacity: 0.95, targetW })}[wm];${v}[wm]overlay=${m}:${m}:shortest=1[vw]`;
  return { complex, v: "[vw]", idx: idx + 1 };
}
