// 🖼️ KHUNG CHƯƠNG TRÌNH — chuẩn nhận diện theo từng chương trình (HPRKD, Mentor Business...).
// Chọn ở ô "Khung hình" với giá trị reframe = "frame:<id>". Mỗi khung là 1 thư mục assets/frames/<id>/:
//   frame.png  — lớp 1080x1920 trong suốt, chừa Ô VIDEO; phủ lên trên video + b-roll, dưới phụ đề.
//   frame.json — { name, hole: [x, y, w, h], captionTop, hookTop }
// Thêm chương trình mới = thêm 1 thư mục, không cần sửa mã.
import path from "node:path";
import fs from "node:fs";
import { __root } from "./util.mjs";

const DIR = path.join(__root, "assets", "frames");

export function listFrames() {
  try {
    return fs.readdirSync(DIR).map((id) => resolveFrame("frame:" + id)).filter(Boolean).map((f) => ({ id: f.id, name: f.name }));
  } catch { return []; }
}

// reframe "frame:<id>" → cấu hình khung; mọi giá trị khác (blur/fill/none) → null.
export function resolveFrame(reframe) {
  const m = /^frame:([\w-]+)$/.exec(String(reframe || ""));
  if (!m) return null;
  const dir = path.join(DIR, m[1]);
  const png = path.join(dir, "frame.png");
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "frame.json"), "utf-8"));
    if (!fs.existsSync(png) || !Array.isArray(cfg.hole) || cfg.hole.length !== 4) return null;
    const [x, y, w, h] = cfg.hole.map(Number);
    return { id: m[1], name: cfg.name || m[1], png, hole: { x, y, w, h }, captionTop: Number(cfg.captionTop), hookTop: Number(cfg.hookTop) };
  } catch { return null; }
}

// 🧱 LỚP ĐỔI KHUNG — mỗi video 9:16 dựng xong có 1 thư mục cạnh nó:
//   <thư mục video>/_lop-khung/<tên video>/lop-video.mp4 + meta.json
// lop-video = vùng video sạch (đã hiệu ứng, chưa khung/chữ) → đổi khung chỉ cần ghép lại, không dựng lại.
export function layerDirFor(outPath) {
  return path.join(path.dirname(outPath), "_lop-khung", path.basename(outPath).replace(/\.mp4$/i, ""));
}
export function writeLayerMeta(outPath, meta) {
  const d = layerDirFor(outPath);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "meta.json"), JSON.stringify(meta), "utf-8");
}
export function readLayerMeta(outPath) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(layerDirFor(outPath), "meta.json"), "utf-8"));
    return m && m.plate && fs.existsSync(m.plate) ? m : null;
  } catch { return null; }
}
