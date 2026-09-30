// 🎥 NGUỒN TỪ LARK MINUTES — link bản ghi họp (Zoom/Lark VC) dạng
//   https://<tenant>.larksuite.com/minutes/<token>   (hoặc feishu.cn/minutes/<token>)
// Lấy link tải bằng lark-cli (đăng nhập user sẵn trên máy), tải MP4 gốc về work/tai-ve/.
// Nhớ đệm theo token: cùng buổi thì lần sau không tải lại.
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { run, WORK, slug } from "./util.mjs";

const DL_DIR = path.join(WORK, "tai-ve");
const LARK = process.env.VSS_LARK_CLI || "lark-cli";

export function parseLarkMinutes(u) {
  const s = String(u || "").trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const url = new URL(s);
    const h = url.hostname.toLowerCase();
    if (!/(larksuite\.com|feishu\.cn|larkoffice\.com)$/.test(h)) return null;
    const m = /\/minutes\/([a-z0-9]{16,})/i.exec(url.pathname);
    return m ? m[1] : null;
  } catch { return null; }
}
export const isLarkMinutesUrl = (u) => !!parseLarkMinutes(u);

async function larkJson(args) {
  // lark-cli trên Windows là .cmd → cần shell; tham số chỉ gồm chữ/số nên không lo quoting.
  const { out } = await run(LARK, [...args, "--as", "user"], { shell: process.platform === "win32" });
  const i = out.indexOf("{");
  const j = JSON.parse(out.slice(i));
  if (!j.ok) throw new Error((j.error && (j.error.message || j.error.msg)) || "lark-cli báo lỗi");
  return j.data;
}

export async function larkMinutesDownload(url, { onLog = () => {} } = {}) {
  const token = parseLarkMinutes(url);
  if (!token) throw new Error("Link Lark Minutes không hợp lệ: " + url);
  fs.mkdirSync(DL_DIR, { recursive: true });
  const cached = fs.readdirSync(DL_DIR).find((f) => f.startsWith(`lark-${token}`) && f.endsWith(".mp4"));
  if (cached) { onLog(`  ♻️ Đã có sẵn bản ghi này: ${cached}`); return path.join(DL_DIR, cached); }

  onLog("🎥 Link Lark Minutes → lấy link tải qua lark-cli…");
  let title = "";
  // cmd.exe (shell) nuốt dấu " → bọc sẵn theo luật argv của Windows: "{\"k\":\"v\"}".
  const params = JSON.stringify({ minute_token: token });
  const arg = process.platform === "win32" ? '"' + params.replace(/"/g, '\\"') + '"' : params;
  try { title = (await larkJson(["minutes", "minutes", "get", "--params", arg])).minute?.title || ""; }
  catch { /* thiếu tên thì thôi */ }
  let dl;
  try { dl = (await larkJson(["minutes", "+download", "--minute-tokens", token, "--url-only"])).download_url; }
  catch (e) { throw new Error("Không lấy được link tải Lark Minutes (tài khoản Lark trên máy có quyền xem buổi này chưa?): " + e.message); }
  if (!dl) throw new Error("Lark không trả link tải cho buổi " + token);

  const res = await fetch(dl);
  if (!res.ok) throw new Error(`Tải bản ghi Lark lỗi HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const file = path.join(DL_DIR, `lark-${token}${title ? "-" + slug(title) : ""}.mp4`);
  const part = file + ".part";
  onLog(`⬇️ Tải bản ghi "${title || token}"${total ? ` (${(total / 1048576).toFixed(0)} MB)` : ""}…`);
  let got = 0, lastPct = -10;
  const body = Readable.fromWeb(res.body);
  body.on("data", (c) => {
    got += c.length;
    if (!total) return;
    const pct = Math.floor((got / total) * 100);
    if (pct >= lastPct + 10) { lastPct = pct; onLog(`  … ${pct}%`); }
  });
  await pipeline(body, fs.createWriteStream(part));
  if (total && got < total) { try { fs.unlinkSync(part); } catch { /* dọn */ } throw new Error("Tải bản ghi Lark bị đứt giữa chừng, bấm chạy lại."); }
  fs.renameSync(part, file);
  onLog(`  ✅ Đã tải: ${path.basename(file)}`);
  return file;
}
