// Bóc ý tưởng từ video viral: tải bằng yt-dlp, gõ chữ, phân tích hook + cấu trúc + nhịp.
import path from "node:path";
import fs from "node:fs";
import { run, WORK, __root, slug } from "./util.mjs";
import { evaluate } from "./evaluate.mjs";
import { isDriveUrl, driveDownload } from "./drive.mjs";

// yt-dlp: VSS_YTDLP > bản trong .venv của phần mềm > bản hệ thống (cùng lý do với PY ở util.mjs).
const VENV_YTDLP = path.join(__root, ".venv", ...(process.platform === "win32" ? ["Scripts", "yt-dlp.exe"] : ["bin", "yt-dlp"]));
const YTDLP = process.env.VSS_YTDLP || (fs.existsSync(VENV_YTDLP) ? VENV_YTDLP : "yt-dlp");

// Tải video từ URL về work/. Trả về đường dẫn file.
// Link GOOGLE DRIVE đi đường riêng (drive.mjs) vì yt-dlp hay hỏng với Drive;
// nếu đường riêng vẫn tắc thì mới thử lại bằng yt-dlp.
export async function download(url, { onLog = () => {}, id = "dl" } = {}) {
  let driveErr = null;
  if (isDriveUrl(url)) {
    try {
      return await driveDownload(url, { onLog });
    } catch (e) {
      driveErr = e;
      onLog("⚠ Tải Drive trực tiếp hỏng: " + e.message);
      onLog("→ Thử lại bằng yt-dlp…");
    }
  }
  const outTpl = path.join(WORK, `${id}.%(ext)s`);
  onLog("→ Tải video bằng yt-dlp...");
  try {
    await run(
      YTDLP,
      [
        "-f", "mp4/bestvideo[ext=mp4]+bestaudio/best",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", outTpl,
        url,
      ],
      { onLog: (l) => onLog("  " + l) }
    );
  } catch (e) {
    // Link Drive mà cả hai đường đều tắc → báo LÝ DO THẬT (quyền chia sẻ), đừng để lỗi yt-dlp che mất.
    if (driveErr) throw driveErr;
    throw e;
  }
  // tìm file vừa tải
  const files = fs.readdirSync(WORK).filter((f) => f.startsWith(id + ".") && /\.(mp4|mkv|webm|mov)$/i.test(f));
  if (!files.length) throw new Error(driveErr ? driveErr.message : "Không tìm thấy file tải về");
  return path.join(WORK, files.sort()[0]);
}

// Bóc ý tưởng: phân tích kỹ thuật + tách hook/cấu trúc từ transcript.
export async function extractIdeas(file, { onLog = () => {}, lang = "vi", model = "small" } = {}) {
  const ev = await evaluate(file, { onLog, doTranscript: true, model, lang });
  const tr = ev._transcript;

  // Hook = 3s đầu của transcript
  let hookText = "";
  let bodyBeats = [];
  if (tr && tr.segments?.length) {
    hookText = tr.segments.filter((s) => s.start <= 4).map((s) => s.text).join(" ").trim();
    // Chia "nhịp" theo segment (mỗi câu = 1 beat)
    bodyBeats = tr.segments.map((s) => ({
      t: Math.round(s.start),
      text: s.text,
    }));
  }

  return {
    file,
    meta: ev.meta,
    overall: ev.overall,
    signals: ev.signals,
    hook: hookText || "(không nghe được lời mở đầu)",
    beats: bodyBeats,
    transcript: ev.transcriptText,
    structure: {
      durationSec: Math.round(ev.meta.duration),
      cutsPerMin: ev.signals.cutsPerMin,
      wpm: ev.signals.wpm,
      is916: ev.meta.is916,
    },
  };
}

export { YTDLP };
