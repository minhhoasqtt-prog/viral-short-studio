// 👁️ LÊN KẾ HOẠCH CẮT để DUYỆT TRƯỚC KHI RENDER — dùng chung cho 3 tính năng:
// Tự biên tập 1 clip (edit) · Video dài YouTube (longedit) · Short lồng voice (voiceshort).
//
// Hai tầng dữ liệu:
//  • keep  — các mảnh giữ VI MÔ, chính xác từng 0.1s (sau khi bỏ tiếng đệm/khoảng chết).
//  • blocks — các "ĐOẠN" hiển thị trên trục thời gian (gộp mảnh liền mạch cho dễ duyệt).
// Người dùng duyệt/kéo mép trên blocks; khi render, finalKeepFromBlocks() giao lại:
// trong lòng đoạn giữ đúng vi mô (không mất chất cắt đệm), phần NỚI RA ngoài mép gốc giữ nguyên (thô).
import { probe, detectSilences } from "./ffmpeg.mjs";
import { transcribeWords } from "./transcribe.mjs";
import { planClipCuts } from "./fillers.mjs";
import { smartKeepRanges } from "./longedit.mjs";

function mergeRanges(rs) {
  const s = (rs || []).filter((r) => r[1] > r[0]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 0.001) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

// Gộp các mảnh keep liền mạch (khoảng cắt giữa chúng < maxGap) thành 1 block hiển thị.
export function groupBlocks(keep, { maxGap = 0.8 } = {}) {
  const out = [];
  for (const [a, b] of keep || []) {
    const last = out[out.length - 1];
    if (last && a - last.end <= maxGap) last.end = Math.max(last.end, b);
    else out.push({ start: a, end: b });
  }
  return out;
}

function speechSegments(silences, dur, pad = 0.08) {
  const keep = [];
  let cur = 0;
  for (const s of silences) {
    const e = Math.max(cur, s.start - pad);
    if (e - cur > 0.15) keep.push([cur, e]);
    cur = Math.min(dur, s.end + pad);
  }
  if (dur - cur > 0.15) keep.push([cur, dur]);
  return keep.length ? keep : [[0, dur]];
}

function textIn(words, a, b) {
  return (words || []).filter((w) => w.end > a && w.start < b)
    .map((w) => (w.word || "").trim()).join(" ").replace(/\s+/g, " ").trim();
}

function toBlocks(keep, words, maxGap) {
  return groupBlocks(keep, { maxGap }).map((g, i) => ({
    sourceStart: +g.start.toFixed(2), sourceEnd: +g.end.toFixed(2),
    origStart: +g.start.toFixed(2), origEnd: +g.end.toFixed(2),
    duration: +(g.end - g.start).toFixed(2),
    title: `Đoạn ${i + 1}`,
    previewText: textIn(words, g.start, g.end).slice(0, 700),
  }));
}

// Kế hoạch cắt cho VIDEO (edit / longedit) — chọn chiến lược đúng theo tuỳ chọn người dùng.
export async function planVideoKeep(file, {
  smartPrune = false, removeFillers = false, doCutSilence = true,
  focus = "", model = "medium", lang = "vi", silenceMax = 0.6, onLog = () => {},
} = {}) {
  const meta = await probe(file);
  const dur = meta.duration || 0;
  let keep = [[0, dur]], words = [], maxGap = 0.8;
  if (smartPrune) {
    const r = await smartKeepRanges(file, dur, { model, lang, onLog, focus, alsoFillers: removeFillers !== false });
    keep = r.keep; words = (r.tr && r.tr.words) || [];
    maxGap = 1.2;   // AI bỏ nguyên khúc dài — block tách theo mạch AI giữ
  } else if (removeFillers) {
    onLog("→ Gõ chữ + lên kế hoạch bỏ tiếng đệm (à/ừ) & khoảng chết...");
    const tr = await transcribeWords(file, { model, lang, onLog: (l) => onLog("  " + l) });
    words = tr.words || [];
    keep = planClipCuts(words, 0, dur, { silenceMax }).keep;
  } else if (doCutSilence) {
    onLog("→ Dò khoảng lặng chết...");
    const sil = await detectSilences(file, -32, 0.35);
    keep = speechSegments(sil, dur);
    // Gõ chữ để hiện lời trong từng đoạn (cache — render sau dùng lại, không tốn thêm).
    try { const tr = await transcribeWords(file, { model, lang, onLog: (l) => onLog("  " + l) }); words = tr.words || []; }
    catch { /* không có lời xem trước cũng duyệt được */ }
  } else {
    onLog("→ Không bật cắt tự động — cả video là MỘT đoạn, anh kéo mép nếu muốn cắt bớt.");
    try { const tr = await transcribeWords(file, { model, lang, onLog: (l) => onLog("  " + l) }); words = tr.words || []; }
    catch { /* ok */ }
  }
  return {
    duration: dur,
    keep: mergeRanges(keep).map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]),
    blocks: toBlocks(keep, words, maxGap),
  };
}

// Kế hoạch cắt cho GIỌNG ĐỌC (voiceshort) — bỏ khoảng chết/tiếng đệm trong file voice.
export async function planVoiceKeep(voicePath, { model = "medium", lang = "vi", onLog = () => {} } = {}) {
  const meta = await probe(voicePath);
  const dur = meta.duration || 0;
  let words = [], keep = [[0, dur]];
  onLog("→ Gõ chữ giọng đọc + lên kế hoạch bỏ khoảng chết...");
  try {
    const tr = await transcribeWords(voicePath, { model, lang, onLog: (l) => onLog("  " + l) });
    words = tr.words || [];
    keep = planClipCuts(words, 0, dur, { silenceMax: 0.6 }).keep;
  } catch (e) { onLog("  ⚠ whisper lỗi (" + e.message + ") → cả giọng đọc là MỘT đoạn."); }
  return {
    duration: dur,
    keep: mergeRanges(keep).map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]),
    blocks: toBlocks(keep, words, 0.8),
  };
}

// Ghép quyết định của người dùng (blocks giữ + mép đã kéo) với keep vi mô → khoảng cắt CUỐI CÙNG.
// Trong lòng mép gốc: tôn trọng vi mô (đệm/lặng vẫn bị bỏ). Nới ra ngoài mép gốc: giữ nguyên thô.
export function finalKeepFromBlocks(blocks, microKeep, dur) {
  const micro = (Array.isArray(microKeep) ? microKeep : [])
    .map(([a, b]) => [Number(a), Number(b)])
    .filter((r) => isFinite(r[0]) && isFinite(r[1]) && r[1] > r[0]);
  const out = [];
  for (const b of blocks || []) {
    const s = Math.max(0, Number(b.start ?? b.sourceStart) || 0);
    const e = Math.min(dur, Number(b.end ?? b.sourceEnd) || 0);
    if (!(e - s > 0.05)) continue;
    const os = Number(b.origStart ?? s), oe = Number(b.origEnd ?? e);
    const usable = micro.length ? micro : [[os, oe]];
    for (const [a, c] of usable) {
      const lo = Math.max(a, s, os), hi = Math.min(c, e, oe);
      if (hi - lo > 0.05) out.push([lo, hi]);
    }
    if (s < os) out.push([s, Math.min(os, e)]);   // nới mép TRÁI ra vùng từng bị cắt → lấy lại thô
    if (e > oe) out.push([Math.max(oe, s), e]);   // nới mép PHẢI
  }
  return mergeRanges(out.map(([a, b]) => [+(+a).toFixed(3), +(+b).toFixed(3)]));
}
