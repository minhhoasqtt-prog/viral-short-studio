// 🏷️ NHÃN / STICKER tự động — chèn nhãn động ở các điểm nhấn (vào b-roll, cắt cảnh)
// để video sinh động, giữ chân người xem. Dùng thư mục PNG của người dùng, hoặc bộ
// BUILT-IN tạo sẵn tại máy (vòng nhấn, mũi tên, chấm) khi chưa có thư mục.
import path from "node:path";
import fs from "node:fs";
import { run, ASSETS } from "./util.mjs";
import { FFMPEG } from "./ffmpeg.mjs";

const IMG = /\.(png|webp|gif)$/i;
const STK_DIR = path.join(ASSETS, "stickers");

// Tạo bộ sticker built-in 1 lần (PNG nền trong suốt) bằng ffmpeg geq.
export async function ensureBuiltinStickers() {
  fs.mkdirSync(STK_DIR, { recursive: true });
  const have = fs.readdirSync(STK_DIR).filter((f) => IMG.test(f));
  if (have.length >= 3) return STK_DIR;
  const S = 360, c = S / 2;
  const gen = async (name, aExpr, r = 255, g = 40, b = 40) => {
    const out = path.join(STK_DIR, name);
    if (fs.existsSync(out)) return;
    await run(FFMPEG, ["-hide_banner", "-y", "-f", "lavfi", "-i", `color=c=black:s=${S}x${S}`,
      "-vf", `format=rgba,geq=r='${r}':g='${g}':b='${b}':a='${aExpr}'`, "-frames:v", "1", out]);
  };
  // Vòng nhấn (annulus) đỏ
  await gen("01-ring-do.png", `if(between(hypot(X-${c},Y-${c}),${c - 40},${c - 12}),255,0)`);
  // Chấm vàng đặc
  await gen("02-cham-vang.png", `if(lt(hypot(X-${c},Y-${c}),${c - 60}),255,0)`, 255, 210, 0);
  // Mũi tên xuống (tam giác) đỏ
  await gen("03-muiten-do.png",
    `if(gt(Y,${S * 0.2})*lt(Y,${S * 0.82})*lt(abs(X-${c}),(${S * 0.82}-Y)*0.7),255,0)`);
  return STK_DIR;
}

// Quét thư mục sticker → danh sách file PNG.
export function indexStickers(folder) {
  if (!folder || !fs.existsSync(folder)) return [];
  return fs.readdirSync(folder).filter((f) => IMG.test(f)).map((f) => path.join(folder, f));
}

// Lên kế hoạch chèn nhãn: xoay vòng sticker + vị trí, đặt tại các mốc nhấn (giãn cách).
// triggers: mảng giây. Trả về [{file,start,dur,size,xFrac,yFrac}].
export function planStickers(triggers, stickers, {
  dur = 1.6, minGap = 1.6, maxCount = 10, size = 0.17,
} = {}) {
  if (!stickers.length || !triggers.length) return [];
  // vùng đặt an toàn (tránh mặt giữa + phụ đề dưới): góc trên & hai bên trên
  const zones = [
    { xFrac: 0.82, yFrac: 0.20 }, { xFrac: 0.16, yFrac: 0.24 },
    { xFrac: 0.80, yFrac: 0.40 }, { xFrac: 0.20, yFrac: 0.44 },
  ];
  const plan = [];
  let last = -999, si = 0, zi = 0;
  const sorted = [...new Set(triggers.map((t) => +Number(t).toFixed(2)))].sort((a, b) => a - b);
  for (const t of sorted) {
    if (t < 0.2) continue;
    if (t - last < minGap) continue;
    const z = zones[zi % zones.length];
    plan.push({ file: stickers[si % stickers.length], start: +t.toFixed(3), dur, size, xFrac: z.xFrac, yFrac: z.yFrac });
    last = t; si++; zi++;
    if (plan.length >= maxCount) break;
  }
  return plan;
}

// Chuỗi filter chuẩn hoá 1 sticker (scale + alpha fade + dịch PTS).
export function stickerNormalize({ size, dur, start, targetW = 1080 }) {
  const w = Math.max(60, Math.round(targetW * size));
  const fd = 0.2, fo = Math.max(0, dur - fd).toFixed(3);
  return [
    `scale=${w}:-1`, "format=yuva420p",
    `fade=t=in:st=0:d=${fd}:alpha=1`, `fade=t=out:st=${fo}:d=${fd}:alpha=1`,
    `setpts=PTS-STARTPTS+${start.toFixed(3)}/TB`,
  ].join(",");
}

// Biểu thức overlay x/y cho sticker (nảy nhẹ + theo vị trí phần trăm).
export function stickerOverlayXY({ xFrac, yFrac, start }) {
  const x = `(W-w)*${xFrac.toFixed(3)}`;
  const y = `(H-h)*${yFrac.toFixed(3)}+8*sin((t-${start.toFixed(3)})*7)`;
  return `${x}:${y}`;
}

export { STK_DIR };
