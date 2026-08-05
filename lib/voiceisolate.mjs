// 🎤 TÁCH GIỌNG NHÂN VẬT KHỎI NHẠC/TẠP ÂM (voice isolation).
// Hai cấp:
//   1) DEMUCS (AI tách nguồn của Facebook) — nếu máy đã cài → BỎ HẲN nhạc nền,
//      giữ voice sạch như studio. Đây là cách đúng nhất cho "bỏ nhạc".
//   2) FFmpeg (dialoguenhance + afftdn) — không cần cài gì, chạy ngay, GIẢM MẠNH
//      nhạc/tạp âm nhưng nhạc lớn chồng giọng vẫn còn sót chút.
// Dùng cấp voiceClean = "isolate": tự chọn Demucs nếu có, không thì tụt về FFmpeg.
import path from "node:path";
import fs from "node:fs";
import { run, WORK, SCRIPTS, PY } from "./util.mjs";
import { FFMPEG, probe } from "./ffmpeg.mjs";

// --- Có Demucs (+torch) chạy được không? Kiểm 1 lần rồi nhớ. ---
let _demucs = null;
export async function hasDemucs() {
  if (_demucs !== null) return _demucs;
  try {
    await run(PY, ["-c", "import demucs, torch"]);
    _demucs = true;
  } catch {
    _demucs = false;
  }
  return _demucs;
}

// Tìm file vocals.wav trong cây thư mục Demucs xuất ra (không phụ thuộc tên model).
function findVocals(dir) {
  let found = null;
  const walk = (d) => {
    if (found) return;
    let items = [];
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      if (found) return;
      const full = path.join(d, it.name);
      if (it.isDirectory()) walk(full);
      else if (/^vocals\.(wav|mp3|flac)$/i.test(it.name)) found = full;
    }
  };
  walk(dir);
  return found;
}

// Chạy Demucs tách VOCALS (giọng). Trả về đường dẫn file wav CHỈ CÓ GIỌNG.
export async function demucsVocals(input, { onLog = () => {}, id = "iso" } = {}) {
  // 1) Bóc audio ra wav 44.1k stereo cho Demucs đọc ổn định (khỏi lệ thuộc codec video).
  const inWav = path.join(WORK, `${id}_iso_in.wav`);
  await run(FFMPEG, ["-hide_banner", "-y", "-i", input, "-vn", "-ac", "2", "-ar", "44100", inWav],
    { onLog: (l) => onLog("  " + l) });

  // 2) Tách 2 stem (vocals / no_vocals). Demucs tự dùng GPU nếu torch thấy CUDA.
  const outDir = path.join(WORK, `${id}_demucs`);
  fs.rmSync(outDir, { recursive: true, force: true });
  onLog("  🎧 Demucs đang tách giọng khỏi nhạc (có thể lâu vài chục giây)...");
  await run(PY, ["-m", "demucs", "--two-stems=vocals", "-o", outDir, inWav],
    { onLog: (l) => onLog("  " + l) });

  const vocals = findVocals(outDir);
  if (!vocals || !fs.existsSync(vocals)) throw new Error("không thấy file vocals sau khi Demucs chạy");
  return vocals;
}

// Ghép GIỌNG ĐÃ TÁCH trở lại video (video giữ nguyên, audio thay bằng vocals).
async function muxVoice(videoPath, vocalsWav, outPath, onLog) {
  await run(FFMPEG, [
    "-hide_banner", "-y", "-i", videoPath, "-i", vocalsWav,
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-shortest", "-movflags", "+faststart", outPath,
  ], { onLog: (l) => onLog("  " + l) });
  return outPath;
}

// ĐIỀU PHỐI: gọi ở ĐẦU mỗi pipeline khi voiceClean === "isolate".
// Trả về { input, voiceClean } đã điều chỉnh:
//   - Demucs OK  → input = video đã thay audio bằng giọng sạch, voiceClean = "low"
//     (Demucs chỉ tách NHẠC khỏi giọng; ồn phòng/hiss vẫn dính trong stem vocals
//      → cho qua thêm RNNoise mức nhẹ ở bước render để sạch hẳn)
//   - Demucs thiếu/lỗi → giữ nguyên input, voiceClean = "isolate" (bộ lọc FFmpeg mạnh inline)
//   - Video không có tiếng → giữ nguyên, voiceClean = "off"
export async function prepareVoiceIsolation(input, { onLog = () => {}, id = "iso" } = {}) {
  try {
    const meta = await probe(input);
    if (!meta.hasAudio) { onLog("  ℹ Video không có tiếng — bỏ qua tách giọng."); return { input, voiceClean: "off" }; }
  } catch { /* probe lỗi → cứ thử tiếp */ }

  if (await hasDemucs()) {
    try {
      const vocals = await demucsVocals(input, { onLog, id });
      const muxed = path.join(WORK, `${id}_voiceiso.mp4`);
      await muxVoice(input, vocals, muxed, onLog);
      onLog("  ✅ Đã TÁCH GIỌNG bằng Demucs — bỏ nhạc nền, giữ voice nhân vật (+ khử ồn nhẹ khi render).");
      return { input: muxed, voiceClean: "low" };
    } catch (e) {
      onLog("  ⚠ Demucs lỗi (" + e.message + ") → dùng bộ lọc FFmpeg mạnh thay thế.");
      return { input, voiceClean: "isolate" };
    }
  }
  onLog("  ℹ Chưa cài Demucs → dùng bộ lọc FFmpeg mạnh (dialoguenhance). Cài Demucs để tách nhạc sạch hơn.");
  return { input, voiceClean: "isolate" };
}
