// 🧹 DỌN KHO — giữ work/ gọn, không để ổ cứng phình vô tận.
// Nguyên tắc: GIỮ thành phẩm + transcript (nhỏ, quý) · VỨT nguồn thô + file trung gian (to, tái tạo được).
// Chính sách (anh Hóa chốt 2026-07-06): nguồn trong uploads/ giữ 3 ngày ân hạn rồi tự xoá;
// dọn tự động mỗi lần bật phần mềm. TUYỆT ĐỐI không xoá gì trong out/ (thành phẩm) — chỉ dời file rời.
import fs from "node:fs";
import path from "node:path";
import { WORK, OUT_DIR } from "./util.mjs";

const OUT = OUT_DIR;
const UP = path.join(WORK, "uploads");
const DAY_MS = 24 * 60 * 60 * 1000;

// Sidecar KHÔNG bao giờ xoá (nhỏ, để tái tạo/tinh chỉnh mà không phải nạp lại).
const KEEP_EXT = new Set([".json"]);          // *.words.json, *-transcript.json…
// Đuôi "nguồn thô" nặng — mới là thứ cần dọn theo hạn.
const HEAVY_EXT = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".mp3", ".wav", ".m4a", ".png", ".jpg", ".jpeg"]);
// Chỉ xoá file lớn hơn ngưỡng này — video nguồn (thủ phạm dung lượng). Logo/nhạc/CTA nhỏ
// là brand asset anh dùng lại mỗi lần cắt → GIỮ (đã chống trùng nên không nhân bản).
const MIN_DELETE_BYTES = 20 * 1e6; // 20 MB

function bytes(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}
export function folderSize(dir) {
  let n = 0;
  let stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else n += bytes(full);
    }
  }
  return n;
}
export const gb = (b) => +(b / 1e9).toFixed(2);

// Thống kê nhanh cho giao diện (hiện "work đang chiếm X GB").
export function workStats() {
  return {
    totalGB: gb(folderSize(WORK)),
    uploadsGB: gb(folderSize(UP)),
    outGB: gb(folderSize(OUT)),
  };
}

// Dọn 1 lượt. dry=true → chỉ TÍNH, không xoá (để xem trước).
export function housekeep({ ttlDays = 3, dry = false, onLog = () => {} } = {}) {
  const now = Date.now();
  const cutoff = now - ttlDays * DAY_MS;
  const report = { freedBytes: 0, deletedUploads: 0, deletedRough: 0, movedLegacy: 0, dry, ttlDays };
  const before = workStats();
  onLog(`🧹 Dọn kho (giữ nguồn ${ttlDays} ngày${dry ? ", CHẠY THỬ" : ""}) — work đang ${before.totalGB} GB`);

  // 1) Xoá file trung gian sót ngay dưới work/ (*-rough, *-speed, *_styled, *_cut).
  //    Đây là nền/bản cắt trung gian của render — tái tạo được, KHÔNG phải thành phẩm.
  //    Chốt an toàn: bỏ qua file mới sửa < 1 giờ (có thể đang render dở).
  const SAFE_MS = 60 * 60 * 1000;
  try {
    for (const e of fs.readdirSync(WORK, { withFileTypes: true })) {
      if (!e.isFile()) continue;
      if (/(-rough|-speed|_styled|_cut)\.mp4$/i.test(e.name)) {
        const full = path.join(WORK, e.name);
        let mtime = now;
        try { mtime = fs.statSync(full).mtimeMs; } catch { continue; }
        if (now - mtime < SAFE_MS) { onLog(`  ⏳ bỏ qua (mới <1h): ${e.name}`); continue; }
        const sz = bytes(full);
        onLog(`  ✂ file thô: ${e.name} (${gb(sz)} GB)`);
        if (!dry) { try { fs.unlinkSync(full); } catch { continue; } }
        report.deletedRough++; report.freedBytes += sz;
      }
    }
  } catch { /* work luôn tồn tại, bỏ qua */ }

  // 2) Xoá nguồn thô trong uploads/ quá hạn (giữ lại mọi sidecar .json).
  try {
    for (const e of fs.readdirSync(UP, { withFileTypes: true })) {
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (KEEP_EXT.has(ext)) continue;                 // transcript → giữ vĩnh viễn
      if (!HEAVY_EXT.has(ext)) continue;               // đuôi lạ → không đụng cho an toàn
      const full = path.join(UP, e.name);
      let mtime = now;
      try { mtime = fs.statSync(full).mtimeMs; } catch { continue; }
      if (mtime > cutoff) continue;                    // còn trong hạn ân → giữ
      const sz = bytes(full);
      if (sz < MIN_DELETE_BYTES) continue;             // asset nhỏ (logo/nhạc/cta) → giữ
      const ageD = Math.floor((now - mtime) / DAY_MS);
      onLog(`  🗑 nguồn cũ ${ageD} ngày: ${e.name} (${gb(sz)} GB)`);
      if (!dry) { try { fs.unlinkSync(full); } catch { continue; } }
      report.deletedUploads++; report.freedBytes += sz;
    }
  } catch { /* uploads chưa có → bỏ qua */ }

  // 3) Gom file rời trong out/ (bản cũ trước khi có cơ chế thư mục lần-cắt) vào out/_luu-tru-cu/.
  //    CHỈ DỜI, không xoá — thành phẩm luôn được giữ.
  try {
    const loose = fs.readdirSync(OUT, { withFileTypes: true }).filter((e) => e.isFile());
    if (loose.length) {
      const bin = path.join(OUT, "_luu-tru-cu");
      onLog(`  📦 gom ${loose.length} file rời trong out/ → _luu-tru-cu/`);
      if (!dry) fs.mkdirSync(bin, { recursive: true });
      for (const e of loose) {
        const from = path.join(OUT, e.name);
        const to = path.join(bin, e.name);
        if (!dry) { try { fs.renameSync(from, to); } catch { continue; } }
        report.movedLegacy++;
      }
    }
  } catch { /* out chưa có → bỏ qua */ }

  const after = dry ? before : workStats();
  report.freedGB = gb(report.freedBytes);
  report.beforeGB = before.totalGB;
  report.afterGB = after.totalGB;
  onLog(`✅ Dọn xong: giải phóng ${report.freedGB} GB · xoá ${report.deletedUploads} nguồn + ${report.deletedRough} file thô · dời ${report.movedLegacy} file rời. work còn ${after.totalGB} GB.`);
  return report;
}
