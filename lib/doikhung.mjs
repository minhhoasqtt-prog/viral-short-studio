// 🖼️ ĐỔI KHUNG KHÔNG DỰNG LẠI — video đã xuất nhưng chưa ưng khung → bấm đổi.
// Lấy "lớp video sạch" cất lúc dựng (lib/frames.mjs layerDirFor), ghép vào khung mới,
// in lại phụ đề/hook/chữ tay đúng vị trí khung mới, gắn lại CTA. KHÔNG bóc âm, KHÔNG AI,
// KHÔNG chạy lại hiệu ứng/b-roll → chỉ 1 lượt ghép nhanh.
import path from "node:path";
import fs from "node:fs";
import { run, WORK } from "./util.mjs";
import { FFMPEG, probe, hasNvenc } from "./ffmpeg.mjs";
import { resolveFrame, readLayerMeta, writeLayerMeta } from "./frames.mjs";
import { buildAssCaptions, saveAss, buildHookAss, buildOverlayAss } from "./transcribe.mjs";
import { progressBar, logoScaleFilter, logoPosition, logoPositionXY } from "./effects.mjs";
import { stickerNormalize, stickerOverlayXY } from "./stickers.mjs";
import { assFilter } from "./fonts.mjs";
import { brandCenterWatermark, CENTER_WM } from "./brand.mjs";
import { appendCta } from "./cta.mjs";

const W = 1080, H = 1920, FPS = 30;

export const hasFrameLayer = (outPath) => !!readLayerMeta(outPath);

export async function swapFrame(outPath, reframe, { onLog = () => {} } = {}) {
  const meta = readLayerMeta(outPath);
  if (!meta) {
    const e = new Error("Video này dựng trước khi có tính năng Đổi khung, chưa có lớp video sạch.");
    e.code = "NO_LAYER";
    throw e;
  }
  const frame = resolveFrame(reframe);
  const mode = frame ? "frame" : (reframe === "fill" ? "fill" : "blur");
  onLog(`🖼️ Đổi khung → ${frame ? frame.name : mode === "fill" ? "9:16 cắt đầy" : "9:16 nền mờ"} (không dựng lại)`);
  const dur = (await probe(meta.plate)).duration || 1;
  const tag = "doikhung-" + Date.now();

  const args = ["-hide_banner", "-y", "-i", meta.plate];
  let idx = 1;
  let g;
  if (mode === "fill") {
    g = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[c]`;
  } else {
    const hole = frame ? frame.hole : { x: 0, y: 0, w: W, h: H };
    g = `[0:v]split=2[bg][fg];` +
      `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=22[bgb];` +
      `[fg]scale=${hole.w}:${hole.h}:force_original_aspect_ratio=decrease[fgs];` +
      `[bgb][fgs]overlay=${hole.x}+(${hole.w}-w)/2:${hole.y}+(${hole.h}-h)/2,setsar=1[c]`;
  }
  let v = "[c]";
  if (frame) {
    args.push("-loop", "1", "-i", frame.png);
    g += `;${v}[${idx++}:v]overlay=0:0:shortest=1[cf]`; v = "[cf]";
  } else if (meta.brandWatermark) {
    const wm = await brandCenterWatermark();
    if (wm) {
      args.push("-loop", "1", "-i", wm);
      const cw = Math.round(W * CENTER_WM.scale), cy = Math.round(H * CENTER_WM.topFrac);
      g += `;[${idx++}:v]scale=${cw}:-1,format=rgba,colorchannelmixer=aa=${CENTER_WM.opacity}[cwm];${v}[cwm]overlay=(W-w)/2:${cy}:shortest=1[cw]`;
      v = "[cw]";
    }
  }

  // Chữ: dựng lại theo vị trí của khung mới.
  const cf = meta.capFont || {}, bf = meta.bigFont || {};
  const files = [];
  const burn = (name, ass) => {
    if (!ass) return;
    const f = path.join(WORK, `${tag}.${name}.ass`);
    saveAss(ass, f); files.push(f);
    g += `;${v}${assFilter(path.basename(f))}[t${files.length}]`; v = `[t${files.length}]`;
  };
  if (meta.tr && (meta.tr.words || []).length) {
    burn("cap", buildAssCaptions(meta.tr, {
      videoW: W, videoH: H, style: meta.captionStyle || "karaoke", fontName: cf.fontName, bold: cf.bold,
      ...(frame ? { align: 8, marginV: frame.captionTop } : {}),
    }));
  }
  if (meta.hookText) {
    burn("hook", buildHookAss(meta.hookText, {
      videoW: W, videoH: H, dur: Math.min(dur, meta.hookDur || 3), fontName: bf.fontName, bold: bf.bold,
      ...(frame ? { marginV: frame.hookTop } : {}),
    }));
  }
  if (meta.overlayText) {
    burn("ovl", buildOverlayAss(meta.overlayText, { videoW: W, videoH: H, dur, pos: meta.overlayPos || "bottom", fontName: bf.fontName, bold: bf.bold }));
  }
  // Nhãn động (sticker) — đè lên chữ như lúc dựng gốc.
  (meta.stickers || []).filter((sp) => sp.file && fs.existsSync(sp.file)).forEach((sp, i) => {
    args.push("-loop", "1", "-t", String(sp.dur), "-i", sp.file);
    g += `;[${idx++}:v]${stickerNormalize({ size: sp.size, dur: sp.dur, start: sp.start, targetW: W })}[stk${i}]`;
    g += `;${v}[stk${i}]overlay=${stickerOverlayXY({ xFrac: sp.xFrac, yFrac: sp.yFrac, start: sp.start })}:enable='between(t,${sp.start.toFixed(3)},${(sp.start + sp.dur).toFixed(3)})'[sk${i}]`;
    v = `[sk${i}]`;
  });
  // Logo tuỳ chỉnh (ô Logo lúc dựng).
  if (meta.logo && meta.logo.path && fs.existsSync(meta.logo.path)) {
    const lg = meta.logo;
    args.push("-loop", "1", "-i", lg.path);
    g += `;[${idx++}:v]${logoScaleFilter({ scale: lg.scale, opacity: lg.opacity, targetW: W })}[lg]`;
    g += `;${v}[lg]overlay=${(lg.x != null && lg.y != null) ? logoPositionXY(lg.x, lg.y) : logoPosition(lg.pos)}:shortest=1[vl]`;
    v = "[vl]";
  }
  if (meta.progress) { g += `;${v}${progressBar(dur)}[vp]`; v = "[vp]"; }

  const base = path.basename(outPath, ".mp4").replace(/-khung-[a-z0-9-]+-\d{13}$/i, "");
  const newOut = path.join(path.dirname(outPath), `${base}-khung-${frame ? frame.id : mode}-${Date.now()}.mp4`);
  const tmp = meta.cta ? newOut.replace(/\.mp4$/, "_precta.mp4") : newOut;
  const useGpu = await hasNvenc();
  args.push("-filter_complex", g, "-map", v, "-map", "0:a?", "-r", String(FPS),
    ...(useGpu ? ["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "23", "-b:v", "0"] : ["-c:v", "libx264", "-preset", "medium", "-crf", "20"]),
    "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", tmp);
  try { await run(FFMPEG, args, { cwd: WORK, onLog: (l) => onLog("  " + l) }); }
  finally { for (const f of files) { try { fs.unlinkSync(f); } catch { /* dọn */ } } }

  if (meta.cta) {
    try { await appendCta(tmp, meta.cta, newOut, { W, H, onLog }); fs.unlinkSync(tmp); }
    catch (e) { onLog("  ⚠ ghép CTA lỗi: " + e.message); if (fs.existsSync(tmp) && !fs.existsSync(newOut)) fs.renameSync(tmp, newOut); }
  }
  // Video mới dùng chung lớp sạch cũ → đổi tiếp bao nhiêu lần cũng được.
  writeLayerMeta(newOut, { ...meta, reframe });
  onLog(`✅ Xong: ${path.basename(newOut)}`);
  return { outPath: newOut, meta: await probe(newOut) };
}
