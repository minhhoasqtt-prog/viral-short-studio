// 📁 NGUỒN TỪ GOOGLE DRIVE — tải video/nhạc/ảnh từ link Drive về work/tai-ve/.
// Vì sao có file này: yt-dlp tải Drive rất hay hỏng (file lớn vướng trang "quét virus",
// link Drive không phải video "phát được" thì extractor bỏ qua). Ở đây tải THẲNG bằng HTTP,
// tự bấm qua trang xác nhận, và có đường phụ dùng Drive API khi anh nạp API key / OAuth.
//
// Nhận mọi dạng link:
//   https://drive.google.com/file/d/<ID>/view?usp=sharing
//   https://drive.google.com/open?id=<ID>          ·  .../uc?export=download&id=<ID>
//   https://drive.usercontent.google.com/download?id=<ID>
//   https://drive.google.com/drive/folders/<ID>    (THƯ MỤC — cần API key/OAuth, xem dưới)
//
// Quyền riêng tư:
//   • File để "Bất kỳ ai có đường liên kết" → chạy thẳng, không cần cấu hình gì.
//   • File RIÊNG TƯ hoặc THƯ MỤC → cần một trong hai:
//       VSS_DRIVE_TOKEN     = access token OAuth (scope drive.readonly)
//       VSS_DRIVE_OAUTH     = đường dẫn file JSON {client_id, client_secret, refresh_token}
//     Hoặc file công khai nhưng muốn lấy đúng TÊN/kích thước:
//       VSS_DRIVE_API_KEY   = API key Google (chỉ đọc được file đã mở link công khai)
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { WORK, slug } from "./util.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const DL_DIR = path.join(WORK, "tai-ve");
const API = "https://www.googleapis.com/drive/v3/files";

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi|flv|wmv|mpg|mpeg|ts)$/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|opus|wma)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|bmp)$/i;

// ---------------------------------------------------------------- nhận diện link
export function isDriveUrl(u) {
  const s = String(u || "").trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const h = new URL(s).hostname.toLowerCase();
    return h === "drive.google.com" || h === "docs.google.com" || h === "drive.usercontent.google.com";
  } catch { return false; }
}

// Bóc ID (file hay thư mục) khỏi link Drive. Trả {kind:"file"|"folder", id, resourceKey}.
export function parseDriveUrl(u) {
  const s = String(u || "").trim();
  let url;
  try { url = new URL(s); } catch { throw new Error("Link Drive không hợp lệ: " + s); }
  const q = url.searchParams;
  const resourceKey = q.get("resourcekey") || q.get("resourceKey") || null;
  const p = url.pathname;

  let m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(p);
  if (m) return { kind: "folder", id: m[1], resourceKey };
  if (/\/(folderview|drive\/folders)/i.test(p) && q.get("id")) return { kind: "folder", id: q.get("id"), resourceKey };

  m = /\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(p) || /\/d\/([A-Za-z0-9_-]{10,})/.exec(p);
  if (m) return { kind: "file", id: m[1], resourceKey };

  const id = q.get("id");
  if (id) return { kind: "file", id, resourceKey };

  throw new Error("Không tìm thấy ID trong link Drive: " + s);
}

// ---------------------------------------------------------------- xác thực (tuỳ chọn)
let _tokenCache = { token: null, exp: 0 };

async function accessToken() {
  if (process.env.VSS_DRIVE_TOKEN) return process.env.VSS_DRIVE_TOKEN.trim();
  const f = (process.env.VSS_DRIVE_OAUTH || "").trim();
  if (!f || !fs.existsSync(f)) return null;
  if (_tokenCache.token && Date.now() < _tokenCache.exp) return _tokenCache.token;
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(f, "utf-8")); } catch { return null; }
  const { client_id, client_secret, refresh_token } = cfg;
  if (!client_id || !client_secret || !refresh_token) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error("Làm mới token Drive hỏng: " + (await res.text()).slice(0, 300));
  const j = await res.json();
  _tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60_000 };
  return _tokenCache.token;
}

const apiKey = () => (process.env.VSS_DRIVE_API_KEY || "").trim() || null;

async function apiAuth() {
  const tok = await accessToken();
  if (tok) return { headers: { Authorization: "Bearer " + tok }, query: "" };
  const key = apiKey();
  if (key) return { headers: {}, query: "&key=" + encodeURIComponent(key) };
  return null;
}

// Lấy tên/kiểu/kích thước file (chỉ khi có API key hoặc OAuth). Không có thì trả null — vẫn tải được.
export async function driveMeta(id) {
  const auth = await apiAuth();
  if (!auth) return null;
  const url = `${API}/${id}?fields=id,name,mimeType,size&supportsAllDrives=true${auth.query}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, ...auth.headers } });
  if (!res.ok) return null;
  return await res.json();
}

// ---------------------------------------------------------------- tiện ích HTTP
function jarHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function jarAbsorb(jar, res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
  }
}
async function get(url, jar, extra = {}) {
  const headers = { "User-Agent": UA, "Accept-Language": "vi,en;q=0.8", ...extra };
  const ck = jarHeader(jar);
  if (ck) headers.Cookie = ck;
  const res = await fetch(url, { headers, redirect: "follow" });
  jarAbsorb(jar, res);
  return res;
}

const isHtml = (res) => /text\/html/i.test(res.headers.get("content-type") || "");

// Trang xác nhận của Drive là một <form> GET — đọc action + các input ẩn rồi đi tiếp.
function formFromHtml(html) {
  const f = /<form[^>]+action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i.exec(html);
  if (!f) return null;
  const action = f[1].replace(/&amp;/g, "&");
  const params = new URLSearchParams();
  const re = /<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi;
  let m;
  while ((m = re.exec(f[2]))) params.set(m[1], m[2].replace(/&amp;/g, "&"));
  const sep = action.includes("?") ? "&" : "?";
  const qs = params.toString();
  return qs ? action + sep + qs : action;
}

// Đọc trang HTML mà Drive trả về để báo lỗi ĐÚNG BỆNH thay vì "tải hỏng".
function explainHtml(html, id) {
  const h = html.slice(0, 4000);
  if (/quota|Quá nhiều người|too many|exceeded/i.test(h))
    return new Error(
      `Drive báo VƯỢT HẠN MỨC tải cho file ${id} (nhiều người tải cùng lúc). Chờ vài giờ, hoặc chép file về Drive của mình rồi lấy link mới.`
    );
  if (/accounts\.google\.com|Sign in|Đăng nhập|permission|quyền/i.test(h))
    return new Error(
      `File Drive ${id} đang RIÊNG TƯ. Mở Share → "Bất kỳ ai có đường liên kết" (Người xem), hoặc nạp OAuth: đặt VSS_DRIVE_OAUTH / VSS_DRIVE_TOKEN.`
    );
  return new Error(`Drive trả về trang web thay vì file (ID ${id}) — kiểm tra lại link/quyền chia sẻ.`);
}

function nameFromDisposition(cd) {
  if (!cd) return null;
  let m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (m) { try { return decodeURIComponent(m[1].trim().replace(/^"|"$/g, "")); } catch { /* bỏ qua */ } }
  m = /filename="([^"]+)"/i.exec(cd) || /filename=([^;\s]+)/i.exec(cd);
  return m ? m[1].trim() : null;
}

function extFromMime(mime = "") {
  const map = {
    "video/mp4": ".mp4", "video/quicktime": ".mov", "video/x-matroska": ".mkv", "video/webm": ".webm",
    "video/x-msvideo": ".avi", "video/mpeg": ".mpg",
    "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/aac": ".aac", "audio/wav": ".wav",
    "audio/x-wav": ".wav", "audio/ogg": ".ogg", "audio/flac": ".flac",
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  };
  return map[String(mime).split(";")[0].trim().toLowerCase()] || "";
}

// Đặt tên file an toàn: giữ đuôi gốc, phần tên bỏ dấu (ffmpeg/ass ưa đường dẫn sạch).
function safeName(name, fallbackExt = ".mp4") {
  const raw = String(name || "").trim();
  const ext = (path.extname(raw) || fallbackExt).toLowerCase();
  const base = slug(path.basename(raw, path.extname(raw))) || "drive";
  return base + ext;
}

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }

// ---------------------------------------------------------------- tải 1 file
/**
 * Tải một FILE Drive về đĩa. Có nhớ đệm: cùng ID thì lần sau dùng lại bản đã tải.
 * @returns {Promise<string>} đường dẫn file trên đĩa
 */
export async function driveDownload(url, { onLog = () => {}, dir = DL_DIR, prefix = "drive", force = false } = {}) {
  const { kind, id, resourceKey } = parseDriveUrl(url);
  if (kind === "folder")
    throw new Error(
      "Đây là link THƯ MỤC Drive. Dùng cho b-roll thì được; còn video nguồn hãy dán link TỪNG FILE (…/file/d/<ID>/view)."
    );

  ensureDir(dir);
  const key = `${prefix}-${id}`;

  // đã tải rồi → dùng lại (đỡ tốn mạng, đỡ đụng hạn mức Drive)
  if (!force) {
    try {
      const hit = fs.readdirSync(dir).find((n) => n.startsWith(key + "-") && !n.endsWith(".part"));
      if (hit) {
        const full = path.join(dir, hit);
        if (fs.statSync(full).size > 0) { onLog(`📁 Drive: dùng lại bản đã tải — ${hit}`); return full; }
      }
    } catch { /* thư mục mới, bỏ qua */ }
  }

  const meta = await driveMeta(id).catch(() => null);
  if (meta?.mimeType?.startsWith("application/vnd.google-apps.")) {
    throw new Error(`File Drive ${id} là tài liệu Google (${meta.mimeType}), không phải video/nhạc/ảnh.`);
  }
  if (meta?.name) onLog(`📁 Drive: ${meta.name}${meta.size ? ` · ${(meta.size / 1048576).toFixed(1)} MB` : ""}`);

  const jar = new Map();
  let res = null;

  // Đường 1 — có OAuth/API key thì tải qua Drive API (chạy được cả file riêng tư).
  const auth = await apiAuth();
  if (auth) {
    onLog("📁 Drive: tải qua Drive API…");
    res = await fetch(`${API}/${id}?alt=media&supportsAllDrives=true${auth.query}`, {
      headers: { "User-Agent": UA, ...auth.headers },
      redirect: "follow",
    });
    if (!res.ok) {
      onLog(`  ⚠ Drive API trả ${res.status} → thử đường tải công khai`);
      res = null;
    }
  }

  // Đường 2 — tải công khai, tự bấm qua trang "không quét virus được".
  if (!res) {
    onLog("📁 Drive: tải trực tiếp…");
    let next =
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t` +
      (resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : "");
    for (let hop = 0; hop < 4; hop++) {
      res = await get(next, jar);
      if (!res.ok) throw new Error(`Drive trả mã ${res.status} khi tải file ${id}`);
      if (!isHtml(res)) break;
      const html = await res.text();
      const form = formFromHtml(html);
      if (!form) throw explainHtml(html, id);
      onLog("  → qua trang xác nhận của Drive…");
      next = form;
      res = null;
    }
    if (!res || isHtml(res)) throw new Error(`Không qua được trang xác nhận của Drive (ID ${id}).`);
  }

  // tên file: ưu tiên metadata → content-disposition → đuôi theo mime
  const cdName = nameFromDisposition(res.headers.get("content-disposition"));
  const mime = res.headers.get("content-type") || meta?.mimeType || "";
  const name = safeName(meta?.name || cdName || `${id}${extFromMime(mime) || ".mp4"}`, extFromMime(mime) || ".mp4");
  const dest = path.join(dir, `${key}-${name}`);
  const part = dest + ".part";

  const total = Number(res.headers.get("content-length") || meta?.size || 0);
  let done = 0, mark = 0;

  // Ghi thành TỪNG CỤC LỚN (8 MB) thay vì từng mẩu 64 KB: work/ nằm trên ổ mạng Y:,
  // ghi mẩu nhỏ chậm gấp ~14 lần (đo thật: 5 MB mất 22 giây vs 1,6 giây).
  const BLOCK = 8 * 1024 * 1024;
  const out = fs.createWriteStream(part);
  const put = (b) => new Promise((ok, no) => out.write(b, (e) => (e ? no(e) : ok())));
  let bag = [], bagLen = 0;
  try {
    for await (const chunk of Readable.fromWeb(res.body)) {
      bag.push(chunk); bagLen += chunk.length; done += chunk.length;
      if (bagLen >= BLOCK) { await put(Buffer.concat(bag, bagLen)); bag = []; bagLen = 0; }
      const mb = done / 1048576;
      if (mb - mark >= 25) {
        mark = mb;
        onLog(total ? `  … ${mb.toFixed(0)}/${(total / 1048576).toFixed(0)} MB (${((done / total) * 100).toFixed(0)}%)`
                    : `  … ${mb.toFixed(0)} MB`);
      }
    }
    if (bagLen) await put(Buffer.concat(bag, bagLen));
  } finally {
    await new Promise((ok) => out.end(ok));
  }
  if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  fs.renameSync(part, dest);

  // Chốt chặn: Drive đôi khi trả TRANG WEB mang mã 200 (hết hạn mức / mất quyền) → phải báo đúng bệnh.
  const size = fs.statSync(dest).size;
  const head = fs.readFileSync(dest).subarray(0, 512).toString("utf-8");
  if (/^\s*(<!DOCTYPE|<html|<HTML)/.test(head)) {
    const full = fs.readFileSync(dest, "utf-8").slice(0, 4000);
    fs.rmSync(dest, { force: true });
    throw explainHtml(full, id);
  }
  if (size === 0) {
    fs.rmSync(dest, { force: true });
    throw new Error(`Tải file Drive ${id} về 0 byte — thử lại, hoặc kiểm tra quyền chia sẻ.`);
  }
  // Không phải media thì báo NGAY, đừng để ffmpeg/whisper nhai một file PDF rồi treo.
  const ext = path.extname(dest);
  if (!(VIDEO_EXT.test(dest) || AUDIO_EXT.test(dest) || IMAGE_EXT.test(dest))) {
    throw new Error(
      `File Drive ${id} không phải video/nhạc/ảnh (đuôi ${ext || "không rõ"}). Đã tải về ${dest} — kiểm tra lại link.`
    );
  }
  onLog(`📁 Drive: xong — ${path.basename(dest)} (${(size / 1048576).toFixed(1)} MB)`);
  return dest;
}

// ---------------------------------------------------------------- tải cả thư mục
/**
 * Liệt kê file trong một THƯ MỤC Drive (cần API key hoặc OAuth).
 */
export async function driveListFolder(id, { pageMax = 200 } = {}) {
  const auth = await apiAuth();
  if (!auth)
    throw new Error(
      "Link THƯ MỤC Drive cần khoá đọc: đặt VSS_DRIVE_API_KEY (thư mục đã mở link công khai) " +
      "hoặc VSS_DRIVE_OAUTH/VSS_DRIVE_TOKEN. Hoặc dán link TỪNG FILE, nhiều link cách nhau dấu ;"
    );
  const out = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
    const url =
      `${API}?q=${q}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=100` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (pageToken ? `&pageToken=${pageToken}` : "") + auth.query;
    const res = await fetch(url, { headers: { "User-Agent": UA, ...auth.headers } });
    if (!res.ok) throw new Error(`Không đọc được thư mục Drive ${id} (mã ${res.status}). Kiểm tra quyền chia sẻ.`);
    const j = await res.json();
    out.push(...(j.files || []));
    pageToken = j.nextPageToken || "";
  } while (pageToken && out.length < pageMax);
  return out;
}

/**
 * Tải các file media trong một thư mục Drive về một thư mục cục bộ (dùng cho b-roll / kho clip).
 * @returns {Promise<string>} đường dẫn thư mục cục bộ
 */
export async function driveDownloadFolder(url, { onLog = () => {}, kinds = "video+image", max = 40 } = {}) {
  const { kind, id } = parseDriveUrl(url);
  if (kind !== "folder") throw new Error("Không phải link thư mục Drive: " + url);
  const files = await driveListFolder(id);
  const want = (f) => {
    const m = f.mimeType || "";
    if (kinds.includes("video") && (m.startsWith("video/") || VIDEO_EXT.test(f.name))) return true;
    if (kinds.includes("image") && (m.startsWith("image/") || IMAGE_EXT.test(f.name))) return true;
    if (kinds.includes("audio") && (m.startsWith("audio/") || AUDIO_EXT.test(f.name))) return true;
    return false;
  };
  const picks = files.filter(want).slice(0, max);
  if (!picks.length) throw new Error(`Thư mục Drive ${id} không có file phù hợp (${kinds}).`);
  const dir = ensureDir(path.join(DL_DIR, "drive-folder-" + id));
  onLog(`📁 Drive: thư mục có ${picks.length} file phù hợp → tải về ${dir}`);
  for (let i = 0; i < picks.length; i++) {
    const f = picks[i];
    onLog(`  (${i + 1}/${picks.length}) ${f.name}`);
    try {
      await driveDownload(`https://drive.google.com/file/d/${f.id}/view`, { onLog, dir, prefix: "f" });
    } catch (e) { onLog(`  ⚠ bỏ qua ${f.name}: ${e.message}`); }
  }
  return dir;
}

export { DL_DIR as DRIVE_CACHE_DIR };
