// Viral Short Studio — Tinh chỉnh 1 short: timeline, cắt đầu/cuối, logo/nhạc/CTA, dựng lại.
// (Tách từ app.js; các tệp js/*.js dùng chung biến toàn cục, nạp đúng thứ tự trong index.html.)
// ---- Lớp ✏️ TINH CHỈNH: timeline seek + trim + dựng lại 1 short ----
function wireTinhChinh() {
  $$(".clip-card").forEach(wireTimeline);

  // Trim đầu/cuối: nút ± đổi mốc nguồn (data-start/data-end), cập nhật nhãn + thời lượng.
  $$(".tcbtn").forEach((btn) => btn.addEventListener("click", () => {
    if (!btn.dataset.edge) return; // bỏ qua nút toggle "kéo cắt" (cũng là .tcbtn)
    const card = $$(".clip-card")[+btn.dataset.idx];
    const edge = btn.dataset.edge, d = parseFloat(btn.dataset.d);
    let s = parseFloat(card.dataset.start), e = parseFloat(card.dataset.end);
    if (!isFinite(s) || !isFinite(e)) return;
    if (edge === "start") s = Math.max(0, Math.min(e - 1, s + d));
    else e = Math.max(s + 1, e + d);
    card.dataset.start = s.toFixed(2); card.dataset.end = e.toFixed(2);
    refreshTrimLabels(card);
  }));

  // 🎚️ Kéo cắt trên video gốc (bật/tắt trình cắt tay lazy)
  $$(".tc-srctoggle").forEach((btn) => btn.addEventListener("click", () => {
    buildSourceTrim($$(".clip-card")[+btn.dataset.idx]);
  }));

  // ⏩ Nhãn tốc độ chạy theo slider
  $$(".tc-spd").forEach((sl) => sl.addEventListener("input", () => {
    sl.closest(".tc").querySelector(".tc-spdlab").textContent = (+sl.value).toFixed(2);
  }));

  // 🔁 Dựng lại short này
  $$(".tc-apply").forEach((btn) => btn.addEventListener("click", async () => {
    const i = +btn.dataset.idx;
    const card = $$(".clip-card")[i];
    const det = card.querySelector(".tc");
    const status = det.querySelector(".tc-status");
    const clip = _acClips[i];
    if (!_acSource) return alert("Thiếu video gốc để dựng lại (hãy cắt lại từ đầu).");
    const g = (cls) => det.querySelector(".tc-" + cls);
    const subOn = g("subon").checked;
    const body = {
      source: _acSource, transcriptFile: _acTranscriptFile,
      start: parseFloat(card.dataset.start), end: parseFloat(card.dataset.end),
      segments: subOn ? g("sub").value.split("\n").map((x) => x.trim()) : null,
      reframe: g("reframe").value,
      colorLevel: g("color").value,
      captionStyle: g("capstyle").value,
      doCaptions: g("caps").checked,
      punch: g("punch").checked,
      film: g("film").checked,
      progress: g("prog").checked,
      hookText: g("hook").checked ? (clip.hook || clip.title || null) : null,
      speed: parseFloat(g("spd").value) || 1,
      overlayText: g("ovl").value.trim() || null,
      overlayPos: g("ovlpos").value,
    };
    btn.disabled = true; const old = btn.textContent; btn.textContent = "⏳ Đang dựng lại…";
    status.textContent = "";
    try {
      const r = await fetch("/api/reclip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      await new Promise((resolve, reject) => pollJob(r.jobId, (j) => {
        if (j.status === "error") return reject(new Error(j.error));
        const out = j.result.outPath;
        // Cập nhật short: file mới thành "bản gốc" để lớp finalize (logo/nhạc) chồng lên.
        clip.outPath = out;
        clip.segments = j.result.segments || clip.segments;
        clip.duration = j.result.duration || clip.duration;
        card.dataset.start = String(j.result.sourceStart);
        card.dataset.end = String(j.result.sourceEnd);
        const newUrl = "/api/file?path=" + encodeURIComponent(out) + "&t=" + Date.now();
        card.dataset.raw = newUrl; card.dataset.preview = "";
        const v = card.querySelector("video");
        v.src = newUrl; v.load(); v.style.filter = colorFilterCss();
        const note = card.querySelector(".prev-note"); if (note) note.style.display = "none";
        // Vẽ lại timeline theo phụ đề/thời lượng mới
        const tlOld = det.querySelector(".tl");
        const tmp = document.createElement("div"); tmp.innerHTML = timelineHtml(clip);
        tlOld.replaceWith(tmp.firstElementChild);
        wireTimeline(card); // chỉ nối lại timeline của thẻ này (không double-bind)
        saveSession();      // 💾 lưu lại phiên sau khi dựng lại short (bám outPath mới)
        resolve();
      }));
      status.textContent = "✅ đã dựng lại";
    } catch (err) { status.textContent = "❌ " + err.message; alert(err.message); }
    finally { btn.disabled = false; btn.textContent = old; }
  }));
}

function applyLogoTo(card) {
  const ov = card.querySelector(".logo-ov");
  const wrap = card.querySelector(".clip-vwrap");
  const pad = card.querySelector(".logo-pad");
  if (!finState.logoUrl) { ov.style.display = "none"; if (pad) pad.style.display = "none"; return; }
  const scale = +(card.dataset.scale || finState.scale);
  ov.src = finState.logoUrl;
  ov.style.display = "block";
  if (pad) pad.style.display = "flex";
  ov.style.width = (scale * 100) + "%";
  ov.style.opacity = finState.opacity;
  const ww = wrap.clientWidth, wh = wrap.clientHeight, lw = ov.offsetWidth, lh = ov.offsetHeight;
  const x = +card.dataset.x, y = +card.dataset.y;
  ov.style.left = Math.max(0, x / 100 * (ww - lw)) + "px";
  ov.style.top = Math.max(0, y / 100 * (wh - lh)) + "px";
}
function applyLogoAll() { $$(".clip-card").forEach(applyLogoTo); }
const clampPct = (v) => Math.max(0, Math.min(100, v));

// Chỉnh màu TRỰC TIẾP bằng CSS filter (khớp eq khi nướng ở finalize).
function colorFilterCss() {
  const c = finState.color || {};
  return `brightness(${1 + (c.brightness || 0) / 200}) contrast(${1 + (c.contrast || 0) / 100}) saturate(${1 + (c.saturation || 0) / 100})`;
}
function applyColorAll() {
  const f = colorFilterCss();
  $$(".clip-card").forEach((card) => {
    const v = card.querySelector("video");
    if (v) v.style.filter = card.dataset.preview ? "none" : f; // bản đã nướng thì tắt filter (màu đã bám)
  });
}

function wireFinalize() {
  // Khởi tạo từ đầu vào: logo (ô ④), CTA chung (ô ③), màu về 0
  if (finState.logoPath) $("#fin-logoname").textContent = "(từ ô ④ Logo)";
  if (finState.cta) $$(".clip-card").forEach((card) => { card.dataset.cta = finState.cta; const n = card.querySelector(".cta-name"); if (n) n.textContent = "✔ CTA chung (ô ③)"; });

  // 🎨 Màu TRỰC TIẾP: kéo là thấy ngay (CSS), 'change' thì huỷ bản nướng cũ để tải lại đúng màu
  const bindColor = (id, key, lab) => {
    $("#" + id).addEventListener("input", (e) => { $("#" + lab).textContent = e.target.value; finState.color[key] = +e.target.value; applyColorAll(); });
    $("#" + id).addEventListener("change", invalidateAll);
  };
  bindColor("fin-bri", "brightness", "fin-brival");
  bindColor("fin-con", "contrast", "fin-conval");
  bindColor("fin-sat", "saturation", "fin-satval");
  $("#fin-colorreset").addEventListener("click", () => {
    finState.color = { brightness: 0, contrast: 0, saturation: 0 };
    ["fin-bri", "fin-con", "fin-sat"].forEach((i) => $("#" + i).value = 0);
    ["fin-brival", "fin-conval", "fin-satval"].forEach((i) => $("#" + i).textContent = "0");
    applyColorAll(); invalidateAll();
  });

  $("#fin-logo").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      finState.logoUrl = URL.createObjectURL(f);
      finState.logoPath = await uploadFile(f);
      $("#fin-logoname").textContent = f.name;
      applyLogoAll();
    } catch (err) { alert(err.message); }
  });
  $("#fin-sz").addEventListener("input", (e) => { $("#fin-szval").textContent = e.target.value; finState.scale = (+e.target.value) / 100; $$(".clip-card").forEach((c) => c.dataset.scale = finState.scale); applyLogoAll(); });
  $("#fin-op").addEventListener("input", (e) => { $("#fin-opval").textContent = e.target.value; finState.opacity = (+e.target.value) / 100; $$(".logo-ov").forEach((o) => o.style.opacity = finState.opacity); });
  $("#fin-music").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { finState.musicPath = await uploadFile(f); $("#fin-musicname").textContent = f.name; } catch (err) { alert(err.message); }
  });
  $("#fin-mv").addEventListener("input", (e) => { $("#fin-mvval").textContent = e.target.value; finState.musicVol = (+e.target.value) / 100; });

  // Kéo-thả logo trên từng video
  $$(".clip-card").forEach((card) => {
    const ov = card.querySelector(".logo-ov");
    const wrap = card.querySelector(".clip-vwrap");
    let d = null;
    const start = (cx, cy) => { d = { sx: cx, sy: cy, l: ov.offsetLeft, t: ov.offsetTop, ww: wrap.clientWidth, wh: wrap.clientHeight, lw: ov.offsetWidth, lh: ov.offsetHeight }; };
    const move = (cx, cy) => {
      if (!d) return;
      let nl = Math.max(0, Math.min(d.ww - d.lw, d.l + cx - d.sx));
      let nt = Math.max(0, Math.min(d.wh - d.lh, d.t + cy - d.sy));
      ov.style.left = nl + "px"; ov.style.top = nt + "px";
      card.dataset.x = (d.ww - d.lw > 0 ? nl / (d.ww - d.lw) * 100 : 0).toFixed(1);
      card.dataset.y = (d.wh - d.lh > 0 ? nt / (d.wh - d.lh) * 100 : 0).toFixed(1);
    };
    ov.addEventListener("mousedown", (e) => { e.preventDefault(); start(e.clientX, e.clientY); });
    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
    window.addEventListener("mouseup", () => { if (d) { d = null; invalidateCard(card); } });
    ov.addEventListener("touchstart", (e) => { start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    ov.addEventListener("touchmove", (e) => { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    ov.addEventListener("touchend", () => { if (d) { d = null; invalidateCard(card); } });
  });

  // Nút 4 hướng + zoom logo (chỉnh trực quan từng video)
  $$(".lpbtn").forEach((btn) => btn.addEventListener("click", () => {
    const card = btn.closest(".clip-card");
    const act = btn.dataset.act;
    const step = 4; // % mỗi lần nhấn
    if (act === "left") card.dataset.x = clampPct(+card.dataset.x - step);
    else if (act === "right") card.dataset.x = clampPct(+card.dataset.x + step);
    else if (act === "up") card.dataset.y = clampPct(+card.dataset.y - step);
    else if (act === "down") card.dataset.y = clampPct(+card.dataset.y + step);
    else if (act === "zoomin") card.dataset.scale = Math.min(0.6, +(card.dataset.scale || finState.scale) + 0.02).toFixed(3);
    else if (act === "zoomout") card.dataset.scale = Math.max(0.05, +(card.dataset.scale || finState.scale) - 0.02).toFixed(3);
    applyLogoTo(card);
    invalidateCard(card);
  }));

  // Chọn video CTA riêng cho từng short
  $$(".cta-input").forEach((inp) => inp.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const card = inp.closest(".clip-card");
    const nameEl = card.querySelector(".cta-name");
    nameEl.textContent = "đang tải CTA…";
    try { card.dataset.cta = await uploadFile(f); nameEl.textContent = "✔ CTA: " + f.name; invalidateCard(card); }
    catch (err) { nameEl.textContent = "lỗi tải CTA"; alert(err.message); }
  }));

  window.addEventListener("resize", applyLogoAll);

  // Huỷ bản xem trước khi anh đổi logo/nhạc/CTA (để tải luôn khớp cái vừa nghe)
  $("#fin-logo").addEventListener("change", invalidateAll);
  $("#fin-music").addEventListener("change", invalidateAll);
  $("#fin-sz").addEventListener("change", invalidateAll);
  $("#fin-op").addEventListener("change", invalidateAll);
  $("#fin-mv").addEventListener("change", invalidateAll);

  // Gom thiết lập finalize hiện tại cho 1 thẻ
  function finBody(card) {
    return {
      path: _acClips[+card.dataset.idx].outPath,
      color: finState.color,
      transition: finState.transition,
      logoPath: finState.logoPath || null, logoX: +card.dataset.x, logoY: +card.dataset.y,
      logoScale: +(card.dataset.scale || finState.scale), logoOpacity: finState.opacity,
      musicPath: finState.musicPath || null, musicVol: finState.musicVol,
      ctaPath: null,   // CTA đã được nướng sẵn vào short khi cắt (③) → không ghép lại ở finalize (tránh CTA đôi)
    };
  }
  const colorActive = () => { const c = finState.color || {}; return !!(c.brightness || c.contrast || c.saturation); };
  const hasExtras = (card) => finState.logoPath || finState.musicPath || card.dataset.cta || colorActive();

  // Chạy finalize → trả về đường dẫn file kết quả (Promise)
  function runFinalize(card, btn, labelBusy) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = labelBusy;
    return fetch("/api/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(finBody(card)) })
      .then((r) => r.json())
      .then((r) => new Promise((resolve, reject) => {
        if (r.error) return reject(new Error(r.error));
        pollJob(r.jobId, (j) => {
          btn.disabled = false; btn.textContent = old;
          if (j.status === "error") return reject(new Error(j.error));
          resolve(j.result.outPath);
        });
      }))
      .catch((err) => { btn.disabled = false; btn.textContent = old; throw err; });
  }

  // ▶ XEM TRƯỚC (có nhạc): nướng rồi PHÁT ngay trong app để nghe/kiểm chứng
  $$(".prevbtn").forEach((btn) => btn.addEventListener("click", async () => {
    const card = btn.closest(".clip-card");
    const v = card.querySelector("video");
    const note = card.querySelector(".prev-note");
    if (!hasExtras(card)) {
      // Không có nhạc/logo/CTA → bản gốc chính là bản cuối, cứ phát
      v.src = card.dataset.raw; v.load(); v.play();
      return alert("Chưa chọn nhạc/logo/CTA nên bản xem trước = bản gốc. Hãy chọn nhạc để nghe thử phần trộn.");
    }
    try {
      const out = await runFinalize(card, btn, "⏳ Đang tạo bản nghe thử…");
      card.dataset.preview = out;
      const url = "/api/file?path=" + encodeURIComponent(out);
      v.src = url; v.load(); v.play();
      v.style.filter = "none"; // màu đã nướng vào file → tắt filter CSS tránh nhân đôi
      if (note) note.style.display = "block";
    } catch (err) { alert(err.message); }
  }));

  // ⬇ TẢI: nếu đã xem trước với đúng thiết lập thì tải luôn bản đó; nếu chưa thì nướng rồi tải
  $$(".finbtn").forEach((btn) => btn.addEventListener("click", async () => {
    const card = btn.closest(".clip-card");
    const clip = _acClips[+card.dataset.idx];
    if (!hasExtras(card)) { downloadFile(clip.outPath); return; }
    try {
      let out = card.dataset.preview;
      if (!out) out = await runFinalize(card, btn, "⏳ Đang nướng…");
      downloadFile(out);   // tải ngầm, KHÔNG chuyển trang → các short khác còn nguyên
    } catch (err) { alert(err.message); }
  }));

  // 📤 ĐĂNG LÊN LARK: nếu đã có bản nướng logo/nhạc/CTA thì đăng bản đó; nếu có
  // thiết lập mà chưa nướng thì nướng trước; caption = caption AI, kèm thumbnail thương hiệu.
  $$(".larkbtn").forEach((btn) => btn.addEventListener("click", async () => {
    const card = btn.closest(".clip-card");
    const i = +card.dataset.idx;
    const clip = _acClips[i];
    const status = card.querySelector(".lark-status");
    let videoPath = clip.outPath;
    try {
      if (hasExtras(card)) {
        let out = card.dataset.preview;
        if (!out) out = await runFinalize(card, btn, "⏳ Nướng trước khi đăng…");
        videoPath = out;
      }
    } catch (err) { status.textContent = "❌ " + err.message; return; }
    const old = btn.textContent; btn.disabled = true; btn.textContent = "⏳ Đang đăng Lark…";
    status.textContent = "đang tạo record + upload video (video lớn có thể lâu)…";
    try {
      const r = await fetch("/api/lark-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath, caption: clip.caption || clip.title || "", thumbPath: clip.thumbPath || null }),
      }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      await new Promise((resolve, reject) => pollJob(r.jobId, (j) => {
        if (j.status === "error") return reject(new Error(j.error));
        resolve(j.result);
      }));
      status.textContent = "✅ Đã đăng lên Lark Base (Nội dung + Ảnh/video)";
    } catch (err) { status.textContent = "❌ " + err.message; alert("Đăng Lark lỗi: " + err.message); }
    finally { btn.disabled = false; btn.textContent = old; }
  }));

  applyLogoAll();
  applyColorAll();
}

// Huỷ bản xem trước của 1 thẻ (đưa video về bản gốc) — khi đổi thiết lập
function invalidateCard(card) {
  if (card.dataset.preview) {
    card.dataset.preview = "";
    const v = card.querySelector("video"); if (v) { try { v.pause(); } catch (e) {} v.src = card.dataset.raw; v.load(); v.style.filter = colorFilterCss(); }
    const n = card.querySelector(".prev-note"); if (n) n.style.display = "none";
  }
}
function invalidateAll() { $$(".clip-card").forEach(invalidateCard); }
