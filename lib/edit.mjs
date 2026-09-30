// Pipeline dàn dựng lại video short thành bản viral đặc sắc:
// cắt lặng/bỏ đệm → grade + chỉnh màu tay → chuyển động + punch-zoom → TRÁM B-ROLL (thư mục/AI)
// → phụ đề → flash/slide chuyển cảnh → SFX whoosh → logo → progress bar → nhạc + chuẩn âm.
import path from "node:path";
import fs from "node:fs";
import { run, WORK, __root } from "./util.mjs";
import { brandLogo, WM as BRAND_WM, brandCenterWatermark, CENTER_WM } from "./brand.mjs";
import { appendCta, defaultCta } from "./cta.mjs";
import { FFMPEG, probe, detectSilences, detectScenes, hasNvenc, verifyVideo } from "./ffmpeg.mjs";
import { transcribeWords, buildAssCaptions, saveAss, buildHookAss, buildOverlayAss } from "./transcribe.mjs";
import { colorGrade, manualColor, sharpenFilter, motionZoompan, filmLook, progressBar, brollNormalize, flashEnable, logoScaleFilter, logoPosition, logoPositionXY, smoothFilter, voiceCleanFilter } from "./effects.mjs";
import { indexFolder, planBroll } from "./broll.mjs";
import { planClipCuts, remapTranscript } from "./fillers.mjs";
import { correctTranscript } from "./aiclean.mjs";
import { ensureWhoosh } from "./sfx.mjs";
import { ensureBuiltinStickers, indexStickers, planStickers, stickerNormalize, stickerOverlayXY, STK_DIR } from "./stickers.mjs";
import { planAiBroll } from "./aibroll.mjs";
import { prepareVoiceIsolation } from "./voiceisolate.mjs";
import { resolveFont, assFilter } from "./fonts.mjs";
import { resolveMusicInput, resolveBrollInput } from "./media-input.mjs";
import { resolveFrame, layerDirFor, writeLayerMeta } from "./frames.mjs";

const TARGET_W = 1080, TARGET_H = 1920, FPS = 30;

function speechSegments(silences, dur, pad = 0.08) {
  const keep = [];
  let cursor = 0;
  for (const s of silences) {
    const segEnd = Math.max(cursor, s.start - pad);
    if (segEnd - cursor > 0.15) keep.push([cursor, segEnd]);
    cursor = Math.min(dur, s.end + pad);
  }
  if (dur - cursor > 0.15) keep.push([cursor, dur]);
  return keep.length ? keep : [[0, dur]];
}

// Cắt video theo danh sách khoảng GIỮ LẠI.
async function cutByRanges(input, keep, out, onLog) {
  if (!keep || !keep.length) return input;
  const sel = keep.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join("+");
  const useGpu = await hasNvenc();
  await run(FFMPEG, [
    "-hide_banner", "-y", "-i", input,
    "-filter_complex",
    `[0:v]select='${sel}',setpts=N/FRAME_RATE/TB[v];[0:a]aselect='${sel}',asetpts=N/SR/TB[a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", useGpu ? "h264_nvenc" : "libx264", "-preset", useGpu ? "p4" : "veryfast",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", out,
  ], { onLog: (l) => onLog("  " + l) });
  return out;
}

// Cắt CHỈ khoảng lặng (khi không có transcript). Mạnh tay hơn: -32dB, 0.35s.
async function cutSilence(input, id, { onLog }) {
  const meta = await probe(input);
  const silences = await detectSilences(input, -32, 0.35);
  if (!silences.length) { onLog("  (không có khoảng lặng đáng kể — bỏ qua)"); return input; }
  const segs = speechSegments(silences, meta.duration);
  onLog(`  giữ ${segs.length} đoạn có tiếng, bỏ ${silences.length} khoảng lặng`);
  return cutByRanges(input, segs, path.join(WORK, `${id}_cut.mp4`), onLog);
}

// ⏩ Tăng tốc toàn video (video setpts + audio atempo giữ cao độ). Hỗ trợ >2x bằng chuỗi atempo.
async function applySpeed(inPath, outPath, speed, onLog) {
  const useGpu = await hasNvenc();
  let s = speed; const chain = [];
  while (s > 2.0 + 1e-9) { chain.push("atempo=2.0"); s /= 2.0; }
  while (s < 0.5 - 1e-9) { chain.push("atempo=0.5"); s /= 0.5; }
  chain.push(`atempo=${s.toFixed(4)}`);
  await run(FFMPEG, [
    "-hide_banner", "-y", "-i", inPath,
    "-filter_complex", `[0:v]setpts=PTS/${speed}[v];[0:a]${chain.join(",")}[a]`,
    "-map", "[v]", "-map", "[a]", "-r", String(FPS),
    ...(useGpu ? ["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "23", "-b:v", "0"] : ["-c:v", "libx264", "-preset", "medium", "-crf", "20"]),
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", outPath,
  ], { cwd: WORK, onLog });
  return outPath;
}

// Chuỗi filter "dựng nền chính": khử interlace → reframe 9:16 → grade → chỉnh màu tay → chuyển động → film.
function buildMainGraph({ reframe, frame = null, colorLevel, manual, smooth, sharpen, punch, shake, film, sceneCuts, climaxAtSec = null }) {
  let graph = `[0:v]yadif=0:-1:0,fps=30,setpts=PTS-STARTPTS[dei];`;
  if (frame) {
    // 🖼️ Khung chương trình: nền mờ phủ kín, video co vừa Ô VIDEO của khung (lớp khung phủ sau ở renderFinal).
    const { x, y, w, h } = frame.hole;
    graph +=
      `[dei]split=2[bg][fg];` +
      `[bg]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,crop=${TARGET_W}:${TARGET_H},gblur=sigma=22[bgb];` +
      `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs];` +
      `[bgb][fgs]overlay=${x}+(${w}-w)/2:${y}+(${h}-h)/2[r];`;
  } else if (reframe === "blur") {
    graph +=
      `[dei]split=2[bg][fg];` +
      `[bg]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,crop=${TARGET_W}:${TARGET_H},gblur=sigma=22[bgb];` +
      `[fg]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease[fgs];` +
      `[bgb][fgs]overlay=(W-w)/2:(H-h)/2[r];`;
  } else if (reframe === "fill") {
    graph += `[dei]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,crop=${TARGET_W}:${TARGET_H}[r];`;
  } else {
    graph += `[dei]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2[r];`;
  }
  const post = [];
  // Làm mịn TRƯỚC grade (khử nhiễu rồi mới tăng tương phản/nét)
  const sm = smooth && smooth !== "off" ? smoothFilter(smooth) : null;
  if (sm) post.push(sm);
  const cg = colorLevel && colorLevel !== "off" ? colorGrade(colorLevel) : null;
  if (cg) post.push(cg);
  const mc = manualColor(manual || {});
  if (mc) post.push(mc);
  const sh = sharpenFilter(sharpen);
  if (sh) post.push(sh);
  // Chèn chuyển động khi có punch/shake HOẶC khi cần nhấn cao trào (zoom đẩy vào câu đắt).
  if (punch || shake || (climaxAtSec != null)) post.push(motionZoompan({ sceneCuts, shake, punch, climaxAtSec }));
  const fl = film ? filmLook({ vignette: true, grain: 6 }) : null;
  if (fl) post.push(fl);
  graph += `[r]${post.length ? post.join(",") : "null"}[mv]`;
  return { graph, out: "[mv]" };
}

// Nhánh audio: (giữ giọng/khử tạp âm) → nhạc ducking + SFX whoosh + chuẩn âm.
function buildAudioFull({ base, musicIdx, musicPath, musicVol, sfxItems, sfxVol, normalize, voiceClean, climaxAtSec = null }) {
  let graph = "";
  // Khử tạp âm giọng nói TRƯỚC (trên audio gốc), rồi mới trộn nhạc/sfx.
  let src = base;
  const vc = voiceCleanFilter(voiceClean);
  if (vc) { graph += `${base}${vc}[vc]`; src = "[vc]"; }
  let cur = src;
  if (musicPath && musicIdx != null) {
    // Nhạc lặp vô hạn ở âm lượng nền. 🔥 Nếu có câu cao trào → DÂNG nhạc quanh mốc đó
    // (theo THỜI GIAN VIDEO, áp SAU aloop nên không lệch khi nhạc lặp).
    let mlabel = "[mloop]";
    let block = `[${musicIdx}:a]volume=${musicVol},aloop=loop=-1:size=2e9[mloop]`;
    if (climaxAtSec != null && Number(climaxAtSec) >= 0) {
      const c = Number(climaxAtSec);
      const win = `max(0\\,min(1\\,min((t-${(c - 1.0).toFixed(2)})/1.0\\,(${(c + 1.7).toFixed(2)}-t)/0.6)))`;
      block += `;[mloop]volume='1+0.9*(${win})':eval=frame[mswell]`;
      mlabel = "[mswell]";
    }
    graph += `${graph ? ";" : ""}${block};` +
      `${mlabel}${src}sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[mduck];` +
      `${src}[mduck]amix=inputs=2:normalize=0:duration=first[amx]`;
    cur = "[amx]";
  }
  if (sfxItems && sfxItems.length) {
    const labels = [];
    sfxItems.forEach((s, i) => {
      const ms = Math.max(0, Math.round(s.t * 1000));
      graph += `${graph ? ";" : ""}[${s.idx}:a]adelay=${ms}|${ms},volume=${sfxVol}[sx${i}]`;
      labels.push(`[sx${i}]`);
    });
    graph += `;${cur}${labels.join("")}amix=inputs=${1 + labels.length}:normalize=0:duration=first[amx2]`;
    cur = "[amx2]";
  }
  let aOut = cur === "[0:a]" ? "0:a" : cur;
  if (normalize) {
    graph += `${graph ? ";" : ""}${cur}loudnorm=I=-14:TP=-1.5:LRA=11[aout]`;
    aOut = "[aout]";
  }
  return { audioGraph: graph, aOut };
}

// Render cuối: chèn b-roll + flash + phụ đề + hook + logo + progress + audio.
async function renderFinal(o) {
  const {
    baseFile, mainGraph, mainOut, plan = [], brollTransition = "fade",
    flashExpr, assFile, hookFile, overlayFile, progress, styledDur,
    logo, watermarkPath, centerWmPath, sfxFile, sfxTimes = [], sfxVol = 0.6,
    musicPath, musicVol, normalize, voiceClean, encV, outPath, onLog,
    climaxAtSec = null, frame = null, plate = null,
  } = o;

  const args = ["-hide_banner", "-y", "-i", baseFile];
  let complex, v;
  if (mainGraph) { complex = mainGraph; v = mainOut; }
  else { complex = `[0:v]null[base0]`; v = "[base0]"; }

  // Có khung chương trình → b-roll chỉ lấp Ô VIDEO, không phủ cả khung.
  const bx = frame ? frame.hole : { x: 0, y: 0, w: TARGET_W, h: TARGET_H };
  let idx = 1;
  plan.forEach((p, i) => {
    if (p.kind === "image") args.push("-loop", "1", "-t", String(p.dur), "-i", p.file);
    else args.push("-i", p.file);
    const inIdx = idx++;
    complex += `;[${inIdx}:v]${brollNormalize({ kind: p.kind, dur: p.dur, start: p.start, w: bx.w, h: bx.h, tag: frame ? `bf${i}` : null })}[b${i}]`;
    const s = p.start.toFixed(3), e = (p.start + p.dur).toFixed(3);
    const s25 = (p.start + 0.25).toFixed(3);
    let xexpr = `x=${bx.x}`, yexpr = `y=${bx.y}`;
    if (brollTransition === "slide") xexpr = `x='${bx.x}+if(between(t,${s},${s25}),(1-(t-${s})/0.25)*${bx.w},0)'`;
    else if (brollTransition === "slideup") yexpr = `y='${bx.y}+if(between(t,${s},${s25}),(1-(t-${s})/0.25)*${bx.h},0)'`;
    complex += `;${v}[b${i}]overlay=${xexpr}:${yexpr}:eof_action=pass:enable='between(t,${s},${e})'[ov${i}]`;
    v = `[ov${i}]`;
  });

  // 🏷️ NHÃN/STICKER: đẩy input + chuẩn hoá (gán idx tại đây; overlay ở dưới sau phụ đề)
  const stk = [];
  (o.stickerPlan || []).forEach((sp, i) => {
    args.push("-loop", "1", "-t", String(sp.dur), "-i", sp.file);
    const inIdx = idx++;
    complex += `;[${inIdx}:v]${stickerNormalize({ size: sp.size, dur: sp.dur, start: sp.start, targetW: TARGET_W })}[stk${i}]`;
    stk.push(sp);
  });

  if (flashExpr) { complex += `;${v}drawbox=x=0:y=0:w=iw:h=ih:color=white@0.5:t=fill:enable='${flashExpr}'[vf]`; v = "[vf]"; }
  // 🧱 LỚP VIDEO SẠCH (để ĐỔI KHUNG sau này không phải dựng lại): cắt đúng vùng video
  // trên nền đã có hiệu ứng + b-roll, TRƯỚC khung và chữ. Xuất song song cùng lượt render.
  if (plate) {
    const r = plate.rect;
    complex += `;${v}split[vkeep][vpl];[vpl]crop=${r.w}:${r.h}:${r.x}:${r.y},setsar=1[plate]`;
    v = "[vkeep]";
  }
  // 🖼️ Lớp khung chương trình: trên video + b-roll, dưới phụ đề/hook.
  if (frame) {
    args.push("-loop", "1", "-i", frame.png);
    const fIdx = idx++;
    complex += `;${v}[${fIdx}:v]overlay=0:0:shortest=1[vfr]`;
    v = "[vfr]";
  }
  if (assFile) { complex += `;${v}${assFilter(path.basename(assFile))}[vs]`; v = "[vs]"; }
  if (hookFile) { complex += `;${v}${assFilter(path.basename(hookFile))}[vh]`; v = "[vh]"; }
  if (overlayFile) { complex += `;${v}${assFilter(path.basename(overlayFile))}[vo2]`; v = "[vo2]"; }

  // Overlay các nhãn/sticker LÊN TRÊN phụ đề, đúng mốc, có nảy nhẹ
  stk.forEach((sp, i) => {
    const e = (sp.start + sp.dur).toFixed(3);
    complex += `;${v}[stk${i}]overlay=${stickerOverlayXY({ xFrac: sp.xFrac, yFrac: sp.yFrac, start: sp.start })}:enable='between(t,${sp.start.toFixed(3)},${e})'[sk${i}]`;
    v = `[sk${i}]`;
  });

  if (logo && logo.path) {
    args.push("-loop", "1", "-i", logo.path);
    const lIdx = idx++;
    complex += `;[${lIdx}:v]${logoScaleFilter({ scale: logo.scale, opacity: logo.opacity, targetW: TARGET_W })}[lg]`;
    const logoXY = (logo.x != null && logo.y != null) ? logoPositionXY(logo.x, logo.y) : logoPosition(logo.pos);
    complex += `;${v}[lg]overlay=${logoXY}:shortest=1[vl]`;
    v = "[vl]";
  }
  // WATERMARK logo Mentor — LUÔN góc TRÊN-TRÁI, cỡ nhỏ cố định.
  if (watermarkPath) {
    const _wm = Math.round(BRAND_WM.marginFrac * TARGET_W);
    args.push("-loop", "1", "-i", watermarkPath);
    const wIdx = idx++;
    complex += `;[${wIdx}:v]${logoScaleFilter({ scale: BRAND_WM.scale, opacity: 0.95, targetW: TARGET_W })}[wm]`;
    complex += `;${v}[wm]overlay=${_wm}:${_wm}:shortest=1[vwm]`;
    v = "[vwm]";
  }
  // 🌟 WATERMARK GIỮA (Hoangminhhoa.com) — canh GIỮA ngang, gần đỉnh, LUÔN có (100% video).
  if (centerWmPath) {
    args.push("-loop", "1", "-i", centerWmPath);
    const cIdx = idx++;
    const cw = Math.round(TARGET_W * CENTER_WM.scale);
    const cy = Math.round(TARGET_H * CENTER_WM.topFrac);
    complex += `;[${cIdx}:v]scale=${cw}:-1,format=rgba,colorchannelmixer=aa=${CENTER_WM.opacity}[cwm]`;
    complex += `;${v}[cwm]overlay=(W-w)/2:${cy}:shortest=1[vcw]`;
    v = "[vcw]";
  }
  if (progress) { complex += `;${v}${progressBar(styledDur)}[vp]`; v = "[vp]"; }

  let musicIdx = null;
  if (musicPath) { args.push("-i", musicPath); musicIdx = idx++; }
  const sfxItems = [];
  if (sfxFile && sfxTimes.length) {
    for (const t of sfxTimes) { args.push("-i", sfxFile); sfxItems.push({ idx: idx++, t }); }
  }
  const built = buildAudioFull({ base: "[0:a]", musicIdx, musicPath, musicVol, sfxItems, sfxVol, normalize, voiceClean, climaxAtSec });
  let aOut = built.aOut;
  if (built.audioGraph) complex += ";" + built.audioGraph;
  let aPlate = null;
  if (plate) {
    if (aOut.startsWith("[")) { complex += `;${aOut}asplit[aFin][aPl]`; aOut = "[aFin]"; aPlate = "[aPl]"; }
    else aPlate = aOut;
  }

  args.push("-filter_complex", complex, "-map", v, "-map", aOut,
    "-r", String(FPS), ...encV, "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", outPath);
  if (plate) args.push("-map", "[plate]", "-map", aPlate, "-r", String(FPS),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", plate.path);
  await run(FFMPEG, args, { cwd: WORK, onLog: (l) => onLog("  " + l) });
}

export async function autoEdit(input, opts = {}) {
  const {
    onLog = () => {}, id = "job", outPath,
    doCutSilence = true, removeFillers = false, reframe = "blur",
    doCaptions = true, captionStyle = "karaoke",
    colorLevel = "clean", manual = null, smooth = "off", sharpen = 0, punch = true, shake = true, film = true,
    progress = true, flash = true, brollTransition = "fade",
    brollFolder = null, brollFill = "match",
    aiBroll = false, aiBrollCount = 6, aiBrollStyle = "điện ảnh, ánh sáng đẹp, chân thực",
    logoPath = null, logoPos = "br", logoScale = 0.16, logoOpacity = 0.9, logoX = null, logoY = null,
    sfx = false, sfxVol = 0.6,
    stickers = false, stickerFolder = null, stickerSize = 0.17,
    musicPath = null, musicVol = 0.18, normalize = true, voiceClean = "off",
    aiCorrectText = false,
    model = "small", lang = "vi",
    preTranscript = null, hookText = null,
    overlayText = null, overlayPos = "bottom",
    watermark = true,   // logo Mentor góc trên-trái (bật mặc định nếu có file)
    brandWatermark = true,   // 🌟 logo Hoangminhhoa.com GIỮA — LUÔN bật (100% video)
    speed = 1.0,        // tăng tốc toàn video (1.0 = giữ nguyên)
    cta = true, ctaPath = null,   // CTA cuối video (mọi video phải có) — ctaPath riêng hoặc assets/cta.mp4
    climaxAtSec = null, // 🔥 mốc CÂU CAO TRÀO (giây, trong short) → nhấn zoom chậm + nhạc dâng
    fontId = "arial",   // 🔤 font chữ cho MỌI chữ đắp lên video (xem lib/fonts.mjs)
    noText = false,     // 🚫 KHÔNG CHỮ: tắt sạch phụ đề + hook + chữ tay (video trần)
  } = opts;
  // 🔤 Font: phụ đề dùng đúng biến thể chọn; chữ TO (hook/chữ tay) dùng biến thể đậm nhất cùng họ.
  const capFont = resolveFont(fontId, "caption");
  const bigFont = resolveFont(fontId, "hook");
  const wantCaptions = doCaptions && !noText;
  if (noText) onLog("🚫 Chế độ KHÔNG CHỮ: bỏ phụ đề, hook, chữ tay.");
  // 🖼️ Khung chương trình (reframe "frame:<id>"): khung đã mang nhận diện → bỏ 2 watermark.
  const frame = resolveFrame(reframe);
  if (String(reframe).startsWith("frame:") && !frame) onLog(`  ⚠ không thấy khung "${reframe}" trong assets/frames → dùng nền mờ`);
  if (frame) onLog(`🖼️ ${frame.name}`);
  const watermarkPath = watermark && !frame ? await brandLogo() : null;
  const centerWmPath = brandWatermark !== false && !frame ? await brandCenterWatermark() : null;

  // 🎵/🎞️ Nhạc & cảnh trám linh hoạt: file / THƯ MỤC (tự chọn) / LINK (tải yt-dlp, có cache).
  const musicFile = await resolveMusicInput(musicPath, { onLog });
  const brollDir = await resolveBrollInput(brollFolder, { onLog });

  // 🎤 TÁCH GIỌNG khỏi nhạc/tạp âm (khi chọn cấp "isolate"): thử Demucs (bỏ hẳn nhạc),
  // không có thì tụt về bộ lọc FFmpeg mạnh. Làm SỚM để mọi bước cắt/hiệu ứng sau đều
  // kế thừa audio đã sạch.
  let voiceCleanLevel = voiceClean;
  if (voiceClean === "isolate") {
    onLog("🎤 Tách giọng nhân vật khỏi nhạc/tạp âm...");
    const iso = await prepareVoiceIsolation(input, { onLog, id });
    input = iso.input; voiceCleanLevel = iso.voiceClean;
  }

  onLog("=== BẮT ĐẦU DÀN DỰNG ===");
  let src = input;
  let pre = preTranscript;

  // 1. Cắt: ĐOẠN ĐÃ DUYỆT (trục thời gian) > bỏ tiếng đệm > cắt lặng.
  if (Array.isArray(opts.keepRanges) && opts.keepRanges.length && !pre) {
    // 👁️ Người dùng đã duyệt các khoảng giữ trên trục thời gian → cắt đúng mốc, không tự quyết lại.
    onLog(`→ Bước 1: cắt theo ${opts.keepRanges.length} khoảng ĐÃ DUYỆT trên trục thời gian...`);
    const meta0 = await probe(input);
    let words = null;
    try { const trFull = await transcribeWords(input, { model, lang, onLog: (l) => onLog("  " + l) }); words = trFull.words || []; }
    catch (e) { onLog("  ⚠ không gõ chữ được (" + e.message + ") — vẫn cắt, phụ đề sẽ gõ lại trên bản đã cắt."); }
    src = await cutByRanges(input, opts.keepRanges, path.join(WORK, `${id}_cut.mp4`), onLog);
    if (words) pre = remapTranscript(words, opts.keepRanges, 0, meta0.duration);
  } else if (removeFillers && !pre) {
    onLog("→ Bước 1: gõ chữ + cắt bỏ tiếng đệm (à/ừ/ờ) & khoảng chết...");
    const meta0 = await probe(input);
    try {
      const trFull = await transcribeWords(input, { model, lang, onLog: (l) => onLog("  " + l) });
      const { keep, cuts } = planClipCuts(trFull.words || [], 0, meta0.duration, { silenceMax: 0.5 });
      onLog(`  bỏ ${cuts.length} đoạn (đệm + chết), giữ ${keep.length} mảnh`);
      src = await cutByRanges(input, keep, path.join(WORK, `${id}_cut.mp4`), onLog);
      pre = remapTranscript(trFull.words || [], keep, 0, meta0.duration);
    } catch (e) {
      onLog("  ⚠ không cắt đệm được (" + e.message + ") → cắt lặng thường");
      if (doCutSilence) src = await cutSilence(input, id, { onLog });
    }
  } else if (doCutSilence) {
    onLog("→ Bước 1: cắt khoảng lặng chết...");
    src = await cutSilence(input, id, { onLog });
  }

  // 2. Điểm cắt cảnh (punch-zoom + flash)
  onLog("→ Bước 2: phát hiện điểm nhấn/cắt cảnh...");
  const sceneCuts = await detectScenes(src, 0.32);
  onLog(`  ${sceneCuts.length} điểm nhấn`);

  // 3. Transcript (phụ đề + b-roll)
  let tr = null, assFile = null;
  const needTranscript = wantCaptions || !!brollDir || aiBroll;
  if (needTranscript) {
    if (pre && (pre.words || []).length) { onLog("→ Bước 3: dùng transcript đã tính sẵn..."); tr = pre; }
    else {
      onLog("→ Bước 3: gõ chữ word-level...");
      try { tr = await transcribeWords(src, { model, lang, onLog: (l) => onLog("  " + l) }); }
      catch (e) {
        // Cần phụ đề mà bóc âm hỏng → DỪNG và báo thật, không xuất video thiếu chữ rồi ghi "Hoàn tất".
        if (wantCaptions) throw new Error("Bóc âm (Whisper) hỏng nên không làm được phụ đề: " + e.message);
        onLog("  ⚠ whisper lỗi (bỏ qua vì không cần phụ đề): " + e.message);
      }
    }
  }
  // AI soát & sửa chính tả phụ đề (bỏ từ vô nghĩa) — dùng cho cả phụ đề lẫn khớp b-roll
  if (aiCorrectText && tr && (tr.words || []).length) {
    try { tr = await correctTranscript(tr, { onLog, lang }); }
    catch (e) { onLog("  ⚠ AI sửa text lỗi: " + e.message); }
  }
  if (wantCaptions && tr) {
    const ass = buildAssCaptions(tr, {
      videoW: TARGET_W, videoH: TARGET_H, style: captionStyle,
      fontName: capFont.fontName, bold: capFont.bold,
      // Có khung: phụ đề neo MÉP TRÊN tại captionTop (ngay dưới video), xuống dòng thì dài xuống dưới.
      ...(frame ? { align: 8, marginV: frame.captionTop } : {}),
    });
    assFile = path.join(WORK, `${id}.ass`);
    saveAss(ass, assFile);
    onLog(`  phụ đề: ${path.basename(assFile)} (font: ${capFont.fontName})`);
  }

  // 4. Trám b-roll: AI tự tạo (Higgsfield) hoặc thư mục của người dùng
  let plan = [];
  if (aiBroll && tr) {
    onLog("→ Bước 4: trám b-roll AI (Higgsfield) tự tạo...");
    try { plan = await planAiBroll(tr, { count: aiBrollCount, style: aiBrollStyle, id, onLog: (l) => onLog("  " + l) }); }
    catch (e) { onLog("  ⚠ b-roll AI lỗi: " + e.message); }
  } else if (brollDir && tr) {
    onLog("→ Bước 4: trám b-roll từ thư mục theo lời nói...");
    const lib = await indexFolder(brollDir);
    onLog(`  thư viện: ${lib.length} file`);
    plan = planBroll(tr, lib, { fillMode: brollFill, folder: brollDir });
    onLog(`  chèn ${plan.length} cảnh (${plan.filter((p) => p.matched).length} khớp từ khóa)`);
  }

  // 5. Chuẩn bị render
  const useGpu = await hasNvenc();
  const styledDur = (await probe(src)).duration;
  // MƯỢT TỪ ĐẦU ĐẾN CUỐI: KHÔNG ép hiệu ứng/flash/zoom ở giây 3 (thứ gây "vấp").
  // Chỉ giữ hook chữ (hiện 3s đầu, fade êm) + các hiệu ứng do người dùng bật (nếu có).
  const HOOK_DUR = 3.0;
  const hasHook = !noText && !!(hookText && String(hookText).trim());
  const main = buildMainGraph({ reframe, frame, colorLevel, manual, smooth, sharpen, punch, shake, film, sceneCuts, climaxAtSec });
  const flashExpr = flash ? flashEnable(sceneCuts) : null;

  let hookFile = null;
  if (hasHook) {
    const hookAss = buildHookAss(hookText, {
      videoW: TARGET_W, videoH: TARGET_H, dur: Math.min(styledDur, HOOK_DUR),
      fontName: bigFont.fontName, bold: bigFont.bold,
      ...(frame ? { marginV: frame.hookTop } : {}),   // có khung: hook nằm trong ô video, không đè tên chương trình
    });
    if (hookAss) { hookFile = path.join(WORK, `${id}.hook.ass`); saveAss(hookAss, hookFile); onLog(`  hook (chữ, fade êm): "${String(hookText).trim()}"`); }
  }

  // Chữ tay (text overlay do người dùng gõ) — hiện suốt short ở vị trí chọn.
  let overlayFile = null;
  if (!noText && overlayText && String(overlayText).trim()) {
    const ovlAss = buildOverlayAss(overlayText, {
      videoW: TARGET_W, videoH: TARGET_H, dur: styledDur, pos: overlayPos,
      fontName: bigFont.fontName, bold: bigFont.bold,
    });
    if (ovlAss) { overlayFile = path.join(WORK, `${id}.ovl.ass`); saveAss(ovlAss, overlayFile); onLog(`  chữ tay (${overlayPos}): "${String(overlayText).trim()}"`); }
  }

  // SFX: whoosh tại mốc vào b-roll (hoặc điểm cắt nếu không có b-roll)
  let sfxFile = null, sfxTimes = [];
  if (sfx) {
    try { sfxFile = await ensureWhoosh(); } catch (e) { onLog("  ⚠ không tạo được SFX: " + e.message); }
    if (sfxFile) {
      sfxTimes = plan.length ? plan.map((p) => p.start) : sceneCuts.slice(0, 8);
      sfxTimes = [...new Set(sfxTimes.map((t) => +Number(t).toFixed(2)))].filter((t) => t > 0.05).slice(0, 12);
    }
  }

  // 🏷️ NHÃN/STICKER động tại điểm nhấn (vào b-roll + cắt cảnh) — dùng thư mục hoặc built-in
  let stickerPlan = [];
  if (stickers) {
    try {
      let lib = stickerFolder ? indexStickers(stickerFolder) : [];
      if (!lib.length) { await ensureBuiltinStickers(); lib = indexStickers(STK_DIR); }
      let triggers = [...(plan.length ? plan.map((p) => p.start) : []), ...sceneCuts];
      // Không có điểm nhấn nào → rải nhãn định kỳ ~4s để video luôn sinh động
      if (!triggers.length) { for (let t = 2.5; t < styledDur - 1.5; t += 4) triggers.push(t); }
      stickerPlan = planStickers(triggers, lib, { size: stickerSize });
      onLog(`  chèn ${stickerPlan.length} nhãn/sticker động (${lib.length} mẫu)`);
    } catch (e) { onLog("  ⚠ sticker lỗi: " + e.message); }
  }

  const logo = logoPath ? { path: logoPath, pos: logoPos, scale: logoScale, opacity: logoOpacity, x: logoX, y: logoY } : null;
  const encV = useGpu
    ? ["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "23", "-b:v", "0"]
    : ["-c:v", "libx264", "-preset", "medium", "-crf", "20"];

  // 🧱 Vùng video trên khung 9:16 (để cất lớp sạch cho tính năng Đổi khung).
  let plate = null;
  try {
    let rect;
    if (frame) rect = { ...frame.hole };
    else if (reframe === "fill") rect = { x: 0, y: 0, w: TARGET_W, h: TARGET_H };
    else {
      const m0 = await probe(src);
      const k = Math.min(TARGET_W / (m0.width || TARGET_W), TARGET_H / (m0.height || TARGET_H));
      const w = Math.min(TARGET_W, Math.round((m0.width || TARGET_W) * k / 2) * 2);
      const h = Math.min(TARGET_H, Math.round((m0.height || TARGET_H) * k / 2) * 2);
      rect = { x: Math.floor((TARGET_W - w) / 4) * 2, y: Math.floor((TARGET_H - h) / 4) * 2, w, h };
    }
    // Chừa 2px mép để không dính viền nền mờ do làm tròn cỡ.
    if (rect.h < TARGET_H) { rect.y += 2; rect.h -= 4; }
    if (rect.w < TARGET_W) { rect.x += 2; rect.w -= 4; }
    fs.mkdirSync(layerDirFor(outPath), { recursive: true });
    plate = { rect, path: path.join(layerDirFor(outPath), "lop-video.mp4") };
  } catch (e) { onLog("  ⚠ không chuẩn bị được lớp đổi khung: " + e.message); }

  const common = { plate, plan, brollTransition, stickerPlan, stickerSize, flashExpr, assFile, hookFile, overlayFile, progress, styledDur, logo, watermarkPath, centerWmPath, sfxFile, sfxTimes, sfxVol, musicPath: musicFile, musicVol, normalize, voiceClean: voiceCleanLevel, encV, outPath, onLog, climaxAtSec, frame };

  let styledTmp = null;
  if (!plan.length) {
    onLog("→ Bước 5: dựng hiệu ứng → xuất bản (1 lượt)...");
    await renderFinal({ baseFile: src, mainGraph: main.graph, mainOut: main.out, ...common });
  } else {
    onLog("→ Bước 5A: dựng nền chính (grade + màu + chuyển động)...");
    styledTmp = path.join(WORK, `${id}_styled.mp4`);
    await run(FFMPEG, ["-hide_banner", "-y", "-i", src,
      "-filter_complex", main.graph, "-map", main.out, "-map", "0:a",
      "-r", String(FPS), ...encV, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", styledTmp,
    ], { cwd: WORK, onLog: (l) => onLog("  " + l) });
    onLog("→ Bước 5B: chèn b-roll + chuyển cảnh + phụ đề + logo → xuất bản...");
    await renderFinal({ baseFile: styledTmp, mainGraph: null, ...common });
  }
  // 🧹 Dọn NGAY file trung gian (chống work/ phình): bản nền _styled + bản cắt _cut của lần này.
  try { if (styledTmp && fs.existsSync(styledTmp)) fs.unlinkSync(styledTmp); } catch { /* kệ */ }
  try { if (src !== input && /_cut\.mp4$/i.test(src) && fs.existsSync(src)) fs.unlinkSync(src); } catch { /* kệ */ }

  // ⏩ TĂNG TỐC toàn video (trước khi ghép CTA để CTA giữ tốc độ thường).
  if (speed && speed > 0 && Math.abs(speed - 1) > 0.01) {
    onLog(`→ Tăng tốc toàn video x${speed}...`);
    const spd = outPath.replace(/\.mp4$/, "_spd.mp4");
    try { fs.renameSync(outPath, spd); await applySpeed(spd, outPath, speed, (l) => onLog("  " + l)); fs.unlinkSync(spd); }
    catch (e) { onLog("  ⚠ tăng tốc lỗi: " + e.message); if (fs.existsSync(spd) && !fs.existsSync(outPath)) fs.renameSync(spd, outPath); }
    // Lớp sạch cũng tăng tốc y như vậy để khớp tiếng/chữ khi đổi khung.
    if (plate && fs.existsSync(plate.path)) {
      const ps = plate.path.replace(/\.mp4$/, "_spd.mp4");
      try { fs.renameSync(plate.path, ps); await applySpeed(ps, plate.path, speed, () => {}); fs.unlinkSync(ps); }
      catch { try { fs.unlinkSync(ps); } catch { /* bỏ */ } }
    }
  }

  // CTA cuối video (mọi video phải có CTA) — ghép clip CTA vào cuối.
  const ctaFinal = cta ? (ctaPath || defaultCta()) : null;
  if (ctaFinal) {
    const pre = outPath.replace(/\.mp4$/, "_precta.mp4");
    try { fs.renameSync(outPath, pre); await appendCta(pre, ctaFinal, outPath, { W: TARGET_W, H: TARGET_H, onLog }); fs.unlinkSync(pre); }
    catch (e) { onLog("  ⚠ ghép CTA lỗi: " + e.message); if (fs.existsSync(pre) && !fs.existsSync(outPath)) fs.renameSync(pre, outPath); }
  }

  // 🧱 Ghi hồ sơ lớp: đủ để Đổi khung dựng lại chữ/khung mà không cần bóc âm hay AI.
  if (plate && fs.existsSync(plate.path)) {
    const sp = speed && speed > 0 ? speed : 1;
    const scaleT = (x) => ({ ...x, start: x.start / sp, end: x.end / sp });
    writeLayerMeta(outPath, {
      version: 1, plate: plate.path, reframe, speed: sp,
      tr: wantCaptions && tr ? { words: (tr.words || []).map(scaleT), segments: (tr.segments || []).map(scaleT) } : null,
      captionStyle, capFont, bigFont,
      hookText: hasHook ? String(hookText).trim() : null, hookDur: HOOK_DUR / sp,
      overlayText: !noText && overlayText ? String(overlayText).trim() : null, overlayPos,
      progress: !!progress, brandWatermark: brandWatermark !== false, cta: ctaFinal || null,
      // Nhãn động + logo tuỳ chỉnh: mang theo khi đổi khung (mốc thời gian đã chia theo tốc độ).
      stickers: (stickerPlan || []).map((x) => ({ ...x, start: x.start / sp, dur: x.dur / sp })),
      logo: logo || null,
    });
  }

  // 🩺 Tự kiểm thành phẩm: hỏng thì dựng lại 1 lần, vẫn hỏng thì báo lỗi thật.
  const chk = await verifyVideo(outPath);
  if (!chk.ok) {
    onLog("  ⚠ video xuất ra bị hỏng khi kiểm: " + chk.errors.join(" | "));
    if (!opts._retried) { onLog("  ↻ dựng lại 1 lần…"); return autoEdit(input, { ...opts, _retried: true }); }
    throw new Error("Video xuất ra bị hỏng 2 lần liên tiếp (kiểm ổ đĩa lưu).");
  }
  onLog("  🩺 đã kiểm: video nguyên vẹn");
  onLog("=== XONG ===");
  const meta = await probe(outPath);
  const transcriptText = tr ? (tr.segments || []).map((s) => s.text).join(" ").trim() : "";
  return { outPath, meta, broll: plan.length, scenes: sceneCuts.length, transcriptText };
}
