import fs from "node:fs";
import path from "node:path";
import { ASSETS, WORK } from "./util.mjs";
// Bộ hiệu ứng "đặc sắc" dựng bằng ffmpeg: color grade điện ảnh, chuyển động máy quay
// (camera shake) + punch-zoom theo nhịp, vignette/grain, progress bar, flash chuyển cảnh.
// Mỗi hàm trả về một CHUỖI filter nối được bằng dấu phẩy (trừ nơi ghi chú).

const FPS = 30;

// --- Color grade: preset màu. "clean" = TRONG TRẺO (sáng, sạch, tự nhiên) là mặc định đẹp ---
export function colorGrade(level = "clean") {
  // TRONG TRẺO: nâng sáng nhẹ + lift bóng cho thoáng, bão hoà vừa phải (không rực),
  // cân bằng trắng hơi mát cho da sạch, tăng nét vừa. Nhìn "trong" như CapCut clean.
  if (level === "clean") {
    return [
      "eq=contrast=1.04:saturation=1.06:brightness=0.035:gamma=1.03",
      "curves=all='0/0.04 0.25/0.28 0.5/0.52 0.75/0.78 1/1'", // lift bóng + sáng nhẹ = airy
      "colorbalance=rs=-0.02:bs=0.03:rm=-0.02:bm=0.02",         // trắng hơi mát, da sạch
      "vibrance=intensity=0.18",
      "unsharp=5:5:0.8:5:5:0",
    ].join(",");
  }
  const P = {
    low: { c: 1.06, s: 1.1, b: 0.0, g: 0.99, vib: 0.15, sharp: 0.4 },
    medium: { c: 1.12, s: 1.22, b: 0.01, g: 0.98, vib: 0.25, sharp: 0.7 },
    high: { c: 1.2, s: 1.38, b: 0.02, g: 0.96, vib: 0.38, sharp: 1.0 },
  }[level] || null;
  if (!P) return null;
  return [
    `eq=contrast=${P.c}:saturation=${P.s}:brightness=${P.b}:gamma=${P.g}`,
    `vibrance=intensity=${P.vib}`,
    `unsharp=5:5:${P.sharp}:5:5:0`,
  ].join(",");
}

// --- Tăng ĐỘ NÉT riêng (thanh trượt "Nét" 0..100) ---
export function sharpenFilter(amount = 0) {
  const a = Number(amount) || 0;
  if (a <= 0) return null;
  const luma = (a / 100 * 1.6).toFixed(2);   // 0..1.6
  return `unsharp=5:5:${luma}:5:5:0.0`;
}

// --- Chỉnh MÀU & ÁNH SÁNG thủ công (thanh trượt) ---
// brightness/contrast/saturation/warmth: -100..100 (0 = giữ nguyên).
export function manualColor({ brightness = 0, contrast = 0, saturation = 0, warmth = 0 } = {}) {
  const b = Number(brightness) || 0, c = Number(contrast) || 0,
        s = Number(saturation) || 0, w = Number(warmth) || 0;
  if (!b && !c && !s && !w) return null;
  const parts = [];
  if (b || c || s) {
    parts.push(
      `eq=brightness=${(b / 200).toFixed(3)}:contrast=${(1 + c / 100).toFixed(3)}:saturation=${(1 + s / 100).toFixed(3)}`
    );
  }
  if (w) {
    // ấm (+): thêm đỏ bớt xanh; lạnh (−): ngược lại
    const g = (w / 100) * 0.35;
    parts.push(`colorbalance=rm=${g.toFixed(3)}:gm=0:bm=${(-g).toFixed(3)}`);
  }
  return parts.join(",");
}

// --- Làm mịn video: khử nhiễu (hqdn3d) + làm mượt vùng phẳng giữ cạnh (smartblur) ---
// level: off | low | medium | high. Dùng cho video máy quay hạt/nhiễu, làm mịn da & nền.
export function smoothFilter(level = "off") {
  const P = {
    low: { dn: "2:1.5:4:4", sb: "1.0:0.3:-12" },
    medium: { dn: "3:2:6:6", sb: "1.6:0.4:-18" },
    high: { dn: "5:4:9:9", sb: "2.2:0.5:-24" },
  }[level];
  if (!P) return null;
  // hqdn3d: luma_spatial:chroma_spatial:luma_tmp:chroma_tmp
  // smartblur: luma_radius:luma_strength:luma_threshold (ngưỡng ÂM = chỉ làm mượt vùng phẳng, giữ nét cạnh)
  const [lr, ls, lt] = P.sb.split(":");
  return `hqdn3d=${P.dn},smartblur=luma_radius=${lr}:luma_strength=${ls}:luma_threshold=${lt}`;
}

// --- Logo: chuỗi scale + opacity cho input logo (overlay đặt riêng ở edit.mjs) ---
export function logoScaleFilter({ scale = 0.16, opacity = 0.9, targetW = 1080 }) {
  const w = Math.max(40, Math.round(targetW * scale));
  return `scale=${w}:-1,format=rgba,colorchannelmixer=aa=${Math.max(0, Math.min(1, opacity)).toFixed(2)}`;
}

// Vị trí overlay logo theo góc (margin M).
export function logoPosition(pos = "br", m = 40) {
  return {
    br: `W-w-${m}:H-h-${m}`, tr: `W-w-${m}:${m}`,
    tl: `${m}:${m}`, bl: `${m}:H-h-${m}`, center: `(W-w)/2:(H-h)/2`,
  }[pos] || `W-w-${m}:H-h-${m}`;
}

// Vị trí overlay logo TỰ DO theo % (x,y = 0..100: trái→phải, trên→dưới).
export function logoPositionXY(x = 92, y = 92) {
  const cx = Math.max(0, Math.min(100, Number(x))) / 100;
  const cy = Math.max(0, Math.min(100, Number(y))) / 100;
  return `(W-w)*${cx.toFixed(3)}:(H-h)*${cy.toFixed(3)}`;
}

// --- Giữ GIỌNG, khử tạp âm (ồn nền, hiss, ù, giảm nhạc nền) ---
// level: off | low | medium | high | isolate.
//  - low/medium/high: afftdn (khử nhiễu FFT) + lọc dải giọng → GIẢM tạp âm.
//  - isolate: "TÁCH NHẠC" bằng FFmpeg (dialoguenhance trích giọng kênh giữa + afftdn) —
//    đây là bản DỰ PHÒNG khi máy chưa cài Demucs. Muốn bỏ HẲN nhạc chồng giọng thì
//    cài Demucs (xem lib/voiceisolate.mjs) — pipeline sẽ tự thay audio bằng giọng sạch
//    và KHÔNG dùng bộ lọc này nữa.
// Bộ lọc chính: arnndn (RNNoise — mạng nơ-ron khử ồn giọng nói) với model assets/rnnoise/bd.rnnn.
// Đo thực tế (bản học viên 05/08): afftdn chỉ hạ ồn nền ~1 dB, RNNoise hạ ~7–8 dB mà giọng gần như nguyên.
// Model trỏ theo đường dẫn TƯƠNG ĐỐI từ work/ (lệnh render chạy cwd = work/); work khác ổ → chép sang work/_rnnoise.
// Thiếu model → tụt về chuỗi afftdn cũ, không hỏng job.
const RNN_MODEL = path.join(ASSETS, "rnnoise", "bd.rnnn");
let _rnnRel;
function rnnRel() {
  if (_rnnRel !== undefined) return _rnnRel;
  _rnnRel = null;
  try {
    if (!fs.existsSync(RNN_MODEL)) return _rnnRel;
    const rel = path.relative(WORK, RNN_MODEL);
    if (!path.isAbsolute(rel)) return (_rnnRel = rel.split(path.sep).join("/"));
    const dir = path.join(WORK, "_rnnoise"), dst = path.join(dir, "bd.rnnn");
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(RNN_MODEL).size) fs.copyFileSync(RNN_MODEL, dst);
    _rnnRel = "_rnnoise/bd.rnnn";
  } catch { _rnnRel = null; }
  return _rnnRel;
}
export function voiceCleanFilter(level = "off") {
  const RNN = rnnRel();
  if (RNN) {
    // arnndn cần 48kHz; mix < 1 pha lại chút âm gốc cho tự nhiên ở mức nhẹ.
    const Pr = {
      low: `aformat=sample_rates=48000,highpass=f=70,arnndn=m=${RNN}:mix=0.55`,
      medium: `aformat=sample_rates=48000,highpass=f=80,arnndn=m=${RNN}:mix=0.85`,
      high: `aformat=sample_rates=48000,highpass=f=90,arnndn=m=${RNN},afftdn=nr=8:nf=-28:tn=1`,
      isolate: `aformat=channel_layouts=stereo:sample_rates=48000,dialoguenhance=original=0.2:enhance=1.6:voice=2,highpass=f=90,arnndn=m=${RNN},lowpass=f=10000,speechnorm=e=6.25:r=0.0001:l=1`,
    }[level];
    if (Pr) return Pr;
  }
  const P = {
    low: "highpass=f=80,afftdn=nr=10:nf=-25:tn=1",
    medium: "highpass=f=100,afftdn=nr=18:nf=-30:tn=1,anlmdn=s=0.0006",
    high: "highpass=f=120,afftdn=nr=24:nf=-34:tn=1,anlmdn=s=0.001,lowpass=f=9000",
    // Ép stereo → dialoguenhance nhấn giọng ở kênh giữa & ép nhạc trải hai bên xuống,
    // rồi afftdn khử phần nhạc/ồn còn lại + lọc dải giọng + chuẩn hoá độ to lời nói.
    isolate: "aformat=channel_layouts=stereo:sample_rates=48000,dialoguenhance=original=0.2:enhance=1.6:voice=2,highpass=f=90,afftdn=nr=24:nf=-32:tn=1,anlmdn=s=0.001,lowpass=f=8500,speechnorm=e=6.25:r=0.0001:l=1",
  }[level];
  return P || null;
}

// --- Chuyển động: camera shake + punch-zoom theo các điểm cắt cảnh (zoompan) ---
// sceneCuts: mảng giây (mốc cắt/nhấn). shake/punch bật/tắt.
// climaxAtSec: nếu có → NHẤN CAO TRÀO (zoom chậm đẩy vào câu đắt nhất rồi thả êm).
export function motionZoompan({ sceneCuts = [], shake = true, punch = true, baseZoom = 1.03, climaxAtSec = null } = {}) {
  // pulse zoom quanh mỗi cut: cộng dồn các gauss (giới hạn để biểu thức không quá dài)
  const cuts = sceneCuts.slice(0, 24);
  let pulse = "0";
  if (punch && cuts.length) {
    pulse = cuts
      .map((c) => `0.12*exp(-pow((on/${FPS}-${c.toFixed(2)})/0.16\\,2))`)
      .join("+");
  }
  // 🔥 NHẤN CAO TRÀO: zoom chậm ĐẨY VÀO ~1.2s trước câu cao trào → GIỮ qua câu (1.3s)
  //    → thả êm (0.6s). Biên độ +0.16 (chậm, "điện ảnh"), cộng dồn vào z. Hình thang mượt.
  let climax = "";
  if (climaxAtSec != null && Number(climaxAtSec) >= 0) {
    const c = Number(climaxAtSec), t = `on/${FPS}`;
    climax = `+0.16*max(0\\,min(1\\,min((${t}-${(c - 1.2).toFixed(2)})/1.2\\,(${(c + 1.9).toFixed(2)}-${t})/0.6)))`;
  }
  const z = `'min(1.6\\,${baseZoom}${punch ? "+" + pulse : ""}${climax})'`;
  const shx = shake ? `+7*sin(on/${FPS}*6.283*0.9)` : "";
  const shy = shake ? `+7*cos(on/${FPS}*6.283*1.13)` : "";
  const x = `'iw/2-(iw/zoom/2)${shx}'`;
  const y = `'ih/2-(ih/zoom/2)${shy}'`;
  return `zoompan=z=${z}:d=1:x=${x}:y=${y}:s=1080x1920:fps=${FPS}`;
}

// --- Vignette + film grain nhẹ ---
export function filmLook({ vignette = true, grain = 6 } = {}) {
  const parts = [];
  if (vignette) parts.push("vignette=PI/5");
  if (grain > 0) parts.push(`noise=alls=${grain}:allf=t`);
  return parts.length ? parts.join(",") : null;
}

// --- Progress bar chạy trên cùng (t phụ thuộc thời lượng) ---
export function progressBar(durSec, color = "0xFF2D6F") {
  return `drawbox=x=0:y=0:w='iw*t/${durSec.toFixed(3)}':h=12:color=${color}@0.95:t=fill`;
}

// --- Chuỗi filter chuẩn hoá 1 clip b-roll về 1080x1920 có alpha + fade chuyển cảnh ---
// kind: 'video' | 'image'. dur: độ dài hiển thị. start: mốc đặt trên timeline chính.
// w/h: cỡ ô cần lấp (mặc định cả khung 9:16; khung chương trình truyền cỡ Ô VIDEO).
// tag: nhãn riêng (bắt buộc khi lấp Ô VIDEO của khung) — lúc đó clip được CO VỪA ô, phần thừa là nền mờ
// của chính clip (clip dọc không bị cắt mất nửa hình như kiểu cắt đầy).
export function brollNormalize({ kind, dur, start, flash = true, w = 1080, h = 1920, tag = null }) {
  const fadeD = 0.15;
  const fadeOutSt = Math.max(0, dur - fadeD).toFixed(3);
  const chain = [];
  const fitHole = tag && !(w === 1080 && h === 1920);
  if (kind === "video" && fitHole) {
    chain.push(`trim=0:${dur.toFixed(3)}`, `setpts=PTS-STARTPTS`, `fps=${FPS}`,
      `split=2[${tag}a][${tag}b];[${tag}a]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=20[${tag}c];` +
      `[${tag}b]scale=${w}:${h}:force_original_aspect_ratio=decrease[${tag}d];[${tag}c][${tag}d]overlay=(W-w)/2:(H-h)/2`);
  } else if (kind === "video") {
    chain.push(`trim=0:${dur.toFixed(3)}`, `setpts=PTS-STARTPTS`);
    chain.push(`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`);
    chain.push(`fps=${FPS}`);
  } else {
    // ảnh: kenburns nhẹ cho đỡ tĩnh
    const bw = Math.round(w * 1.1 / 2) * 2, bh = Math.round(h * 1.1 / 2) * 2;
    chain.push(w === 1080 && h === 1920 ? `scale=1188:2112` : `scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh}`);
    chain.push(
      `zoompan=z='min(1.15\\,1.001+0.0016*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${FPS}`
    );
  }
  chain.push("format=yuva420p");
  chain.push(`fade=t=in:st=0:d=${fadeD}:alpha=1`);
  chain.push(`fade=t=out:st=${fadeOutSt}:d=${fadeD}:alpha=1`);
  // dịch PTS để hiển thị đúng mốc start trên timeline chính
  chain.push(`setpts=PTS-STARTPTS+${start.toFixed(3)}/TB`);
  return chain.join(",");
}

// --- Flash trắng chớp nhanh tại các mốc chuyển cảnh (overlay lớp trắng mờ) ---
export function flashEnable(cuts, halfWidth = 0.06) {
  if (!cuts || !cuts.length) return null;
  return cuts
    .slice(0, 30)
    .map((c) => `between(t,${(c - halfWidth).toFixed(2)},${(c + halfWidth).toFixed(2)})`)
    .join("+");
}

export { FPS };
