// 🧹 DỌN KHO tự động (cho Scheduled Task chạy mỗi đêm) — giữ work/ gọn, chống ổ phình.
// Gọi housekeep(ttlDays:3) rồi GHI LOG 1 dòng vào work/housekeep.log để anh soi lại khi cần.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { housekeep } from "../lib/housekeep.mjs";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, "..");
const LOG = path.join(ROOT, "work", "housekeep.log");

function stamp() {
  // Giờ Việt Nam (GMT+7) cho dễ đọc — cộng 7h vào UTC rồi cắt chuỗi.
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19);
}
function log(line) {
  try { fs.appendFileSync(LOG, `[${stamp()}] ${line}\n`, "utf-8"); } catch { /* kệ */ }
}

try {
  const rep = await housekeep({ ttlDays: 3, onLog: () => {} });
  log(`OK · giải phóng ${rep.freedGB}GB · xoá ${rep.deletedUploads} nguồn + ${rep.deletedRough} thô · dời ${rep.movedLegacy} · work ${rep.beforeGB}→${rep.afterGB}GB`);
  process.exit(0);
} catch (e) {
  log(`LỖI: ${e.message}`);
  process.exit(1);
}
