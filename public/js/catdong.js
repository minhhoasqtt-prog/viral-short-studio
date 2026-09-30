// Viral Short Studio — Tab Cắt tự động + bảng duyệt đoạn dùng chung (trục thời gian).
// (Tách từ app.js; các tệp js/*.js dùng chung biến toàn cục, nạp đúng thứ tự trong index.html.)
// ================= 🧠 CẮT TỰ ĐỘNG =================
// 🧾 Nhận NHIỀU video một lượt: mỗi video 1 chip; bấm chạy → xếp hàng làm lần lượt.
let acPath = null;
let acFiles = [];   // [{path, name}]
function drawAcFiles() {
  const el = $("#ac-files"); if (!el) return;
  el.innerHTML = acFiles.length
    ? acFiles.map((f, i) => `<span class="fchip">🎞️ ${esc(f.name)} <button type="button" class="fchip-x" data-i="${i}" title="Bỏ video này">✕</button></span>`).join("")
      + (acFiles.length > 1 ? `<span class="muted" style="font-size:11.5px">${acFiles.length} video sẽ xếp hàng chạy lần lượt</span>` : "")
    : "";
}
if ($("#ac-files")) $("#ac-files").addEventListener("click", (e) => {
  const b = e.target.closest(".fchip-x"); if (!b) return;
  acFiles.splice(+b.dataset.i, 1);
  if (acFiles.length === 1) { acPath = acFiles[0].path; $("#path-ac").value = acPath; }
  else if (!acFiles.length) { acPath = null; $("#path-ac").value = ""; }
  drawAcFiles();
});
async function acAddFiles(files) {
  for (const f of files) {
    try { showLog("Tải lên: " + f.name); const pth = await uploadFile(f); acFiles.push({ path: pth, name: f.name }); }
    catch (e) { alert(e.message); }
  }
  if (acFiles.length === 1) { acPath = acFiles[0].path; $("#path-ac").value = acPath; }
  else if (acFiles.length > 1) { acPath = null; $("#path-ac").value = ""; }
  drawAcFiles();
  setLog([`✔ Đã thêm ${files.length} video${acFiles.length > 1 ? ` (tổng ${acFiles.length} — sẽ chạy lần lượt)` : ""}.`]);
}
(function () {
  const dz = $("#dz-ac"); if (!dz) return;
  $("#file-ac").addEventListener("change", (e) => { if (e.target.files.length) acAddFiles([...e.target.files]); });
  ["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) acAddFiles([...e.dataTransfer.files]); });
})();
$("#ac-score").addEventListener("input", (e) => { $("#ac-scoreval").textContent = e.target.value; });
$("#ac-mv").addEventListener("input", (e) => { $("#ac-mvval").textContent = e.target.value; });

// 👁️ XEM LẠI THIẾT LẬP trước khi cắt — liệt kê mọi đầu vào đang đặt.
function buildAcReview() {
  const val = (id) => { const e = $("#" + id); return e ? (e.value || "").trim() : ""; };
  const chk = (id) => { const e = $("#" + id); return e ? e.checked : false; };
  const sel = (id) => { const e = $("#" + id); return e && e.selectedOptions[0] ? e.selectedOptions[0].text : ""; };
  const esc2 = (s) => String(s).replace(/</g, "&lt;");
  const rows = [];
  const add = (k, v) => rows.push(`<tr><td>${k}</td><td>${v ? `<b>${esc2(v)}</b>` : `<span class="miss">— chưa đặt —</span>`}</td></tr>`);
  const video = val("path-ac") || acPath || val("url-ac");
  add("📹 Video nguồn", video);
  add("🎵 Nhạc nền (tự lặp)", val("ac-music") ? `${val("ac-music")} · ${val("ac-mv")}%` : "");
  add("🎬 Thư mục b-roll", val("ac-broll"));
  add("🎯 Video CTA", val("ac-cta"));
  add("🏷️ Logo (dán khi tải)", val("ac-logo"));
  add("🖼️ Thumbnail", chk("ac-thumbbrand") ? `Mẫu thương hiệu · ${val("ac-thumbdir")} · tên "${val("ac-thumbname")}"` : "Kiểu khung video");
  add("📤 Tự đăng Lark", chk("ac-autolark") ? "BẬT · đưa về Lark Base đã cấu hình" : "Tắt (đăng tay)");
  add("🧠 AI chọn đoạn", `${sel("ac-model")} · điểm tối thiểu ${val("ac-score")} · tối đa ${val("ac-max")} short`);
  add("🎞️ Khung / chuyển cảnh", `${sel("ac-reframe")} · ${sel("ac-trans")}`);
  add("✨ Mịn / giọng / vignette", `mịn ${sel("ac-smooth")} · giọng ${sel("ac-voice")} · vignette ${chk("ac-film") ? "bật" : "tắt"} · progress ${chk("ac-prog") ? "bật" : "tắt"} · hook ${chk("ac-hook") ? "bật" : "tắt"}`);
  const warn = !video ? `<div class="hero-note" style="margin-top:8px">⚠ Chưa có <b>video nguồn</b> ở ô ① — hãy thêm trước khi cắt.</div>` : "";
  $("#ac-review").innerHTML = `<div class="review"><h4>👁️ Xem lại thiết lập trước khi cắt</h4><table>${rows.join("")}</table>${warn}<div class="muted" style="font-size:11.5px;margin-top:8px">Kiểm tra xong, bấm <b>🚀 AI cắt video thành loạt short</b>.</div></div>`;
  $("#ac-review").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("#btn-ac-review").addEventListener("click", buildAcReview);
// Link logo / CTA đầu vào → upload → điền path
$("#file-aclogo").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  showLog("Tải logo…");
  try { $("#ac-logo").value = await uploadFile(f); setLog(["✔ Logo: " + f.name]); } catch (err) { alert(err.message); }
});
$("#file-accta").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  showLog("Tải CTA…");
  try { $("#ac-cta").value = await uploadFile(f); setLog(["✔ CTA: " + f.name]); } catch (err) { alert(err.message); }
});
// Chế độ đang chọn: "clip" (cắt short) | "whole" (giữ trọn, chỉ dọn).
function acMode() { const r = document.querySelector('input[name="ac-mode"]:checked'); return r ? r.value : "clip"; }

// Dựng body dùng CHUNG cho cả 3 luồng (1 phát / duyệt / render).
function acBaseBody() {
  const file = $("#path-ac").value.trim() || acPath;
  const url = $("#url-ac").value.trim();
  const lenMin = parseInt($("#ac-lenmin").value, 10) || 0;
  const lenMax = parseInt($("#ac-lenmax").value, 10) || 0;
  return {
    path: file || null, url: url || null,
    model: $("#ac-model").value,
    note: ($("#ac-note") ? $("#ac-note").value.trim() : "") || null,
    minScore: parseInt($("#ac-score").value, 10),
    maxClips: parseInt($("#ac-max").value, 10) || 0,   // 0 = tự động, không giới hạn
    burnHook: $("#ac-hook").checked,
    reframe: $("#ac-reframe").value,
    colorLevel: "off",           // màu chỉnh TRỰC TIẾP ở phần kết quả (không nướng cứng khi render)
    punch: false, shake: false, flash: false, sfx: false, aiBroll: false,
    stickers: $("#ac-stickers") ? $("#ac-stickers").checked : false,
    aiCorrectText: $("#ac-aitext") ? $("#ac-aitext").checked : false,
    speed: parseFloat($("#ac-speed") ? $("#ac-speed").value : "1") || 1,
    film: $("#ac-film").checked,
    progress: $("#ac-prog").checked,
    brollFolder: $("#ac-broll").value.trim() || null,
    brollFill: $("#ac-brollfill").value,
    smooth: $("#ac-smooth").value,
    voiceClean: $("#ac-voice").value,
    makeThumb: $("#ac-thumb").checked,
    scoreClips: $("#ac-scoreclip") ? $("#ac-scoreclip").checked : true,
    musicPath: $("#ac-music").value.trim() || null,
    musicVol: (parseInt($("#ac-mv").value, 10) || 18) / 100,
    thumbStyle: $("#ac-thumbbrand").checked ? "brand" : "frame",
    thumbPhotoDir: $("#ac-thumbdir").value.trim() || null,
    thumbName: $("#ac-thumbname").value.trim() || VSS_CFG.brand.name || "",
    autoPostLark: $("#ac-autolark").checked,
    ctaPath: $("#ac-cta").value.trim() || null,
    // 🆕 điều khiển độ dài & "đủ ý"
    clipMinSec: lenMin, clipMaxSec: lenMax, preferComplete: $("#ac-prefer").checked,
  };
}

// Nhớ logo/CTA/chuyển cảnh vào finState (dùng khi biên tập trực tiếp phần kết quả).
function acStashFinState() {
  finState.logoPath = $("#ac-logo").value.trim() || null;
  finState.logoUrl = finState.logoPath ? "/api/file?path=" + encodeURIComponent(finState.logoPath) : null;
  finState.cta = $("#ac-cta").value.trim() || null;
  finState.transition = $("#ac-trans").value;
  finState.color = { brightness: 0, contrast: 0, saturation: 0 };
}

// Thân body cho chế độ GIỮ TRỌN (dọn gọn cả video) — tách hàm để chạy được cho từng video trong hàng đợi.
function acWholeBody(body, filePath) {
  return {
    path: filePath, model: body.model, note: body.note,
    doCutSilence: true, removeFillers: true, doCaptions: true, captionStyle: "karaoke",
    reframe: body.reframe, colorLevel: "clean", smooth: body.smooth, voiceClean: body.voiceClean,
    sharpen: 35, punch: false, shake: false, film: false, flash: false, progress: body.progress,
    aiCorrectText: body.aiCorrectText, speed: body.speed,
    musicPath: body.musicPath, musicVol: body.musicVol, logoPath: null, ctaPath: null,
  };
}
// Danh sách nguồn cần chạy: nhiều chip → mỗi chip 1 job xếp hàng; không thì ô đường dẫn/link như cũ.
function acSources(body) {
  const lbl = (s) => String(s || "").split(/[\\/]/).pop() || "video";
  if (acFiles.length > 1) return acFiles.map((f) => ({ path: f.path, url: null, label: f.name }));
  if (body.path || body.url) return [{ path: body.path, url: body.url, label: lbl(body.path || body.url) }];
  return [];
}

// ĐIỀU PHỐI: bấm nút chạy → rẽ theo mục đích + có duyệt trước hay không.
// NHIỀU video → bảng hàng đợi, server chạy lần lượt; MỘT video → hành vi như cũ.
$("#btn-ac").addEventListener("click", async () => {
  const body = acBaseBody();
  const sources = acSources(body);
  if (!sources.length) return alert("Kéo-thả video (một hoặc NHIỀU file), dán đường dẫn, hoặc dán link ở ô ①.");
  acStashFinState();
  saveProject("vss-ac", AC_FIELDS);
  const many = sources.length > 1;
  const board = many ? makeQueueBoard($("#ac-out"), `Hàng đợi ${sources.length} video`) : null;
  const btn = $("#btn-ac"); btn.disabled = true;
  let doneCnt = 0;
  const doneOne = () => { doneCnt++; if (doneCnt >= sources.length) btn.disabled = false; };
  const post = (url, b) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

  // 🎬 GIỮ TRỌN, CHỈ DỌN — cho video feedback/testimonial/bài giảng.
  if (acMode() === "whole") {
    for (const s of sources) {
      if (s.url) { alert("Chế độ Giữ trọn nhận FILE/đường dẫn (ô ①), chưa hỗ trợ link. Hãy tải video về rồi kéo-thả."); doneOne(); continue; }
      const row = board ? board.addRow(s.label) : null;
      const host = row ? row.mount : $("#ac-out");
      if (!row) host.innerHTML = '<div class="muted">🎬 Đang dọn gọn cả video (cắt lặng chết + phụ đề + màu nhẹ)…</div>';
      const r = await post("/api/edit", acWholeBody(body, s.path));
      if (r.error) { alert(r.error); doneOne(); continue; }
      pollJob(r.jobId, (j) => {
        doneOne();
        if (j.status === "error") { if (row) row.status("❌ " + j.error); return alert(j.error); }
        if (row) row.status("✅ xong");
        renderWholeResult(host, j.result, s.path);
      }, row ? (j) => row.status(queueStatusText(j, "🎬 đang dọn gọn cả video…")) : null);
    }
    return;
  }

  // ✂️ CẮT SHORT — có DUYỆT TRƯỚC không?
  if ($("#ac-review-first").checked) {
    for (const s of sources) {
      const row = board ? board.addRow(s.label) : null;
      const host = row ? row.mount : $("#ac-out");
      if (!row) host.innerHTML = '<div class="muted">🧠 AI đang đọc toàn bài & chọn các đoạn đắt giá để anh DUYỆT… (chưa render, chưa tốn công dựng)</div>';
      const r = await post("/api/autoclip/plan", { ...body, path: s.path || null, url: s.url || null });
      if (r.error) { alert(r.error); doneOne(); continue; }
      pollJob(r.jobId, (j) => {
        doneOne();
        if (j.status === "error") { if (row) row.status("❌ " + j.error); return alert(j.error); }
        if (row) row.status("👁️ chờ anh duyệt");
        renderApprovePanel(host, j.result, row);
      }, row ? (j) => row.status(queueStatusText(j, "🧠 AI đang chọn đoạn…")) : null);
    }
    return;
  }

  // ✂️ CẮT SHORT 1 PHÁT (không duyệt) — hành vi cũ.
  if ($("#ac-autolark").checked &&
      !confirm("Sau khi cắt xong, TỰ ĐỘNG đăng TẤT CẢ short lên Lark Base đã cấu hình?\n\nBấm Huỷ để chỉ cắt, đăng tay từng cái sau.")) {
    $("#ac-autolark").checked = false; body.autoPostLark = false;
  }
  if (!many) $("#ac-out").innerHTML = "";
  for (const s of sources) {
    const row = board ? board.addRow(s.label) : null;
    const host = row ? row.mount : $("#ac-out");
    const r = await post("/api/autoclip", { ...body, path: s.path || null, url: s.url || null });
    if (r.error) { alert(r.error); doneOne(); continue; }
    pollJob(r.jobId, (j) => {
      doneOne();
      if (j.status === "error") { if (row) row.status("❌ " + j.error); return alert(j.error); }
      if (row) row.status("✅ xong");
      renderClips(host, j.result);
    }, row ? (j) => row.status(queueStatusText(j, "✂️ đang cắt & dựng short…")) : null);
  }
});

// ---- 🎬 Chế độ GIỮ TRỌN: hiện 1 video kết quả gọn (video + tải + đăng Lark) ----
function renderWholeResult(host, r, srcPath) {
  const out = r && r.outPath;
  if (!out) { host.innerHTML = '<div class="ac-warn">Không dựng được video. Xem log để rõ.</div>'; return; }
  const url = "/api/file?path=" + encodeURIComponent(out);
  host.innerHTML = `<div class="scorecard">
    <h3>🎬 Đã dọn gọn cả video (giữ trọn nội dung)</h3>
    <div class="muted" style="font-size:12px;margin-bottom:8px">Nguồn: ${esc(srcPath || "")} · độ dài ${Math.round((r.meta && r.meta.duration) || 0)}s</div>
    <div class="clip-card" style="max-width:420px">
      <div class="clip-vwrap"><video src="${url}" controls preload="metadata"></video></div>
      <div class="clip-body">
        <div class="clip-dls">
          <a class="dl ghost" href="/api/file?dl=1&path=${encodeURIComponent(out)}" download>⬇ Tải video</a><div class="kh-mount" data-path="${esc(out)}"></div>
          <button class="dl pub-larkbtn" data-video="${encodeURIComponent(out)}" data-thumb="" data-caption="">📤 Đăng Lark</button>
          <span class="pub-lark-status muted" style="font-size:11.5px;margin-left:6px"></span>
        </div>
      </div>
    </div>
  </div>`;
}

// ---- 👁️ BẢNG DUYỆT ĐOẠN DÙNG CHUNG (mọi tính năng làm video) — pha 1 duyệt → pha 2 render ----
// Instance-based: mỗi bảng tự quản state riêng → nhiều video xếp hàng, mỗi video một bảng duyệt,
// thao tác không giẫm nhau. Trục thời gian kiểu CapCut: dải khung hình + sóng âm + block kéo mép.
function makeReviewPanel(host, res, cfg = {}) {
  const P = {
    clips: (res.clips || []).map((c) => ({ ...c, keep: true })),
    source: res.source || null,
    transcriptFile: res.transcriptFile || null,
    editOpts: res.editOpts || {},
    keep: res.keep || null,                                  // keep VI MÔ từ plan (edit/long/voice)
    dur: res.durationSec || res.sourceDuration || 0,
    playIdx: -1, stopAt: null, meta: null, pps: 0, minPps: 0, drag: null,
  };
  if (!P.clips.length) {
    host.innerHTML = `<div class="ac-warn">${cfg.emptyMsg || "Không tìm được đoạn nào để duyệt."}</div>`;
    return null;
  }
  const media = cfg.audioOnly ? "giọng đọc" : "video";
  const note = cfg.note || `Video gốc ${Math.round(P.dur / 60)} phút. Bấm <b>▶ Xem thử</b> để XEM đoạn thật — thấy CỤT thì kéo dài đầu/cuối (chỉnh xong tự phát lại chỗ vừa sửa); không ưng thì bỏ chọn.`;
  host.innerHTML = `<div class="approve-wrap">
    <div class="approve-head">
      <h3>👁️ ${esc(cfg.title || `Duyệt ${P.clips.length} đoạn trước khi render`)}</h3>
      <span class="muted" style="font-size:12px">${note}</span>
    </div>
    ${P.source ? `<div class="apv-player">
      <video class="apv-video" src="/api/file?path=${encodeURIComponent(P.source)}" preload="metadata" controls${cfg.audioOnly ? ' style="max-height:64px;min-height:54px"' : ""}></video>
      <div class="apv-pnote muted">Bấm ▶ Xem thử ở từng đoạn — ${media} nhảy đúng đoạn đó, hết đoạn tự dừng.</div>
    </div>` : ""}
    <div class="apv-timeline"></div>
    <div class="apv-warn"></div>
    <div class="apv-list"></div>
    <div class="row" style="margin-top:12px">
      <button class="dl apv-all">✓ Chọn tất cả</button>
      <button class="dl apv-none">✗ Bỏ tất cả</button>
      <button class="go big apv-render">${esc(cfg.renderLabel || "🚀 Render các đoạn đã duyệt →")}</button>
    </div>
  </div>`;
  const q = (s) => host.querySelector(s);
  const video = q(".apv-video");
  if (video) video.addEventListener("error", () => {
    const n = q(".apv-pnote");
    if (n) n.innerHTML = "⚠ Trình duyệt không phát được định dạng nguồn này — anh vẫn duyệt bằng chữ như cũ.";
  });

  // ▶ Xem thử: nhảy tới đoạn, hết đoạn tự dừng.
  function preview(i, from, to, label) {
    if (!video) return;
    P.playIdx = i; P.stopAt = to;
    const n = q(".apv-pnote");
    if (n) n.innerHTML = `▶ ${esc(label || ("Đoạn " + (i + 1)))} · ${mmss(from)}–${mmss(to)}`;
    host.querySelectorAll(".apv.playing").forEach((el) => el.classList.remove("playing"));
    const card = host.querySelector(`.apv[data-i="${i}"]`); if (card) card.classList.add("playing");
    const go = () => { video.currentTime = from; video.play().catch(() => {}); };
    if (video.readyState >= 1) go();
    else video.addEventListener("loadedmetadata", go, { once: true });
  }
  if (video) video.addEventListener("timeupdate", () => {
    if (P.stopAt != null && video.currentTime >= P.stopAt) { video.pause(); P.stopAt = null; }
    const ph = q(".tl-playhead");
    if (ph && P.meta) ph.style.left = (video.currentTime * P.pps) + "px";
  });

  // ---- 🎬 Trục thời gian kiểu CapCut: sprite khung hình + waveform từ /api/filmstrip (server cache) ----
  async function tlInit() {
    const tl = q(".apv-timeline");
    if (!tl || !P.source || !P.dur) return;
    tl.innerHTML = `<div class="tl-loading muted">🎞️ Đang tạo dải khung hình cho trục thời gian (lần đầu hơi lâu — sẽ được nhớ cho lần sau)…</div>`;
    let meta = null;
    try { meta = await fetch("/api/filmstrip?path=" + encodeURIComponent(P.source)).then((r) => r.json()); } catch { meta = null; }
    if (!meta || meta.error || (!meta.strip && !meta.wave)) { tl.innerHTML = ""; return; }
    if (!document.body.contains(tl)) return;   // panel đã bị thay trong lúc chờ
    P.meta = meta;
    tl.innerHTML = `
      <div class="tl-bar">
        <b>🎬 Trục thời gian</b>
        <span class="tl-hint muted">bấm block = xem thử · kéo <b>mép trái/phải</b> block = nới/thu (retime) · ✓/✗ = giữ/bỏ · bấm nền = tua · lăn chuột = zoom</span>
        <span class="tl-zoomctl"><button class="tcbtn tl-zo" title="Thu nhỏ">−</button><span class="tl-zl">100%</span><button class="tcbtn tl-zi" title="Phóng to">+</button></span>
      </div>
      <div class="tl-legend muted">${cfg.legend || 'khung hình SÁNG + khối xanh đánh số = <b>ĐƯỢC GIỮ</b> · vùng phủ đỏ mờ = <b>BỊ CẮT BỎ</b>'}</div>
      <div class="tl-scroll"><div class="tl-canvas">
        <div class="tl-ruler"></div>
        <div class="tl-strip"${meta.strip ? "" : ' style="display:none"'}></div>
        <div class="tl-wave"${meta.wave ? (meta.strip ? "" : ' style="top:18px;height:92px"') : ' style="display:none"'}></div>
        <div class="tl-cuts"></div>
        <div class="tl-blocks"></div>
        <div class="tl-playhead"></div>
        <div class="tl-tip"></div>
      </div></div>`;
    const sc = q(".tl-scroll");
    P.minPps = Math.max(0.2, (sc.clientWidth - 6) / P.dur);
    P.pps = P.minPps;
    drawTimeline();
    q(".tl-zi").addEventListener("click", () => tlZoom(1.5));
    q(".tl-zo").addEventListener("click", () => tlZoom(1 / 1.5));
    sc.addEventListener("wheel", (e) => { e.preventDefault(); tlZoom(e.deltaY < 0 ? 1.25 : 0.8, e); }, { passive: false });
    // Bấm nền trục (không trúng block) = tua tới đúng chỗ đó.
    q(".tl-canvas").addEventListener("click", (e) => {
      if (e.target.closest(".tl-block")) return;
      if (!video) return;
      const rect = q(".tl-canvas").getBoundingClientRect();
      P.stopAt = null;
      video.currentTime = Math.max(0, Math.min(P.dur, (e.clientX - rect.left) / P.pps));
      video.play().catch(() => {});
    });
    // Kéo mép block (retime) — pointer events, delegated trên container (sống sót qua re-render).
    q(".tl-blocks").addEventListener("pointerdown", (e) => {
      const h = e.target.closest(".tl-bh"); if (!h) return;
      e.preventDefault(); e.stopPropagation();
      const i = +h.dataset.i, c = P.clips[i]; if (!c) return;
      P.drag = { i, edge: h.dataset.edge, x0: e.clientX, s0: c.sourceStart, e0: c.sourceEnd, moved: false };
      document.addEventListener("pointermove", dragMove);
      document.addEventListener("pointerup", dragUp, { once: true });
    });
    // Bấm block = xem thử · nút ✓/✗ trên block = giữ/bỏ.
    q(".tl-blocks").addEventListener("click", (e) => {
      const kb = e.target.closest(".tl-keep");
      if (kb) { const c = P.clips[+kb.dataset.i]; if (c) { c.keep = !c.keep; drawList(); } return; }
      const blk = e.target.closest(".tl-block");
      if (blk && !e.target.closest(".tl-bh")) {
        const i = +blk.dataset.i, c = P.clips[i];
        if (c) preview(i, c.sourceStart, c.sourceEnd, c.title);
      }
    });
  }
  function dragMove(e) {
    const d = P.drag; if (!d) return;
    const c = P.clips[d.i]; if (!c) return;
    const dt = (e.clientX - d.x0) / P.pps;
    if (Math.abs(e.clientX - d.x0) > 2) d.moved = true;
    const r1 = (x) => Math.round(x * 10) / 10;
    if (d.edge === "start") c.sourceStart = r1(Math.max(0, Math.min(d.e0 - 1, d.s0 + dt)));
    else c.sourceEnd = r1(Math.max(d.s0 + 1, Math.min(P.dur, d.e0 + dt)));
    drawTimeline();
    const tip = q(".tl-tip");
    if (tip) {
      const t = d.edge === "start" ? c.sourceStart : c.sourceEnd;
      tip.style.display = "block";
      tip.style.left = (t * P.pps) + "px";
      tip.textContent = `${d.edge === "start" ? "▶ Đầu" : "⏹ Cuối"} ${mmss(t)} · ${Math.round(c.sourceEnd - c.sourceStart)}s`;
    }
  }
  function dragUp() {
    document.removeEventListener("pointermove", dragMove);
    const d = P.drag; P.drag = null;
    const tip = q(".tl-tip"); if (tip) tip.style.display = "none";
    if (!d) return;
    const c = P.clips[d.i]; if (!c) return;
    drawList();
    // Thả tay xong PHÁT NGAY quanh mép vừa chỉnh — nghe câu có trọn không, khỏi đoán mò.
    if (d.moved && P.source) {
      if (d.edge === "start") preview(d.i, c.sourceStart, Math.min(c.sourceEnd, c.sourceStart + 4), "Nghe lại ĐẦU đoạn " + (d.i + 1));
      else preview(d.i, Math.max(c.sourceStart, c.sourceEnd - 4), c.sourceEnd, "Nghe lại CUỐI đoạn " + (d.i + 1));
    }
  }
  function tlZoom(f, e) {
    const sc = q(".tl-scroll"); if (!sc || !P.meta) return;
    const old = P.pps;
    P.pps = Math.min(40, Math.max(P.minPps, P.pps * f));
    if (P.pps === old) return;
    const rect = sc.getBoundingClientRect();
    const mx = e ? (e.clientX - rect.left) : rect.width / 2;
    const t = (sc.scrollLeft + mx) / old;   // giây đang nằm dưới chuột
    drawTimeline();
    sc.scrollLeft = Math.max(0, t * P.pps - mx);   // giữ điểm đó đứng yên khi zoom
    const zl = q(".tl-zl"); if (zl) zl.textContent = Math.round((P.pps / P.minPps) * 100) + "%";
  }
  function tlStep() {
    for (const s of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) if (s * P.pps >= 74) return s;
    return 1200;
  }
  function drawTimeline() {
    if (!P.meta) return;
    const cv = q(".tl-canvas"); if (!cv) return;
    const W = Math.max(10, Math.round(P.dur * P.pps));
    cv.style.width = W + "px";
    if (P.meta.strip) {
      const strip = q(".tl-strip");
      strip.style.backgroundImage = `url("${P.meta.strip}")`;
      strip.style.backgroundSize = `${W}px 100%`;
    }
    if (P.meta.wave) {
      const wv = q(".tl-wave");
      wv.style.backgroundImage = `url("${P.meta.wave}")`;
      wv.style.backgroundSize = `${W}px 100%`;
    }
    // Thước thời gian
    const step = tlStep();
    let ticks = "";
    for (let t = 0; t <= P.dur; t += step) ticks += `<span class="tl-tick" style="left:${Math.round(t * P.pps)}px">${mmss(t)}</span>`;
    q(".tl-ruler").innerHTML = ticks;
    // Vùng BỊ CẮT = phần bù của các đoạn đang giữ (phủ đỏ mờ như CapCut đánh dấu bỏ)
    const kept = P.clips.filter((c) => c.keep)
      .map((c) => [c.sourceStart, c.sourceEnd]).sort((a, b) => a[0] - b[0]);
    let cur = 0, cuts = "";
    const cutDiv = (s, e) => (e - s) < 0.05 ? "" :
      `<div class="tl-cut" style="left:${Math.round(s * P.pps)}px;width:${Math.max(2, Math.round((e - s) * P.pps))}px"></div>`;
    for (const [s, e] of kept) { if (s > cur) cuts += cutDiv(cur, s); cur = Math.max(cur, e); }
    if (cur < P.dur) cuts += cutDiv(cur, P.dur);
    q(".tl-cuts").innerHTML = cuts;
    // Block từng đoạn (đánh số khớp danh sách bên dưới)
    q(".tl-blocks").innerHTML = P.clips.map((c, i) => {
      const l = Math.round(c.sourceStart * P.pps);
      const w = Math.max(16, Math.round((c.sourceEnd - c.sourceStart) * P.pps));
      return `<div class="tl-block${c.keep ? "" : " drop"}${i === P.playIdx ? " playing" : ""}" data-i="${i}"
        style="left:${l}px;width:${w}px" title="${esc(c.title || ("Đoạn " + (i + 1)))} · ${mmss(c.sourceStart)}–${mmss(c.sourceEnd)}">
        <span class="tl-bh l" data-i="${i}" data-edge="start" title="Kéo để nới/thu ĐẦU đoạn"></span>
        <span class="tl-num">${i + 1}</span><span class="tl-len">${Math.round(c.sourceEnd - c.sourceStart)}s</span>
        <button class="tl-keep" data-i="${i}" title="${c.keep ? "Đang GIỮ — bấm để bỏ" : "Đang BỎ — bấm để giữ lại"}">${c.keep ? "✓" : "✗"}</button>
        <span class="tl-bh r" data-i="${i}" data-edge="end" title="Kéo để nới/thu CUỐI đoạn"></span>
      </div>`;
    }).join("");
  }

  // ---- Danh sách thẻ đoạn (đồng bộ 2 chiều với trục: sửa ở đâu cũng vẽ lại cả hai) ----
  function drawList() {
    const list = q(".apv-list"); if (!list) return;
    list.innerHTML = P.clips.map((c, i) => {
      const len = Math.round(c.sourceEnd - c.sourceStart);
      const warn = len < 18 ? " warn" : "";
      return `<div class="apv${c.keep ? "" : " drop"}${i === P.playIdx ? " playing" : ""}" data-i="${i}">
        <div class="apv-top">
          <label><input type="checkbox" class="apv-keep" data-i="${i}"${c.keep ? " checked" : ""}> <b>${esc(c.title || ("Đoạn " + (i + 1)))}</b></label>
          ${c.score != null ? `<span class="apv-badge">📝 ${c.score}</span>` : ""}
          ${c.emotion ? `<span class="apv-badge">❤️ ${esc(c.emotion)}</span>` : ""}
          <span class="apv-time">${mmss(c.sourceStart)}–${mmss(c.sourceEnd)} · <span class="apv-len${warn}">${len}s</span></span>
          ${P.source ? `<button class="tcbtn apv-play" data-i="${i}">▶ Xem thử</button>` : ""}
        </div>
        ${c.concept ? `<div class="clip-phi" style="font-size:12px">🎯 ${esc(c.concept)}</div>` : ""}
        <div class="apv-text">${esc(c.previewText || (c.segments || []).map((s) => s.text).join(" "))}</div>
        <div class="apv-trim">
          <b>▶ Đầu:</b>
          <button class="tcbtn apvbtn" data-i="${i}" data-edge="start" data-d="-3">−3s</button>
          <button class="tcbtn apvbtn" data-i="${i}" data-edge="start" data-d="-1">−1s</button>
          <button class="tcbtn apvbtn" data-i="${i}" data-edge="start" data-d="1">+1s</button>
          <b style="margin-left:8px">⏹ Cuối:</b>
          <button class="tcbtn apvbtn" data-i="${i}" data-edge="end" data-d="-1">−1s</button>
          <button class="tcbtn apvbtn" data-i="${i}" data-edge="end" data-d="1">+1s</button>
          <button class="tcbtn apvbtn" data-i="${i}" data-edge="end" data-d="3">+3s</button>
          <span class="muted" style="font-size:11px;margin-left:6px">Kéo dài để lấy trọn câu mở/kết.</span>
        </div>
      </div>`;
    }).join("");
    // tổng quan độ phủ
    const kept = P.clips.filter((c) => c.keep);
    const total = kept.reduce((s, c) => s + (c.sourceEnd - c.sourceStart), 0);
    const w = q(".apv-warn");
    if (w) w.innerHTML = `<div class="muted" style="font-size:12px;margin-bottom:6px">Đang giữ <b>${kept.length}/${P.clips.length}</b> đoạn · tổng <b>${Math.round(total)}s</b>${P.dur ? ` (${Math.round(total / P.dur * 100)}% ${cfg.audioOnly ? "giọng gốc" : "video gốc"})` : ""}.</div>`;
    drawTimeline();
  }
  // Trim đầu/cuối + tick giữ/bỏ + xem thử (delegated trên list container của CHÍNH panel này).
  q(".apv-list").addEventListener("click", (e) => {
    const p = e.target.closest(".apv-play");
    if (p) {
      const i = +p.dataset.i, c = P.clips[i]; if (!c) return;
      return preview(i, c.sourceStart, c.sourceEnd, c.title);
    }
    const b = e.target.closest(".apvbtn"); if (!b) return;
    const i = +b.dataset.i, d = +b.dataset.d, c = P.clips[i]; if (!c) return;
    if (b.dataset.edge === "start") c.sourceStart = Math.max(0, Math.min(c.sourceEnd - 1, c.sourceStart + d));
    else c.sourceEnd = Math.max(c.sourceStart + 1, Math.min(P.dur, c.sourceEnd + d));
    drawList();
    // Chỉnh xong PHÁT NGAY chỗ vừa sửa để nghe câu có trọn không (khỏi đoán mò).
    if (b.dataset.edge === "start") preview(i, c.sourceStart, Math.min(c.sourceEnd, c.sourceStart + 4), "Nghe lại ĐẦU đoạn " + (i + 1));
    else preview(i, Math.max(c.sourceStart, c.sourceEnd - 4), c.sourceEnd, "Nghe lại CUỐI đoạn " + (i + 1));
  });
  q(".apv-list").addEventListener("change", (e) => {
    const k = e.target.closest(".apv-keep"); if (!k) return;
    const c = P.clips[+k.dataset.i]; if (c) c.keep = k.checked;
    drawList();
  });
  q(".apv-all").addEventListener("click", () => { P.clips.forEach((c) => c.keep = true); drawList(); });
  q(".apv-none").addEventListener("click", () => { P.clips.forEach((c) => c.keep = false); drawList(); });
  q(".apv-render").addEventListener("click", async () => {
    const kept = P.clips.filter((c) => c.keep);
    if (!kept.length) return alert("Chưa chọn đoạn nào để render.");
    q(".apv-render").disabled = true;
    const ui = { host, status(txt) { host.innerHTML = `<div class="muted">${txt}</div>`; } };
    try { await cfg.onRender(kept, P, ui); }
    catch (e) { alert(e.message); const rb = q(".apv-render"); if (rb) rb.disabled = false; }
  });

  drawList();
  tlInit();
  return P;
}

// ---- Bảng duyệt cho ✂️ CẮT SHORT (autoclip) — pha 2 render qua /api/autoclip/render ----
function renderApprovePanel(host, res, row) {
  makeReviewPanel(host, res, {
    title: `Duyệt ${(res.clips || []).length} đoạn trước khi render`,
    emptyMsg: 'AI không tìm được đoạn nào đủ trọn ý. Thử hạ "Điểm tối thiểu", hoặc dùng chế độ <b>Giữ trọn cả video</b>.',
    onRender: async (kept, P, ui) => {
      if ($("#ac-autolark").checked &&
          !confirm("Render xong sẽ TỰ ĐỘNG đăng các đoạn lên Lark Base?\n\nBấm Huỷ để chỉ render, đăng tay sau.")) {
        $("#ac-autolark").checked = false;
      }
      const base = acBaseBody();
      const body = {
        ...base, path: null, url: null,
        source: P.source, transcriptFile: P.transcriptFile,
        autoPostLark: $("#ac-autolark").checked,
        clips: kept.map((c) => ({
          start: c.sourceStart, end: c.sourceEnd, title: c.title, hook: c.hook, caption: c.caption,
          concept: c.concept, transformation: c.transformation, philosophy: c.philosophy, reason: c.reason,
          emotion: c.emotion, emotionScore: c.emotionScore, climax: c.climax, climaxTime: c.climaxTime, score: c.score,
        })),
      };
      ui.status(`🎬 Đang render ${kept.length} đoạn đã duyệt…`);
      const r = await fetch("/api/autoclip/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
      if (r.error) { alert(r.error); return; }
      pollJob(r.jobId, (j) => {
        if (j.status === "error") { if (row) row.status("❌ " + j.error); return alert(j.error); }
        if (row) row.status("✅ xong");
        renderClips(host, j.result);
      }, row ? (j) => row.status(queueStatusText(j, "🎬 đang render các đoạn đã duyệt…")) : null);
    },
  });
}
// Bật/tắt nhóm tuỳ chọn short theo mục đích + nhãn nút chạy + cảnh báo.
function acSyncMode() {
  const whole = acMode() === "whole";
  const co = $("#ac-clipopts"); if (co) co.style.display = whole ? "none" : "";
  const btn = $("#btn-ac");
  if (btn) btn.textContent = whole ? "🚀 Dọn gọn cả video →" : ($("#ac-review-first").checked ? "🚀 AI chọn đoạn để DUYỆT →" : "🚀 AI cắt video thành loạt short →");
}
document.querySelectorAll('input[name="ac-mode"]').forEach((r) => r.addEventListener("change", acSyncMode));
if ($("#ac-review-first")) $("#ac-review-first").addEventListener("change", acSyncMode);
// Thanh độ dài min/max (giữ min < max) + nhãn.
function acSyncLen(from) {
  const mn = $("#ac-lenmin"), mx = $("#ac-lenmax"); if (!mn || !mx) return;
  let a = parseInt(mn.value, 10), b = parseInt(mx.value, 10);
  if (a >= b) { if (from === "min") b = a + 5; else a = b - 5; mn.value = a; mx.value = b; }
  $("#ac-lenmin-v").textContent = a; $("#ac-lenmax-v").textContent = b;
}
if ($("#ac-lenmin")) $("#ac-lenmin").addEventListener("input", () => acSyncLen("min"));
if ($("#ac-lenmax")) $("#ac-lenmax").addEventListener("input", () => acSyncLen("max"));
acSyncMode(); acSyncLen();

// Trạng thái biên tập trực tiếp (áp cho mọi short trong lần cắt này)
const finState = { logoPath: null, logoUrl: null, scale: 0.16, opacity: 0.9, musicPath: null, musicVol: 0.3, cta: null, transition: "fade", color: { brightness: 0, contrast: 0, saturation: 0 } };
let _acClips = [];
// Dữ liệu nguồn cho lớp ✏️ TINH CHỈNH (dựng lại 1 short mà không chạy lại AI)
let _acSource = null, _acTranscriptFile = null, _acEditOpts = {}, _acSourceDuration = 0;
let _acDurationSec = 0, _acOutDir = "";   // cho auto-save phiên (khôi phục lại header khi mở app)

// TẢI VỀ không chuyển trang: tạo <a download> bấm ngầm, trỏ endpoint có dl=1 (ép attachment).
// Nhờ vậy tải nhiều video liên tiếp mà app KHÔNG bị mất/điều hướng.
function downloadFile(filePath, saveName) {
  const a = document.createElement("a");
  a.href = "/api/file?dl=1&path=" + encodeURIComponent(filePath);
  if (saveName) a.download = saveName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1500);
}

const mmss = (s) => (s == null ? "?" : Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"));
