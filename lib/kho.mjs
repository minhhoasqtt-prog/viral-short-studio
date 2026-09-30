// 🗂️ KHO VIDEO — liệt kê MỌI video đã xuất trong work/out (mỗi lần cắt 1 thư mục), mới nhất trước.
// Đọc kèm file .txt cạnh video (tiêu đề, điểm) và hồ sơ lớp đổi khung (khung đang dùng).
// Kho nằm trên ổ mạng, hàng trăm tệp → đọc BẤT ĐỒNG BỘ (không chặn máy chủ) + NHỚ ĐỆM theo tệp:
// tệp không đổi (cùng mtime/cỡ) thì không đọc lại .txt/meta.json → lần mở thứ 2 gần như tức thì.
import fs from "node:fs/promises";
import path from "node:path";
import { layerDirFor } from "./frames.mjs";

const SKIP_DIR = new Set(["_lop-khung"]);
const SKIP_FILE = /(_precta|_spd|_styled|_cut|-rough|-speed)\.mp4$/i;
export const LOW_TECH = 60;   // dưới ngưỡng này → gắn cờ "cần xem lại"
const cache = new Map();      // path → { key, info }

async function readSidecar(mp4) {
  const out = { title: "", score: null, techScore: null };
  try {
    const s = await fs.readFile(mp4.replace(/\.mp4$/i, ".txt"), "utf-8");
    out.title = (/^TIÊU ĐỀ:\s*(.+)$/m.exec(s) || [])[1] || "";
    const n = /ĐIỂM NỘI DUNG[^:]*:\s*(\d+)/.exec(s); if (n) out.score = +n[1];
    const k = /ĐIỂM KỸ THUẬT[^:]*:\s*(\d+)/.exec(s); if (k) out.techScore = +k[1];
  } catch { /* không có .txt */ }
  return out;
}
async function readFrameOf(mp4) {
  const f = path.join(layerDirFor(mp4), "meta.json");
  try {
    // meta.json chứa cả transcript (nặng) → chỉ bóc trường reframe + plate bằng regex, không parse cả tệp.
    const s = await fs.readFile(f, "utf-8");
    const rf = /"reframe":"([^"]*)"/.exec(s), pl = /"plate":"((?:[^"\\]|\\.)*)"/.exec(s);
    if (!pl) return { reframe: null, hasLayer: false };
    await fs.access(JSON.parse(`"${pl[1]}"`));
    return { reframe: rf ? rf[1] : null, hasLayer: true };
  } catch { return { reframe: null, hasLayer: false }; }
}
async function describe(full, st, folder, name) {
  const key = `${st.mtimeMs}:${st.size}`;
  const hit = cache.get(full);
  if (hit && hit.key === key) return hit.info;
  const [sc, fr] = await Promise.all([readSidecar(full), readFrameOf(full)]);
  const info = {
    path: full, name, folder, mtime: st.mtimeMs, size: st.size,
    title: sc.title || name.replace(/-\d{13}\.mp4$/i, "").replace(/\.mp4$/i, ""),
    score: sc.score, techScore: sc.techScore, low: sc.techScore != null && sc.techScore < LOW_TECH,
    reframe: fr.reframe, hasLayer: fr.hasLayer,
  };
  cache.set(full, { key, info });
  return info;
}

export async function listKho(outDir, { limit = 400 } = {}) {
  const files = [];
  const walk = async (dir, depth) => {
    let ents = [];
    try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    const subs = [];
    for (const e of ents) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 2 && !SKIP_DIR.has(e.name)) subs.push(walk(full, depth + 1)); continue; }
      if (/\.mp4$/i.test(e.name) && !SKIP_FILE.test(e.name)) files.push({ full, name: e.name, folder: path.basename(dir) });
    }
    await Promise.all(subs);
  };
  await walk(outDir, 0);
  const items = [];
  for (let i = 0; i < files.length; i += 24) {          // 24 tệp một lượt: nhanh mà không dội ổ mạng
    const part = await Promise.all(files.slice(i, i + 24).map(async (f) => {
      try { return await describe(f.full, await fs.stat(f.full), f.folder, f.name); } catch { return null; }
    }));
    items.push(...part.filter(Boolean));
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return items.slice(0, limit);
}
