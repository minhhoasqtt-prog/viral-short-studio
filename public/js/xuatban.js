// Viral Short Studio — Xuất bản dùng chung + thẻ kết quả + đổi khung + lưu phiên.
// (Tách từ app.js; các tệp js/*.js dùng chung biến toàn cục, nạp đúng thứ tự trong index.html.)
// ================= 📦 XUẤT BẢN DÙNG CHUNG (đồng nhất mọi tính năng làm video) =================
// Đọc 3 checkbox Thumbnail/Content/Đăng Lark theo tiền tố tab + thư mục ảnh/tên từ config.
function publishBody(prefix) {
  const chk = (id) => { const e = $("#" + id); return e ? e.checked : undefined; };
  const b = {};
  const t = chk(prefix + "-mkthumb"); if (t != null) b.makeThumb = t;
  const c = chk(prefix + "-mkcontent"); if (c != null) b.makeContent = c;
  const l = chk(prefix + "-mklark"); if (l != null) b.postLark = l;
  const dir = $("#" + prefix + "-thumbdir");
  b.thumbPhotoDir = (dir && dir.value.trim()) || (VSS_CFG.brand && VSS_CFG.brand.thumbPhotoDir) || null;
  const nm = $("#" + prefix + "-thumbname");
  b.thumbName = (nm && nm.value.trim()) || (VSS_CFG.brand && VSS_CFG.brand.name) || "";
  return b;
}
// Nếu bật đăng Lark → hỏi xác nhận (xuất bản là hành động chủ động). Trả về true nếu được phép chạy.
function confirmLark(prefix) {
  const l = $("#" + prefix + "-mklark");
  if (l && l.checked && !confirm("Sau khi dựng xong, ĐĂNG video này lên Lark Base đã cấu hình?\n\nBấm Huỷ để chỉ dựng, đăng tay sau.")) {
    l.checked = false;
  }
  return true;
}
// Khối hiển thị caption + thumbnail + nút Đăng Lark cho MỘT video đầu ra.
function publishHtml(item) {
  if (!item || !item.outPath) return "";
  const cap = (item.caption || "").replace(/</g, "&lt;");
  const thumbUrl = item.thumbPath ? "/api/file?path=" + encodeURIComponent(item.thumbPath) : null;
  const larkState = item.larkPosted ? "✅ Đã đăng Lark" : (item.larkError ? "⚠ " + esc(item.larkError) : "");
  return `<div class="pub-box">
    ${item.title ? `<div class="pub-title">📌 <b>${esc(item.title)}</b></div>` : ""}
    ${cap ? `<details class="clip-cap" open><summary>✍️ Caption đăng bài (AI)</summary><pre>${cap}</pre></details>` : ""}
    ${thumbUrl ? `<details class="clip-cap"><summary>🖼️ Thumbnail thương hiệu</summary><img src="${thumbUrl}" style="width:100%;max-width:300px;border-radius:8px;margin-top:6px"><br><a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(item.thumbPath)}" download>⬇ Tải bìa</a></details>` : ""}
    <div style="margin-top:6px">
      <button class="dl pub-larkbtn" data-video="${encodeURIComponent(item.outPath)}" data-thumb="${item.thumbPath ? encodeURIComponent(item.thumbPath) : ""}" data-caption="${encodeURIComponent(item.caption || item.title || "")}">📤 Đăng Lark</button>
      <span class="pub-lark-status muted" style="font-size:11.5px;margin-left:6px">${larkState}</span>
    </div>
  </div>`;
}
// Bấm "Đăng Lark" (delegated — dùng cho MỌI tab). Đăng thủ công 1 video bất kỳ.
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".pub-larkbtn");
  if (!btn) return;
  const status = btn.parentElement.querySelector(".pub-lark-status");
  btn.disabled = true; if (status) status.textContent = "⏳ đang đăng...";
  try {
    const r = await fetch("/api/lark-post", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoPath: decodeURIComponent(btn.dataset.video),
        thumbPath: btn.dataset.thumb ? decodeURIComponent(btn.dataset.thumb) : null,
        caption: decodeURIComponent(btn.dataset.caption || ""),
      }),
    }).then((x) => x.json());
    if (r.error) throw new Error(r.error);
    pollJob(r.jobId, (j) => {
      btn.disabled = false;
      if (j.status === "error") { if (status) status.textContent = "⚠ " + j.error; return; }
      if (status) status.textContent = "✅ Đã đăng Lark";
    });
  } catch (err) { btn.disabled = false; if (status) status.textContent = "⚠ " + err.message; }
});
const esc = (s) => String(s == null ? "" : s).replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Dải câu (timeline) — mỗi câu là 1 khối, bấm để nhảy tới. Giúp "nhìn thấy" cấu trúc short.
function timelineHtml(c) {
  const dur = c.duration || (c.sourceEnd - c.sourceStart) || 1;
  const segs = c.segments || [];
  const blocks = segs.map((s) => {
    const left = Math.max(0, Math.min(100, (s.start / dur) * 100));
    const w = Math.max(1.2, Math.min(100 - left, ((s.end - s.start) / dur) * 100));
    return `<span class="tl-seg" data-t="${s.start.toFixed(2)}" style="left:${left.toFixed(2)}%;width:${w.toFixed(2)}%" title="${esc(s.text)}"></span>`;
  }).join("");
  // Đánh dấu CÂU CAO TRÀO trên timeline (điểm nhấn cảm xúc) — bấm để nhảy tới.
  let climax = "";
  if (c.climaxAtSec != null && c.climaxAtSec >= 0 && c.climaxAtSec <= dur) {
    const cl = Math.max(0, Math.min(100, (c.climaxAtSec / dur) * 100));
    climax = `<span class="tl-climax tl-seg" data-t="${c.climaxAtSec.toFixed(2)}" style="left:${cl.toFixed(2)}%" title="🔥 Câu cao trào: ${esc(c.climax || "")}">🔥</span>`;
  }
  return `<div class="tl" title="Bấm vào từng câu để nhảy tới">${blocks}${climax}<span class="tl-play" style="left:0%"></span></div>`;
}

// Panel ✏️ Tinh chỉnh cho 1 short: trim đầu/cuối · sửa phụ đề · bật/tắt hiệu ứng · dựng lại.
function tinhChinhHtml(c, i, ed) {
  const sel = (id, opts, cur) => `<select class="tc-${id}" data-idx="${i}">` +
    opts.map(([v, t]) => `<option value="${v}"${v === cur ? " selected" : ""}>${t}</option>`).join("") + `</select>`;
  const chk = (id, label, on) => `<label><input type="checkbox" class="tc-${id}" data-idx="${i}"${on ? " checked" : ""}> ${label}</label>`;
  const subText = (c.segments || []).map((s) => s.text).join("\n");
  return `
    <details class="tc" data-idx="${i}">
      <summary>✏️ Tinh chỉnh</summary>
      <div class="tc-body">
        ${timelineHtml(c)}
        <div class="tc-trim">
          <div class="tc-trimrow">
            <b>▶ Đầu:</b> <span class="tc-startlab">${mmss(c.sourceStart)}</span>
            <button class="tcbtn" data-idx="${i}" data-edge="start" data-d="-1">−1s</button>
            <button class="tcbtn" data-idx="${i}" data-edge="start" data-d="-0.3">−0.3</button>
            <button class="tcbtn" data-idx="${i}" data-edge="start" data-d="0.3">+0.3</button>
            <button class="tcbtn" data-idx="${i}" data-edge="start" data-d="1">+1s</button>
          </div>
          <div class="tc-trimrow">
            <b>⏹ Cuối:</b> <span class="tc-endlab">${mmss(c.sourceEnd)}</span>
            <button class="tcbtn" data-idx="${i}" data-edge="end" data-d="-1">−1s</button>
            <button class="tcbtn" data-idx="${i}" data-edge="end" data-d="-0.3">−0.3</button>
            <button class="tcbtn" data-idx="${i}" data-edge="end" data-d="0.3">+0.3</button>
            <button class="tcbtn" data-idx="${i}" data-edge="end" data-d="1">+1s</button>
            <span class="muted tc-durlab">· ${Math.round(c.duration || 0)}s</span>
          </div>
        </div>
        <label class="tc-sublabel">📝 Phụ đề (mỗi dòng = 1 câu; sửa chữ sai, để trống dòng để ẩn câu đó):</label>
        <textarea class="tc-sub" data-idx="${i}" rows="4" spellcheck="false">${esc(subText)}</textarea>
        <label><input type="checkbox" class="tc-subon" data-idx="${i}"> Áp phụ đề đã sửa (nếu không tick: giữ lời gốc)</label>
        <div class="tc-fx">
          <label>Khung: ${sel("reframe", KHUNG_OPTS, c.reframe || ed.reframe || "blur")}</label>
          <label>Màu: ${sel("color", [["off", "Tắt"], ["low", "Nhẹ"], ["medium", "Vừa"], ["high", "Đậm"]], ed.colorLevel || "off")}</label>
          <label>Phụ đề: ${sel("capstyle", [["karaoke", "Karaoke"], ["popline", "Pop cụm"]], ed.captionStyle || "karaoke")}</label>
          ${chk("caps", "Bật phụ đề", true)}
          ${chk("punch", "Punch-zoom", !!ed.punch)}
          ${chk("film", "Vignette", ed.film !== false)}
          ${chk("prog", "Thanh tiến trình", ed.progress !== false)}
          ${chk("hook", "Đắp hook chữ to", !!ed.burnHook)}
        </div>
        <div class="tc-fx">
          <label>⏩ Tốc độ: <b class="tc-spdlab" data-idx="${i}">${(+(ed.speed || 1)).toFixed(2)}</b>×
            <input type="range" class="tc-spd" data-idx="${i}" min="0.5" max="2" step="0.05" value="${+(ed.speed || 1)}" style="width:120px">
          </label>
        </div>
        <div class="tc-textrow">
          <label style="flex:1">✍️ Chữ tay:
            <input type="text" class="tc-ovl" data-idx="${i}" placeholder="VD: TÊN KÊNH CỦA BẠN (trống = không dùng)" style="width:100%">
          </label>
          <label>Vị trí:
            <select class="tc-ovlpos" data-idx="${i}"><option value="bottom">Dưới</option><option value="top">Trên</option><option value="middle">Giữa</option></select>
          </label>
        </div>
        <div class="tc-srctrim">
          <button class="tcbtn tc-srctoggle" data-idx="${i}">🎚️ Kéo cắt trên video gốc (kéo 2 tay nắm)</button>
          <div class="src-mount" data-idx="${i}" hidden></div>
        </div>
        <div class="tc-run">
          <button class="dl tc-apply" data-idx="${i}">🔁 Dựng lại short này</button>
          <span class="tc-status muted"></span>
        </div>
      </div>
    </details>`;
}

// 🖼️ ĐỔI KHUNG không dựng lại: dùng lớp video sạch cất lúc dựng → ghép khung mới trong 1 lượt.
// Video dựng TRƯỚC khi có tính năng (chưa có lớp sạch) → tự chuyển sang "Dựng lại" 1 lần.
// Danh sách khung: mặc định ở đây, khung.js thay bằng danh sách đọc từ assets/frames khi mở app.
let KHUNG_OPTS = [["frame:hprkd", "HPRKD"], ["frame:mentor-business", "Mentor Business"], ["blur", "Nền mờ"], ["fill", "Cắt đầy"]];
function wireDoiKhung() {
  $$(".kh-btn").forEach((btn) => btn.addEventListener("click", async () => {
    const i = +btn.dataset.idx;
    const card = $$(".clip-card")[i];
    const clip = _acClips[i];
    const reframe = card.querySelector(".kh-sel").value;
    const status = card.querySelector(".kh-status");
    btn.disabled = true; status.textContent = "⏳ Đang đổi khung…";
    try {
      const r = await fetch("/api/doi-khung", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: clip.outPath, reframe }) }).then((x) => x.json());
      if (r.noLayer) {
        // Video cũ: dựng lại 1 lần bằng Tinh chỉnh (từ lần này trở đi đổi khung sẽ tức thì).
        status.textContent = "Video dựng bản cũ → dựng lại 1 lần với khung mới…";
        const det = card.querySelector(".tc");
        const tsel = det && det.querySelector(".tc-reframe");
        if (!tsel) throw new Error(r.error);
        tsel.value = reframe;
        det.querySelector(".tc-apply").click();
        return;
      }
      if (r.error) throw new Error(r.error);
      await new Promise((resolve, reject) => pollJob(r.jobId, (j) => {
        if (j.status === "error") return reject(new Error(j.error));
        const out = j.result.outPath;
        clip.outPath = out; clip.reframe = reframe;
        const newUrl = "/api/file?path=" + encodeURIComponent(out) + "&t=" + Date.now();
        card.dataset.raw = newUrl; card.dataset.preview = "";
        const v = card.querySelector("video");
        v.src = newUrl + "#t=0.5"; v.load(); v.style.filter = colorFilterCss();
        const a = card.querySelector("a.dl.ghost"); if (a) a.href = "/api/file?dl=1&path=" + encodeURIComponent(out);
        const tsel = card.querySelector(".tc-reframe"); if (tsel) tsel.value = reframe;
        const note = card.querySelector(".prev-note"); if (note) note.style.display = "none";
        saveSession();
        resolve();
      }));
      status.textContent = "✅ Đã đổi khung";
    } catch (err) { status.textContent = "❌ " + err.message; }
    finally { btn.disabled = false; }
  }));
}

function renderClips(host, res) {
  const ok = (res.clips || []).filter((c) => !c.error);
  _acClips = ok;
  _acSource = res.source || null;
  _acTranscriptFile = res.transcriptFile || null;
  _acEditOpts = res.editOpts || {};
  _acSourceDuration = res.sourceDuration || 0;
  _acDurationSec = res.durationSec || 0;
  _acOutDir = res.outDir || "";
  const cards = ok.map((c, i) => {
    const url = "/api/file?path=" + encodeURIComponent(c.outPath);
    const cap = (c.caption || "").replace(/</g, "&lt;");
    const thumbUrl = c.thumbPath ? "/api/file?path=" + encodeURIComponent(c.thumbPath) : null;
    return `
      <div class="clip-card" data-idx="${i}" data-x="85" data-y="88" data-scale="0.16" data-cta="" data-preview="" data-raw="${url}" data-start="${c.sourceStart ?? ""}" data-end="${c.sourceEnd ?? ""}">
        <div class="clip-vwrap">
          <video src="${url}#t=0.5" controls preload="metadata"></video>
          <img class="logo-ov" alt="logo" style="display:none" draggable="false">
        </div>
        <div class="prev-note muted" style="display:none;font-size:11px;padding:4px 6px">🔊 Đang xem BẢN CÓ NHẠC (nghe thử trước khi tải)</div>
        <div class="logo-pad" style="display:none">
          <span class="lp-label">Logo:</span>
          <button class="lpbtn" data-act="left" title="Sang trái">◀</button>
          <button class="lpbtn" data-act="up" title="Lên">▲</button>
          <button class="lpbtn" data-act="down" title="Xuống">▼</button>
          <button class="lpbtn" data-act="right" title="Sang phải">▶</button>
          <button class="lpbtn" data-act="zoomout" title="Nhỏ lại">🔍−</button>
          <button class="lpbtn" data-act="zoomin" title="To lên">🔍+</button>
        </div>
        <div class="clip-body">
          <div class="clip-top">
            <span class="clip-no">#${i + 1}</span>
            <span class="clip-score" title="Điểm NỘI DUNG — AI chấm triết lý + viral + cảm xúc">📝 ${c.score}</span>
            ${c.techScore != null ? `<span class="clip-score tech" title="Điểm KỸ THUẬT — 6 trục hook/nhịp/giữ chân/âm thanh/định dạng/phụ đề">🔧 ${c.techScore}</span>` : ""}
            <span class="clip-dur">${Math.round(c.duration||0)}s</span>
          </div>
          <div class="clip-title" title="${esc(c.title||"")}">${(c.title||"").replace(/</g,"&lt;")}</div>
          <div class="clip-dls">
            <button class="dl prevbtn" data-idx="${i}" title="Xem trước bản có nhạc">▶ Xem</button>
            <a class="dl ghost" href="/api/file?dl=1&path=${encodeURIComponent(c.outPath)}" download title="Tải bản gốc">⬇ Gốc</a>
            <button class="dl finbtn" data-idx="${i}" title="Tải kèm logo / nhạc / CTA">⬇ Kèm</button>
            <button class="dl larkbtn" data-idx="${i}" title="Đăng Lark">📤 Lark</button>
          </div>
          <div class="clip-khung">
            <select class="kh-sel" data-idx="${i}" title="Chọn khung mới">${KHUNG_OPTS.map(([v, t]) => `<option value="${v}"${v === (c.reframe || _acEditOpts.reframe || "blur") ? " selected" : ""}>${t}</option>`).join("")}</select>
            <button class="dl kh-btn" data-idx="${i}" title="Đổi khung ngay, không dựng lại video">🖼️ Đổi</button>
          </div>
          <div class="kh-status muted" data-idx="${i}"></div>
          <div class="lark-status muted" data-idx="${i}">${c.larkPosted ? "✅ Đã tự đăng Lark" : (c.larkError ? "⚠ Tự đăng Lark lỗi: " + esc(c.larkError) : "")}</div>
          <details class="clip-more"><summary>Chi tiết</summary><div class="clip-more-b">
          ${c.concept ? `<div class="clip-phi">🎯 <b>Trọng điểm:</b> ${esc(c.concept)}</div>` : ""}
          ${c.transformation ? `<div class="clip-phi">✨ <b>Chuyển hóa:</b> ${esc(c.transformation)}</div>` : ""}
          <div class="clip-hook">🎯 Hook: <b>${(c.hook||"").replace(/</g,"&lt;")}</b></div>
          ${c.philosophy ? `<div class="clip-phi">💡 ${c.philosophy.replace(/</g,"&lt;")}</div>` : ""}
          ${c.emotion ? `<div class="clip-emo">❤️ Cảm xúc: <b>${esc(c.emotion)}</b>${c.emotionScore ? ` · ${c.emotionScore}/100` : ""}</div>` : ""}
          ${c.climax ? `<div class="clip-climax">🔥 Câu cao trào: “${esc(c.climax)}”</div>` : ""}
          <details class="clip-cap"><summary>Caption đăng bài</summary><pre>${cap}</pre></details>
          <div class="muted" style="font-size:11px">Nguồn: ${c.start!=null? (Math.floor(c.start/60)+":"+String(Math.floor(c.start%60)).padStart(2,"0")) : "?"} · ${Math.round(c.duration||0)}s</div>
          ${thumbUrl ? `<details class="clip-cap"><summary>🖼️ Thumbnail (ảnh bìa)</summary><img src="${thumbUrl}" style="width:100%;border-radius:8px;margin-top:6px"><a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(c.thumbPath)}" download>⬇ Tải bìa</a></details>` : ""}
          <div class="clip-cta">
            <label class="link">🎬 Chọn CTA cho video này<input type="file" accept="video/*" hidden class="cta-input" data-idx="${i}"></label>
            <span class="cta-name muted">chưa có CTA</span>
          </div>
          </div></details>
          ${tinhChinhHtml(c, i, _acEditOpts)}
        </div>
      </div>`;
  }).join("");
  const failed = (res.clips || []).filter((c) => c.error);
  host.innerHTML = `
    <div class="scorecard">
      <h3>🧠 Đã cắt ${ok.length} short từ video ${Math.round(res.durationSec/60)} phút</h3>
      <div class="muted score-legend" style="font-size:11.5px;margin:-4px 0 8px">Mỗi short có 2 điểm: <b>📝 Điểm nội dung</b> (AI chấm triết lý + viral + cảm xúc) và <b>🔧 Điểm kỹ thuật</b> (6 trục hook/nhịp/giữ chân/âm thanh/định dạng/phụ đề).</div>
      <div class="fin-bar">
        <div class="fin-title">🎨 Biên tập trực tiếp — chỉnh là thấy ngay trên video, rồi <b>Tải kèm</b></div>
        <div class="fin-row">
          <b style="font-size:12px">🎨 Màu:</b>
          <label>Sáng/Tối <b id="fin-brival">0</b><input type="range" id="fin-bri" min="-100" max="100" value="0"></label>
          <label>Tương phản <b id="fin-conval">0</b><input type="range" id="fin-con" min="-100" max="100" value="0"></label>
          <label>Bão hoà <b id="fin-satval">0</b><input type="range" id="fin-sat" min="-100" max="100" value="0"></label>
          <button class="lpbtn" id="fin-colorreset" title="Đưa màu về 0">↺</button>
        </div>
        <div class="fin-row">
          <label class="link">🏷️ Chọn logo<input type="file" id="fin-logo" accept="image/*" hidden></label>
          <span id="fin-logoname" class="muted">chưa chọn</span>
          <label>Cỡ <b id="fin-szval">16</b>%<input type="range" id="fin-sz" min="5" max="60" value="16"></label>
          <label>Mờ <b id="fin-opval">90</b>%<input type="range" id="fin-op" min="20" max="100" value="90"></label>
        </div>
        <div class="fin-row">
          <label class="link">🎵 Chọn nhạc<input type="file" id="fin-music" accept="audio/*" hidden></label>
          <span id="fin-musicname" class="muted">chưa chọn</span>
          <label>🔊 Âm lượng nhạc <b id="fin-mvval">30</b>%<input type="range" id="fin-mv" min="0" max="100" value="30"></label>
          <span class="muted" style="font-size:11px">Kéo to/nhỏ tuỳ ý. Giọng luôn giữ nguyên; nhạc tự nhường khi có tiếng nói.</span>
        </div>
        <div class="muted" style="font-size:11px">Kéo logo trên video HOẶC dùng nút ◀▲▼▶ 🔍 ngay dưới video. Mỗi video chọn CTA riêng. "Tải kèm" nướng logo+nhạc+CTA đúng như anh thấy.</div>
      </div>
      <div class="muted" style="font-size:12px;margin:6px 0 10px">Thư mục xuất: ${res.outDir} · mỗi short kèm 1 file .txt</div>
      <div class="clip-grid">${cards || "<i>Không có short nào đạt yêu cầu.</i>"}</div>
      ${failed.length ? `<div class="muted" style="margin-top:10px">⚠ ${failed.length} đoạn lỗi khi dựng.</div>` : ""}
    </div>`;
  wireFinalize();
  wireTinhChinh();
  wireDoiKhung();
  saveSession();   // 💾 tự lưu phiên (danh sách short + nguồn) để mở app hôm sau chỉnh tiếp
}

// ---- 💾 AUTO-SAVE PHIÊN: lưu kết quả lần cắt gần nhất để KHÔNG mất khi tắt app ----
// File video/thumbnail/transcript đã nằm trên đĩa; localStorage chỉ giữ CHỈ MỤC nhẹ để dựng lại thẻ.
const SESSION_KEY = "vss-last-session";
function saveSession() {
  try {
    const clips = (_acClips || []).filter((c) => c && !c.error && c.outPath);
    if (!clips.length) return;
    const snap = {
      clips, source: _acSource, transcriptFile: _acTranscriptFile,
      editOpts: _acEditOpts, sourceDuration: _acSourceDuration,
      durationSec: _acDurationSec, outDir: _acOutDir, savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(snap)); }
    catch (e) {
      // Vượt dung lượng → lưu bản GỌN (bỏ segments nặng): vẫn mở lại + tải + đăng được,
      // riêng timeline-câu trong Tinh chỉnh sẽ mỏng hơn (transcriptFile trên đĩa vẫn còn).
      const slim = { ...snap, clips: clips.map((c) => { const { segments, ...rest } = c; return rest; }) };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(slim)); } catch (e2) { /* bỏ qua */ }
    }
  } catch (e) { /* bỏ qua */ }
}
function offerRestoreSession() {
  let snap; try { snap = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { snap = null; }
  const host = $("#ac-out");
  if (!snap || !(snap.clips || []).length || !host) return;
  const when = (snap.savedAt || "").slice(0, 16).replace("T", " ");
  const bar = document.createElement("div");
  bar.className = "restore-bar";
  bar.innerHTML = `<span>💾 Phiên gần nhất: <b>${snap.clips.length} short</b> (${when}). Mở lại để chỉnh / tải / đăng tiếp?</span>` +
    `<button id="btn-restore" style="cursor:pointer">▶ Mở lại phiên</button>` +
    `<button id="btn-restore-x" class="ghost" style="cursor:pointer">Bỏ</button>`;
  host.prepend(bar);
  $("#btn-restore").onclick = () => { renderClips(host, snap); };
  $("#btn-restore-x").onclick = () => { bar.remove(); };
}

// Nối 1 timeline (bấm câu → nhảy tới; con trỏ chạy theo video). Dùng property handler
// để không cộng dồn listener mỗi lần dựng lại.
function wireTimeline(card) {
  const v = card.querySelector("video");
  const tl = card.querySelector(".tl");
  if (!tl || !v) return;
  tl.querySelectorAll(".tl-seg").forEach((seg) => seg.addEventListener("click", () => {
    const t = parseFloat(seg.dataset.t);
    if (isFinite(t)) { v.currentTime = t; v.play().catch(() => {}); }
  }));
  const play = tl.querySelector(".tl-play");
  v.ontimeupdate = () => {
    if (!v.duration) return;
    play.style.left = Math.max(0, Math.min(100, (v.currentTime / v.duration) * 100)) + "%";
  };
}

// Cập nhật nhãn trim (đầu/cuối/thời lượng) từ dataset của thẻ.
function refreshTrimLabels(card) {
  const det = card.querySelector(".tc");
  if (!det) return;
  const s = +card.dataset.start, e = +card.dataset.end;
  det.querySelector(".tc-startlab").textContent = mmss(s);
  det.querySelector(".tc-endlab").textContent = mmss(e);
  det.querySelector(".tc-durlab").textContent = "· " + Math.round(e - s) + "s";
  const srctl = card.querySelector(".srctl");
  if (srctl) positionSrc(card);
}

// Đặt 2 tay nắm + vùng chọn trên thanh cắt video gốc theo dataset.start/end + cửa sổ.
function positionSrc(card) {
  const srctl = card.querySelector(".srctl");
  if (!srctl) return;
  const ws = +srctl.dataset.ws, we = +srctl.dataset.we, span = Math.max(0.1, we - ws);
  const s = +card.dataset.start, e = +card.dataset.end;
  const pIn = Math.max(0, Math.min(100, (s - ws) / span * 100));
  const pOut = Math.max(0, Math.min(100, (e - ws) / span * 100));
  srctl.querySelector(".h-in").style.left = pIn + "%";
  srctl.querySelector(".h-out").style.left = pOut + "%";
  const sel = srctl.querySelector(".src-sel");
  sel.style.left = pIn + "%"; sel.style.width = Math.max(0, pOut - pIn) + "%";
  const m = card.querySelector(".src-mount");
  m.querySelector(".src-inlab").textContent = "vào " + mmss(s);
  m.querySelector(".src-outlab").textContent = "ra " + mmss(e);
  m.querySelector(".src-durlab").textContent = Math.round(e - s) + "s";
}

// Dựng (lazy) trình cắt tay trên VIDEO GỐC cho 1 thẻ — kéo 2 tay nắm để đặt vào/ra.
function buildSourceTrim(card) {
  const mount = card.querySelector(".src-mount");
  if (mount.dataset.built) { mount.hidden = !mount.hidden; return; }
  if (!_acSource) { alert("Thiếu video gốc."); return; }
  mount.dataset.built = "1"; mount.hidden = false;
  const s = +card.dataset.start, e = +card.dataset.end;
  const dur = _acSourceDuration || (e + 15);
  const ws = Math.max(0, s - 12), we = Math.min(dur, e + 12);
  mount.innerHTML =
    `<video class="src-v" src="/api/file?path=${encodeURIComponent(_acSource)}" preload="metadata" muted playsinline></video>` +
    `<div class="srctl" data-ws="${ws}" data-we="${we}"><div class="src-sel"></div>` +
    `<div class="src-h h-in" title="Điểm VÀO — kéo"></div><div class="src-h h-out" title="Điểm RA — kéo"></div></div>` +
    `<div class="src-lab muted"><span class="src-inlab"></span> · <span class="src-outlab"></span> · <span class="src-durlab"></span> — kéo tay nắm, khung hình hiện ngay trên video</div>`;
  const srctl = mount.querySelector(".srctl");
  const vid = mount.querySelector(".src-v");
  positionSrc(card);
  const drag = (handle, edge) => {
    let on = false;
    const pos = (cx) => {
      const r = srctl.getBoundingClientRect();
      const t = ws + Math.max(0, Math.min(1, (cx - r.left) / r.width)) * (we - ws);
      let sVal = +card.dataset.start, eVal = +card.dataset.end;
      if (edge === "in") sVal = Math.max(ws, Math.min(eVal - 1, t));
      else eVal = Math.min(we, Math.max(sVal + 1, t));
      card.dataset.start = sVal.toFixed(2); card.dataset.end = eVal.toFixed(2);
      positionSrc(card); refreshTrimLabels(card);
      const seekT = edge === "in" ? sVal : eVal;
      if (isFinite(seekT) && vid.readyState >= 1) { try { vid.currentTime = seekT; } catch (e) {} }
    };
    handle.addEventListener("mousedown", (ev) => { ev.preventDefault(); on = true; pos(ev.clientX); });
    window.addEventListener("mousemove", (ev) => { if (on) pos(ev.clientX); });
    window.addEventListener("mouseup", () => { on = false; });
    handle.addEventListener("touchstart", (ev) => { on = true; pos(ev.touches[0].clientX); }, { passive: true });
    handle.addEventListener("touchmove", (ev) => { if (on) pos(ev.touches[0].clientX); }, { passive: true });
    handle.addEventListener("touchend", () => { on = false; });
  };
  drag(srctl.querySelector(".h-in"), "in");
  drag(srctl.querySelector(".h-out"), "out");
  vid.addEventListener("loadedmetadata", () => { try { vid.currentTime = +card.dataset.start; } catch (e) {} });
}
