// 🧪 BỘ KIỂM THỬ KHÓI — chạy SAU MỖI LẦN SỬA, trước khi giao cho người dùng.
//   node scripts/kiem-thu.mjs          (hoặc bấm KIỂM THỬ.bat)
// Tự tạo video mẫu (không cần tệp ngoài), dựng thử với MỌI khung, đổi khung, short lồng voice có khung,
// kiểm từ điển tên riêng, nhận link Lark, và (nếu phần mềm đang chạy) kiểm các khoá an toàn qua API.
// In ✅/❌ từng mục, thoát mã 1 nếu có mục hỏng.
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const imp = (f) => import(pathToFileURL(path.join(ROOT, "lib", f)).href);
const { run, WORK } = await imp("util.mjs");
const { FFMPEG, probe, verifyVideo } = await imp("ffmpeg.mjs");
const { autoEdit } = await imp("edit.mjs");
const { swapFrame } = await imp("doikhung.mjs");
const { voiceShort } = await imp("voiceshort.mjs");
const { listFrames, readLayerMeta } = await imp("frames.mjs");
const { applyDictionary } = await imp("transcribe.mjs");
const { parseLarkMinutes } = await imp("larkminutes.mjs");

const DIR = path.join(WORK, "kiem-thu");
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const results = [];
const t0 = Date.now();
async function check(name, fn) {
  const t = Date.now();
  try { const note = await fn(); results.push({ name, ok: true }); console.log(`✅ ${name}${note ? " — " + note : ""} (${((Date.now() - t) / 1000).toFixed(1)}s)`); }
  catch (e) { results.push({ name, ok: false }); console.log(`❌ ${name} — ${String(e.message || e).split("\n")[0]}`); }
}
const must = (c, msg) => { if (!c) throw new Error(msg); };
async function okVideo(f, w = 1080, h = 1920) {
  must(fs.existsSync(f), "không có tệp " + path.basename(f));
  const m = await probe(f);
  must(m.width === w && m.height === h, `cỡ ${m.width}x${m.height}, cần ${w}x${h}`);
  const v = await verifyVideo(f);
  must(v.ok, "video hỏng: " + v.errors.join(" | "));
  return `${m.width}x${m.height}, ${m.duration.toFixed(1)}s`;
}

// Nguồn mẫu: 6 giây 16:9 có tiếng + 1 cảnh dọc 9:16 + 1 "giọng đọc" 5 giây.
const SRC = path.join(DIR, "nguon.mp4"), VERT = path.join(DIR, "doc.mp4"), VOICE = path.join(DIR, "giong.m4a");
await run(FFMPEG, ["-y", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", SRC]);
await run(FFMPEG, ["-y", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", VERT]);
await run(FFMPEG, ["-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=5", "-c:a", "aac", VOICE]);
const words = ["Chào", "men", "tơ", "Club", "hôm", "nay", "mình", "học"].map((w, i) => ({ word: " " + w, start: 0.3 + i * 0.6, end: 0.8 + i * 0.6 }));
const pre = { words, segments: [{ start: 0.3, end: 5, text: words.map((w) => w.word).join("").trim() }] };
const quiet = () => {};

const frames = listFrames();
await check("Có khung thương hiệu", async () => { must(frames.length > 0, "assets/frames trống"); return frames.map((f) => f.name).join(", "); });

const outs = {};
for (const rf of ["blur", ...frames.map((f) => "frame:" + f.id)]) {
  await check(`Dựng video 9:16 · ${rf}`, async () => {
    const out = path.join(DIR, `dung-${rf.replace(/\W+/g, "-")}.mp4`);
    await autoEdit(SRC, { id: "kt-" + rf.replace(/\W+/g, "-"), outPath: out, reframe: rf, doCutSilence: false, preTranscript: pre,
      hookText: "Kiểm thử hook", cta: false, punch: false, shake: false, onLog: quiet });
    outs[rf] = out;
    must(readLayerMeta(out), "thiếu lớp đổi khung");
    return await okVideo(out);
  });
}
if (outs.blur && frames.length) {
  let cur = outs.blur;
  for (const f of frames) {
    await check(`Đổi khung nhanh · nền mờ → ${f.name}`, async () => { cur = (await swapFrame(cur, "frame:" + f.id, { onLog: quiet })).outPath; return await okVideo(cur); });
  }
  await check("Đổi khung nhanh · về nền mờ", async () => { cur = (await swapFrame(cur, "blur", { onLog: quiet })).outPath; return await okVideo(cur); });
}
if (frames.length) {
  await check(`Short lồng voice · ${frames[0].name}`, async () => {
    const out = path.join(DIR, "voice-khung.mp4");
    await voiceShort([SRC, VERT], VOICE, { id: "kt-voice", outPath: out, reframe: "frame:" + frames[0].id, doCaptions: false, cta: false, onLog: quiet });
    return await okVideo(out);
  });
}
await check("Khử ồn giọng (RNNoise) khi dựng", async () => {
  const out = path.join(DIR, "khu-on.mp4");
  await autoEdit(SRC, { id: "kt-khu-on", outPath: out, reframe: "blur", doCutSilence: false, doCaptions: false, cta: false, punch: false, shake: false, voiceClean: "medium", onLog: quiet });
  return await okVideo(out);
});
await check("Từ điển tên riêng", async () => {
  const d = applyDictionary(JSON.parse(JSON.stringify(pre)), quiet);
  must(d.words.map((w) => w.word).join("").includes("Mentor Club"), "không sửa 'men tơ' → 'Mentor'");
  return d.words.map((w) => w.word).join("").trim();
});
await check("Nhận link Record Zoom Lark", async () => {
  must(parseLarkMinutes("https://studiosuccess.sg.larksuite.com/minutes/obsgbw9pwz2clhv6582krqyk") === "obsgbw9pwz2clhv6582krqyk", "không bóc được mã buổi");
  must(!parseLarkMinutes("https://youtube.com/watch?v=abc"), "nhận nhầm link YouTube");
});

// API + an toàn (chỉ khi phần mềm đang chạy)
const BASE = "http://127.0.0.1:" + (process.env.VSS_PORT || 5178);
let up = false; try { up = (await fetch(BASE + "/api/health")).ok; } catch { up = false; }
if (up) {
  const get = (p, h = {}) => fetch(BASE + p, { headers: h });
  await check("API · trang chủ + tệp giao diện", async () => { for (const p of ["/", "/js/core.js", "/ui.js", "/js/khung.js", "/style.css"]) must((await get(p)).ok, p); });
  await check("API · khung, kho, việc", async () => { for (const p of ["/api/frames", "/api/kho", "/api/jobs"]) must((await get(p)).ok, p); });
  await check("An toàn · chặn đọc .secrets và tệp chữ ngoài phần mềm", async () => {
    must((await get("/api/file?path=" + encodeURIComponent("H:/HOÁ TRI THỨC/.secrets/meta-ads.env"))).status >= 400, ".secrets đọc được");
    must((await get("/api/file?path=" + encodeURIComponent("H:/HOÁ TRI THỨC/CLAUDE.md"))).status === 403, "CLAUDE.md đọc được");
  });
  await check("An toàn · chặn tên miền lạ (DNS rebinding)", async () => {
    // fetch() tự bỏ tiêu đề Host → dùng http.request để gửi Host lạ thật.
    const http = await import("node:http");
    const code = await new Promise((res, rej) => http.request(BASE + "/api/health", { headers: { Host: "evil.example.com" } }, (r) => { r.resume(); res(r.statusCode); }).on("error", rej).end());
    must(code === 403, "không chặn Host lạ (mã " + code + ")");
  });
  await check("An toàn · không mở CORS", async () => { must(!(await get("/api/health")).headers.get("access-control-allow-origin"), "vẫn mở CORS"); });

  // Duyệt trục thời gian (gộp từ bản học viên 05/08): plan → render qua hàng đợi.
  const post = async (p, b) => (await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();
  const waitJob = async (id) => { for (;;) { await new Promise((r) => setTimeout(r, 1500)); const j = await (await get("/api/job/" + id)).json(); if (!["running", "queued"].includes(j.status)) { must(j.status === "done", j.error || j.status); return j.result; } } };
  const quick = { doCaptions: false, makeThumb: false, makeContent: false, postLark: false, cta: false, model: "small" };
  await check("Dải khung hình + sóng âm (trục duyệt)", async () => {
    const r = await (await get("/api/filmstrip?path=" + encodeURIComponent(SRC))).json();
    must(r.ok && r.strip && r.wave, "thiếu ảnh dải khung hoặc sóng âm"); return `${r.n} khung`;
  });
  await check("Tự biên tập · duyệt rồi dựng (khung HPRKD)", async () => {
    const plan = await waitJob((await post("/api/edit/plan", { path: SRC, ...quick, doCutSilence: true })).jobId);
    must((plan.clips || []).length, "không có đoạn để duyệt");
    const res = await waitJob((await post("/api/edit/render", { source: plan.source, clips: plan.clips, keep: plan.keep, ...quick, reframe: frames.length ? "frame:" + frames[0].id : "blur", punch: false, shake: false })).jobId);
    return await okVideo(res.outPath);
  });
  await check("Short lồng voice · duyệt giọng rồi dựng", async () => {
    const plan = await waitJob((await post("/api/voiceshort/plan", { voicePath: VOICE, model: "small" })).jobId);
    must((plan.clips || []).length, "không có đoạn giọng để duyệt");
    const res = await waitJob((await post("/api/voiceshort/render", { source: plan.source, sceneClips: [SRC, VERT], clips: plan.clips, keep: plan.keep, ...quick })).jobId);
    return await okVideo(res.outPath);
  });
} else console.log("⚪ Phần mềm chưa chạy → bỏ qua kiểm API (bật phần mềm rồi chạy lại để kiểm đủ).");

const bad = results.filter((r) => !r.ok).length;
console.log(`\n${bad ? "❌" : "✅"} ${results.length - bad}/${results.length} mục đạt · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (!bad) fs.rmSync(DIR, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
