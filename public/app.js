// Viral Short Studio — frontend logic.
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---- Tabs ----
function activateTab(name) {
  $$(".tab").forEach((x) => x.classList.remove("active"));
  $$(".panel").forEach((x) => x.classList.remove("active"));
  const btn = document.querySelector(`.tab[data-tab="${name}"]`);
  if (btn) btn.classList.add("active");
  const panel = $("#tab-" + name);
  if (panel) panel.classList.add("active");
}
$$(".tab").forEach((t) => t.addEventListener("click", () => activateTab(t.dataset.tab)));

// ---- Bắt đầu nhanh (wizard) ----
$$(".wiz-b").forEach((b) => b.addEventListener("click", () => {
  activateTab(b.dataset.go);
  const w = $("#wizard"); if (w) w.classList.add("wiz-collapsed");
}));
if ($("#wiz-hide")) $("#wiz-hide").addEventListener("click", () => $("#wizard").classList.add("wiz-collapsed"));

// ---- Cấu hình (NGUỒN SỰ THẬT: /api/config) → điền mặc định + tên thương hiệu ----
let VSS_CFG = { brand: {}, defaults: {} };
fetch("/api/config").then((r) => r.json()).then((cfg) => {
  VSS_CFG = cfg || VSS_CFG;
  const b = cfg.brand || {}, d = cfg.defaults || {};
  // Header
  if (b.system && $("#brand-sub")) $("#brand-sub").textContent = `${b.system} — ${b.tagline || "cắt · biên tập · thumbnail · đăng Lark"}`;
  // Điền thư mục ảnh + tên hiển thị (không còn hardcode Y:\ trong HTML)
  const setVal = (id, v) => { const e = $("#" + id); if (e && !e.value && v != null) e.value = v; };
  setVal("ac-thumbdir", b.thumbPhotoDir); setVal("l-thumbdir", b.thumbPhotoDir);
  setVal("ac-thumbname", b.name); setVal("l-thumbname", b.name);
  fillFonts(cfg.fonts || [], d.fontId);
}).catch(() => { /* giữ mặc định HTML */ });

// ---- 🔤 CHỮ TRÊN VIDEO (font + bật/tắt chữ) — MỘT chỗ, áp cho MỌI tab ----
// Font đọc từ assets/fonts (server tự quét, tự lấy tên họ thật trong file font).
// Lựa chọn được NHỚ giữa các lần mở phần mềm.
function fillFonts(fonts, defId) {
  const sel = $("#g-font"), hint = $("#g-fonthint");
  if (!sel) return;
  const saved = localStorage.getItem("vss_font");
  sel.innerHTML = fonts.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
  const want = (saved && fonts.some((f) => f.id === saved)) ? saved : defId;
  if (want && fonts.some((f) => f.id === want)) sel.value = want;
  const custom = fonts.filter((f) => !f.system).length;
  if (hint) hint.textContent = custom
    ? `${custom} font trong kho · thêm font: chép .otf/.ttf vào assets\\fonts rồi mở lại phần mềm`
    : "Kho font trống — chép .otf/.ttf vào assets\\fonts rồi mở lại phần mềm";
  sel.addEventListener("change", () => localStorage.setItem("vss_font", sel.value));
}
(function initTextBar() {
  const no = $("#g-notext"), bar = $("#textbar");
  if (!no) return;
  no.checked = localStorage.getItem("vss_notext") === "1";
  const sync = () => {
    localStorage.setItem("vss_notext", no.checked ? "1" : "0");
    if (bar) bar.classList.toggle("notext", no.checked);
  };
  no.addEventListener("change", sync); sync();
})();
// Lựa chọn chữ được TIÊM vào mọi lệnh dựng video (khỏi phải sửa 7 chỗ gửi form).
const TEXT_ENDPOINTS = ["/api/autoclip", "/api/autoclip/plan", "/api/autoclip/render",
  "/api/edit", "/api/longedit", "/api/voiceshort", "/api/reclip", "/api/batch"];
const _rawFetch = window.fetch.bind(window);
window.fetch = (url, init) => {
  try {
    const u = String(url).split("?")[0];
    if (init && init.method === "POST" && typeof init.body === "string" && TEXT_ENDPOINTS.includes(u)) {
      const body = JSON.parse(init.body);
      const f = $("#g-font"), no = $("#g-notext");
      if (f && f.value && body.fontId == null) body.fontId = f.value;
      if (no && body.noText == null) body.noText = no.checked;
      init = { ...init, body: JSON.stringify(body) };
    }
  } catch { /* body không phải JSON → gửi nguyên */ }
  return _rawFetch(url, init);
};

// ---- Env ----
fetch("/api/health").then((r) => r.json()).then((h) => {
  const el = $("#env");
  el.textContent = h.gpu ? "⚡ GPU NVENC bật · sẵn sàng" : "CPU · sẵn sàng";
  if (h.gpu) el.classList.add("gpu");
  // Cảnh báo thư mục ảnh thumbnail không truy cập được (ổ mạng chưa gắn).
  if (h.thumbDirExists === false) $$(".thumbdir-warn").forEach((w) => w.style.display = "block");
  // Cảnh báo ổ đĩa gần đầy (kho video phình) — nhắc chạy DỌN KHO. Dưới 10GB = cảnh báo.
  if (typeof h.freeGB === "number" && h.freeGB < 10) {
    el.textContent += `  ·  ⚠ ổ đĩa còn ${h.freeGB} GB — nên bấm “DỌN KHO”`;
    el.style.color = "#d3102e";
    el.title = "Kho video (work/) đang chiếm nhiều dung lượng. Chạy DỌN KHO.bat hoặc để Task tự dọn mỗi đêm.";
  }
}).catch(() => { $("#env").textContent = "server chưa sẵn sàng"; });

// ---- Log ----
const logbox = $("#logbox"), logEl = $("#log");
$("#logtoggle").addEventListener("click", () => {
  logEl.hidden = !logEl.hidden;
  $("#logtoggle").textContent = logEl.hidden ? "Hiện log" : "Ẩn log";
});
function showLog(status) { logbox.hidden = false; $("#logstatus").textContent = status; }
function setLog(lines) { logEl.textContent = (lines || []).join("\n"); logEl.scrollTop = logEl.scrollHeight; }

// ---- Upload helper ----
async function uploadFile(file, onProgress) {
  onProgress && onProgress("Đang tải file lên server…");
  const r = await fetch("/api/upload", {
    method: "POST",
    headers: { "X-Filename": encodeURIComponent(file.name) },
    body: file,
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "upload lỗi");
  return j.path;
}

// ---- Drag & drop wiring ----
function wireDrop(zoneId, fileInputId, pathInputId, onFile) {
  const dz = $("#" + zoneId);
  if (fileInputId) $("#" + fileInputId).addEventListener("change", (e) => {
    if (e.target.files[0]) onFile(e.target.files[0]);
  });
  ["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => {
    e.preventDefault(); dz.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => {
    e.preventDefault(); dz.classList.remove("drag");
  }));
  dz.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  });
}

// ---- Poll job ----
// onTick (tuỳ chọn): gọi mỗi nhịp với trạng thái job — để hàng đợi nhiều video cập nhật từng dòng.
async function pollJob(jobId, onDone, onTick) {
  showLog("Đang xử lý…");
  const timer = setInterval(async () => {
    try {
      const j = await (await fetch("/api/job/" + jobId)).json();
      setLog(j.log);
      $("#logstatus").textContent =
        j.status === "queued" ? `🧾 Trong hàng đợi${j.queuePos ? " (thứ " + j.queuePos + ")" : ""}…` :
        j.status === "running" ? "⏳ Đang xử lý…" :
        j.status === "done" ? "✅ Hoàn tất" : "❌ Lỗi";
      if (onTick) { try { onTick(j); } catch (e) { /* không chặn vòng lặp */ } }
      if (j.status !== "running" && j.status !== "queued") {
        clearInterval(timer);
        onDone(j);
      }
    } catch (e) { /* giữ vòng lặp */ }
  }, 1200);
}

// ---- 🧾 BẢNG HÀNG ĐỢI NHIỀU VIDEO (dùng chung các tab) ----
// Thả nhiều video → mỗi video 1 dòng; server chạy LẦN LƯỢT, dòng nào xong hiện kết quả ngay dưới dòng đó.
function makeQueueBoard(host, title) {
  host.innerHTML = `<div class="qboard"><h3>🧾 ${esc(title)}</h3>
    <div class="muted" style="font-size:12px;margin-bottom:6px">Các video xếp hàng chạy <b>lần lượt</b> — anh cứ để máy tự làm, xong video nào kết quả hiện ngay dưới video đó.</div>
    <div class="qrows"></div></div>`;
  const rows = host.querySelector(".qrows");
  return {
    addRow(label) {
      const row = document.createElement("div"); row.className = "qrow";
      row.innerHTML = `<div class="qrow-head"><b>🎞️ ${esc(label)}</b> <span class="qrow-status muted">🧾 đang gửi vào hàng đợi…</span></div><div class="qrow-mount"></div>`;
      rows.appendChild(row);
      return {
        mount: row.querySelector(".qrow-mount"),
        status(t) { const s = row.querySelector(".qrow-status"); if (s) s.textContent = t; },
      };
    },
  };
}
function queueStatusText(j, runningTxt) {
  if (j.status === "queued") return `🧾 Chờ tới lượt${j.queuePos ? ` (thứ ${j.queuePos} trong hàng)` : ""}…`;
  if (j.status === "running") return runningTxt || "⏳ Đang xử lý…";
  if (j.status === "done") return "✅ Xong";
  return "❌ Lỗi";
}

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
          <a class="dl ghost" href="/api/file?dl=1&path=${encodeURIComponent(out)}" download>⬇ Tải video</a>
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
      <summary>✏️ Tinh chỉnh short này (sửa điểm cắt · phụ đề · hiệu ứng)</summary>
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
          <label>Khung: ${sel("reframe", [["blur", "9:16 nền mờ"], ["fill", "9:16 cắt đầy"]], ed.reframe || "blur")}</label>
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
          <video src="${url}" controls preload="none"></video>
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
            <span class="clip-score" title="Điểm NỘI DUNG — AI chấm triết lý + viral + cảm xúc">📝 ${c.score}</span>
            ${c.techScore != null ? `<span class="clip-score tech" title="Điểm KỸ THUẬT — 6 trục hook/nhịp/giữ chân/âm thanh/định dạng/phụ đề">🔧 ${c.techScore}</span>` : ""}
            <b>${(c.title||"").replace(/</g,"&lt;")}</b>
          </div>
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
          <div class="clip-dls">
            <button class="dl prevbtn" data-idx="${i}">▶ Xem trước (có nhạc)</button>
            <a class="dl ghost" href="/api/file?dl=1&path=${encodeURIComponent(c.outPath)}" download>⬇ Bản gốc</a>
            <button class="dl finbtn" data-idx="${i}">⬇ Tải kèm logo/nhạc/CTA</button>
            <button class="dl larkbtn" data-idx="${i}">📤 Đăng Lark</button>
          </div>
          <div class="lark-status muted" data-idx="${i}" style="font-size:11px;margin-top:4px">${c.larkPosted ? "✅ Đã tự đăng Lark (Loại=Video · Fanpage HMH)" : (c.larkError ? "⚠ Tự đăng Lark lỗi: " + esc(c.larkError) : "")}</div>
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
  bar.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff5f5;border:1px solid #f0c0c0;border-radius:10px;padding:10px 12px;margin:6px 0 12px;font-size:13px";
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

// ================= ĐÁNH GIÁ =================
let evalPath = null;
wireDrop("dz-eval", "file-eval", "path-eval", async (f) => {
  showLog("Tải lên…");
  try { evalPath = await uploadFile(f); $("#path-eval").value = evalPath; setLog(["✔ Đã tải: " + f.name]); }
  catch (e) { alert(e.message); }
});
$("#btn-eval").addEventListener("click", async () => {
  const file = $("#path-eval").value.trim() || evalPath;
  if (!file) return alert("Chọn hoặc kéo-thả video, hoặc dán đường dẫn.");
  $("#btn-eval").disabled = true; $("#eval-out").innerHTML = "";
  const r = await fetch("/api/evaluate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: file, deep: $("#eval-deep").checked, model: $("#eval-model").value }),
  }).then((r) => r.json());
  if (r.error) { $("#btn-eval").disabled = false; return alert(r.error); }
  pollJob(r.jobId, (j) => {
    $("#btn-eval").disabled = false;
    if (j.status === "error") return alert(j.error);
    renderScorecard($("#eval-out"), j.result);
  });
});

// 🏅 CHẠY TIÊU CHUẨN — chấm theo thang 100 điểm.
$("#btn-standard").addEventListener("click", async () => {
  const file = $("#path-eval").value.trim() || evalPath;
  if (!file) return alert("Chọn hoặc kéo-thả video, hoặc dán đường dẫn.");
  const btn = $("#btn-standard"); const old = btn.textContent;
  btn.disabled = true; btn.textContent = "⏳ Đang chấm tiêu chuẩn…"; $("#eval-out").innerHTML = "";
  const r = await fetch("/api/standard", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: file, model: $("#eval-model").value }),
  }).then((r) => r.json());
  if (r.error) { btn.disabled = false; btn.textContent = old; return alert(r.error); }
  pollJob(r.jobId, (j) => {
    btn.disabled = false; btn.textContent = old;
    if (j.status === "error") return alert(j.error);
    renderStandard($("#eval-out"), j.result);
  });
});
function standardColor(t) { return t >= 90 ? "var(--ok)" : t >= 80 ? "var(--warn)" : "var(--acc)"; }
function renderStandard(host, r) {
  const esc2 = (s) => String(s == null ? "" : s).replace(/</g, "&lt;");
  const cats = (r.categories || []).map((c) => {
    const pct = c.max ? Math.round((c.score / c.max) * 100) : 0;
    const col = pct >= 80 ? "var(--ok)" : pct >= 60 ? "var(--warn)" : "var(--acc)";
    return `<div class="dim">
      <div class="h"><span>${esc2(c.name)} <span class="muted" style="font-size:11px">(${c.do_bang === "máy đo" ? "máy đo" : "AI"})</span></span><span style="color:${col}"><b>${c.score}</b>/${c.max}</span></div>
      <div class="bar"><i style="width:${pct}%;background:${col}"></i></div>
      ${c.nhan_xet ? `<div class="d">${esc2(c.nhan_xet)}</div>` : ""}
      ${c.sua ? `<ul><li>🔧 ${esc2(c.sua)}</li></ul>` : ""}
    </div>`;
  }).join("");
  const check = (r.checklist || []).map((x) => `<li>${x.dat ? "✅" : "❌"} ${esc2(x.tieu_chi)}</li>`).join("");
  const cam = (r.cam_ky || []).map((x) => `<li>🚫 ${esc2(x)}</li>`).join("");
  const fixes = (r.sua_uu_tien || []).map((x) => `<li>➡️ ${esc2(x)}</li>`).join("");
  host.innerHTML = `<div class="scorecard">
    <div class="overall">
      <div class="bigscore" style="color:${standardColor(r.total)}">${r.total}<span style="font-size:22px">/100</span></div>
      <div><div class="verdict"><b>${esc2(r.verdict)}</b></div>
        <div class="muted" style="font-size:12px">${r.meta.width}x${r.meta.height} · ${r.meta.duration.toFixed(0)}s · ${r.signals.cutsPerMin ?? "?"} cắt/phút · ${r.signals.lufs ?? "?"} LUFS</div></div>
    </div>
    <div class="grid">${cats}</div>
    ${cam ? `<div class="ai"><b>🚫 Điều cấm kỵ bị vi phạm:</b><ul style="margin:6px 0 0">${cam}</ul></div>` : ""}
    ${fixes ? `<div class="ai" style="border-left-color:var(--ok)"><b>➡️ Việc cần sửa ưu tiên:</b><ul style="margin:6px 0 0">${fixes}</ul></div>` : ""}
    ${check ? `<details style="margin-top:14px" open><summary class="muted">☑️ Checklist nghiệm thu</summary><ul style="margin:6px 0 0;columns:2">${check}</ul></details>` : ""}
  </div>`;
}

function scoreColor(s) { return s >= 75 ? "var(--ok)" : s >= 55 ? "var(--warn)" : "var(--acc)"; }
function renderScorecard(host, ev) {
  const dims = ev.dimensions || {};
  const dimHtml = Object.values(dims).map((d) => `
    <div class="dim">
      <div class="h"><span>${d.label}</span><span style="color:${scoreColor(d.score)}">${d.score}</span></div>
      <div class="bar"><i style="width:${d.score}%;background:${scoreColor(d.score)}"></i></div>
      <div class="d">${d.detail}</div>
      ${d.tips && d.tips.length ? `<ul>${d.tips.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}
    </div>`).join("");
  host.innerHTML = `
    <div class="scorecard">
      <div class="overall">
        <div class="bigscore" style="color:${scoreColor(ev.overall)}">${ev.overall}</div>
        <div><div class="verdict"><b>${ev.verdict}</b></div>
          <div class="muted" style="font-size:12px">${ev.meta.width}x${ev.meta.height} · ${ev.meta.duration.toFixed(0)}s · ${ev.signals.cutsPerMin} cắt/phút · ${ev.signals.lufs ?? "?"} LUFS</div>
        </div>
      </div>
      <div class="grid">${dimHtml}</div>
      ${ev.aiAnalysis ? `<div class="ai"><b>🤖 Phân tích sâu (AI cloud):</b>\n\n${ev.aiAnalysis}</div>` : ""}
      ${ev.transcriptText ? `<details style="margin-top:14px"><summary class="muted">Transcript</summary><p style="font-size:13px">${ev.transcriptText}</p></details>` : ""}
    </div>`;
}

// ================= BIÊN TẬP =================
// 🧾 Nhận NHIỀU video một lượt (chip) + 👁️ duyệt đoạn cắt trên trục thời gian trước khi render.
let editPath = null;
let editFiles = [];   // [{path, name}]
function drawEditFiles() {
  const el = $("#edit-files"); if (!el) return;
  el.innerHTML = editFiles.length
    ? editFiles.map((f, i) => `<span class="fchip">🎞️ ${esc(f.name)} <button type="button" class="fchip-x" data-i="${i}" title="Bỏ video này">✕</button></span>`).join("")
      + (editFiles.length > 1 ? `<span class="muted" style="font-size:11.5px">${editFiles.length} video sẽ xếp hàng chạy lần lượt</span>` : "")
    : "";
}
if ($("#edit-files")) $("#edit-files").addEventListener("click", (e) => {
  const b = e.target.closest(".fchip-x"); if (!b) return;
  editFiles.splice(+b.dataset.i, 1);
  if (editFiles.length === 1) { editPath = editFiles[0].path; $("#path-edit").value = editPath; }
  else if (!editFiles.length) { editPath = null; $("#path-edit").value = ""; }
  drawEditFiles();
});
async function editAddFiles(files) {
  for (const f of files) {
    try { showLog("Tải lên: " + f.name); const pth = await uploadFile(f); editFiles.push({ path: pth, name: f.name }); }
    catch (e) { alert(e.message); }
  }
  if (editFiles.length === 1) { editPath = editFiles[0].path; $("#path-edit").value = editPath; }
  else if (editFiles.length > 1) { editPath = null; $("#path-edit").value = ""; }
  drawEditFiles();
  setLog([`✔ Đã thêm ${files.length} video${editFiles.length > 1 ? ` (tổng ${editFiles.length} — sẽ chạy lần lượt)` : ""}.`]);
}
(function () {
  const dz = $("#dz-edit"); if (!dz) return;
  $("#file-edit").addEventListener("change", (e) => { if (e.target.files.length) editAddFiles([...e.target.files]); });
  ["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) editAddFiles([...e.dataTransfer.files]); });
})();
// Body cho 1 video (đọc thiết lập hiện tại của tab) — tách hàm để chạy được từng video trong hàng đợi.
function editBodyFor(file) {
  return {
    path: file,
    note: ($("#e-note") ? $("#e-note").value.trim() : "") || null,
    removeFillers: $("#e-fillers").checked,
    doCutSilence: $("#e-cut").checked,
    doCaptions: $("#e-cap").checked,
    normalize: $("#e-norm").checked,
    reframe: $("#e-reframe").value,
    captionStyle: $("#e-capstyle").value,
    colorLevel: $("#e-color").value,
    manual: {
      brightness: +$("#e-bri").value, contrast: +$("#e-con").value,
      saturation: +$("#e-sat").value, warmth: +$("#e-war").value,
    },
    sharpen: +$("#e-sharpen").value,
    speed: parseFloat($("#e-speed") ? $("#e-speed").value : "1") || 1,
    aiCorrectText: $("#e-aitext").checked,
    smooth: $("#e-smooth").value,
    voiceClean: $("#e-voice").value,
    punch: $("#e-punch").checked,
    shake: $("#e-shake").checked,
    flash: $("#e-flash").checked,
    film: $("#e-film").checked,
    progress: $("#e-prog").checked,
    sfx: $("#e-sfx").checked,
    stickers: $("#e-stickers").checked,
    stickerFolder: $("#e-stickerfolder").value.trim() || null,
    brollTransition: $("#e-trans").value,
    aiBroll: $("#e-aibroll").checked,
    aiBrollCount: parseInt($("#e-aicount").value, 10) || 6,
    brollFolder: $("#e-broll").value.trim() || null,
    brollFill: $("#e-brollfill").value,
    logoPath: $("#e-logo").value.trim() || null,
    logoPos: $("#e-logopos").value,
    logoScale: (parseInt($("#e-logosize").value, 10) || 16) / 100,
    musicPath: $("#e-music").value.trim() || null,
    ...publishBody("e"),
    postLark: $("#e-mklark") ? $("#e-mklark").checked : false,
  };
}
function renderEditResult(host, result) {
  const out = result.outPath;
  const url = "/api/file?path=" + encodeURIComponent(out);
  host.innerHTML = `
    <div class="result-video">
      <h3>✅ Bản viral đã xong (${result.meta.width}x${result.meta.height}, ${result.meta.duration.toFixed(0)}s)</h3>
      <video src="${url}" controls></video><br>
      <a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(out)}" download>⬇ Tải video</a>
      <div class="muted" style="font-size:12px;margin-top:8px">${out}</div>
      ${publishHtml(result)}
    </div>`;
}
$("#btn-edit").addEventListener("click", async () => {
  const single = $("#path-edit").value.trim() || editPath;
  const lbl = (s) => String(s || "").split(/[\\/]/).pop() || "video";
  const sources = editFiles.length > 1
    ? editFiles.map((f) => ({ path: f.path, label: f.name }))
    : (single ? [{ path: single, label: lbl(single) }] : []);
  if (!sources.length) return alert("Chọn/kéo-thả video (một hoặc NHIỀU file) hoặc dán đường dẫn.");
  confirmLark("e");
  const review = $("#e-review-first") ? $("#e-review-first").checked : false;
  const many = sources.length > 1;
  const board = many ? makeQueueBoard($("#edit-out"), `Hàng đợi ${sources.length} video`) : null;
  if (!many) $("#edit-out").innerHTML = "";
  const btn = $("#btn-edit"); btn.disabled = true;
  let doneCnt = 0;
  const doneOne = () => { doneCnt++; if (doneCnt >= sources.length) btn.disabled = false; };
  const post = (url, b) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

  for (const s of sources) {
    const row = board ? board.addRow(s.label) : null;
    const host = row ? row.mount : $("#edit-out");
    if (review) {
      // 👁️ PHA 1: lên kế hoạch cắt (lặng/tiếng đệm) → bảng duyệt trục thời gian → PHA 2 render.
      if (!row) host.innerHTML = '<div class="muted">👁️ Đang gõ chữ + lên kế hoạch cắt để anh DUYỆT trên trục thời gian… (chưa render)</div>';
      const r = await post("/api/edit/plan", editBodyFor(s.path));
      if (r.error) { alert(r.error); doneOne(); continue; }
      pollJob(r.jobId, (j) => {
        doneOne();
        if (j.status === "error") { if (row) row.status("❌ " + j.error); return alert(j.error); }
        if (row) row.status("👁️ chờ anh duyệt");
        makeReviewPanel(host, j.result, {
          title: `Duyệt ${(j.result.clips || []).length} đoạn trước khi render`,
          note: "Khối xanh = GIỮ · vùng đỏ = CẮT (khoảng lặng/tiếng đệm). Kéo mép để lấy thêm/bớt, ✓/✗ để giữ/bỏ cả đoạn, nghe thử từng đoạn rồi bấm render.",
          onRender: async (kept, P, ui) => {
            const rb = {
              ...editBodyFor(s.path), source: P.source, keep: P.keep,
              clips: kept.map((c) => ({ start: c.sourceStart, end: c.sourceEnd, origStart: c.origStart, origEnd: c.origEnd })),
            };
            ui.status("🎬 Đang render bản đã duyệt…");
            const rr = await post("/api/edit/render", rb);
            if (rr.error) { alert(rr.error); return; }
            pollJob(rr.jobId, (jj) => {
              if (jj.status === "error") { if (row) row.status("❌ " + jj.error); return alert(jj.error); }
              if (row) row.status("✅ xong");
              renderEditResult(host, jj.result);
            }, row ? (jj) => row.status(queueStatusText(jj, "🎬 đang render…")) : null);
          },
        });
      }, row ? (j) => row.status(queueStatusText(j, "👁️ đang lên kế hoạch cắt…")) : null);
    } else {
      // Chạy 1 phát như cũ.
      const r = await post("/api/edit", editBodyFor(s.path));
      if (r.error) { alert(r.error); doneOne(); continue; }
      pollJob(r.jobId, (j) => {
        doneOne();
        if (j.status === "error") { if (row) row.status("❌ " + j.error); return alert(j.error); }
        if (row) row.status("✅ xong");
        renderEditResult(host, j.result);
      }, row ? (j) => row.status(queueStatusText(j, "🎬 đang biên tập…")) : null);
    }
  }
});

// ================= BÓC Ý TƯỞNG =================
$("#btn-extract").addEventListener("click", async () => {
  const url = $("#ex-url").value.trim();
  const file = $("#ex-path").value.trim();
  if (!url && !file) return alert("Dán link hoặc đường dẫn video.");
  $("#btn-extract").disabled = true; $("#extract-out").innerHTML = "";
  const r = await fetch("/api/extract", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url || null, path: file || null, deep: $("#ex-deep").checked }),
  }).then((r) => r.json());
  if (r.error) { $("#btn-extract").disabled = false; return alert(r.error); }
  pollJob(r.jobId, (j) => {
    $("#btn-extract").disabled = false;
    if (j.status === "error") return alert(j.error);
    const d = j.result;
    const beats = (d.beats || []).map((b) => `<div class="beat"><b>${b.t}s</b><span>${b.text}</span></div>`).join("");
    $("#extract-out").innerHTML = `
      <div class="scorecard">
        <h3>🔎 Công thức video (${d.structure.durationSec}s · ${d.structure.cutsPerMin} cắt/phút · ${d.structure.wpm ?? "?"} từ/phút)</h3>
        <div style="margin:10px 0"><b>HOOK:</b> <span style="color:#ffd7c9">"${d.hook}"</span></div>
        ${d.aiAnalysis ? `<div class="ai"><b>🤖 Công thức bóc bằng AI:</b>\n\n${d.aiAnalysis}</div>` : ""}
        <details style="margin-top:14px" open><summary class="muted">Cấu trúc theo mốc giây</summary>${beats}</details>
        ${d.transcript ? `<details style="margin-top:10px"><summary class="muted">Transcript đầy đủ</summary><p style="font-size:13px">${d.transcript}</p></details>` : ""}
      </div>`;
  });
});

// ================= HÀNG LOẠT =================
$("#btn-batch").addEventListener("click", async () => {
  const folder = $("#b-folder").value.trim();
  if (!folder) return alert("Dán đường dẫn thư mục chứa video.");
  $("#btn-batch").disabled = true; $("#batch-out").innerHTML = "";
  const body = {
    folder, mode: $("#b-mode").value,
    doCutSilence: $("#b-cut").checked, doCaptions: $("#b-cap").checked, normalize: $("#b-norm").checked,
  };
  const r = await fetch("/api/batch", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).then((r) => r.json());
  if (r.error) { $("#btn-batch").disabled = false; return alert(r.error); }
  pollJob(r.jobId, (j) => {
    $("#btn-batch").disabled = false;
    if (j.status === "error") return alert(j.error);
    const res = j.result;
    let rows;
    if (res.mode === "edit") {
      rows = res.results.map((x) => `<tr><td>${x.file.split(/[\\/]/).pop()}</td><td>${x.error ? "❌ " + x.error : `<a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(x.outPath)}" download>⬇ tải</a>`}</td></tr>`).join("");
      $("#batch-out").innerHTML = `<div class="scorecard"><h3>📦 Đã biên tập ${res.count} video</h3>
        <table class="batch-tbl"><tr><th>File</th><th>Kết quả</th></tr>${rows}</table></div>`;
    } else {
      rows = res.results.map((x) => `<tr><td>${x.file.split(/[\\/]/).pop()}</td><td style="color:${x.error ? "var(--acc)" : scoreColor(x.overall)};font-weight:700">${x.error ? "❌" : x.overall}</td><td>${x.error ? x.error : x.verdict}</td></tr>`).join("");
      $("#batch-out").innerHTML = `<div class="scorecard"><h3>📦 Đã chấm ${res.count} video</h3>
        <table class="batch-tbl"><tr><th>File</th><th>Điểm</th><th>Nhận định</th></tr>${rows}</table></div>`;
    }
  });
});

// ================= 🎬 VIDEO DÀI YOUTUBE =================
async function longAddFiles(files) {
  const ta = $("#long-paths");
  for (const f of files) {
    try { showLog("Tải lên: " + f.name); const pth = await uploadFile(f); ta.value += (ta.value.trim() ? "\n" : "") + pth; }
    catch (e) { alert(e.message); }
  }
  setLog(["✔ Đã thêm " + files.length + " video vào danh sách ghép"]);
}
$("#file-long").addEventListener("change", (e) => { if (e.target.files.length) longAddFiles([...e.target.files]); });
(function () {
  const dz = $("#dz-long"); if (!dz) return;
  ["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) longAddFiles([...e.dataTransfer.files]); });
})();
$("#l-mv").addEventListener("input", (e) => { $("#l-mvval").textContent = e.target.value; });
function buildLongBody(paths) {
  return {
    paths,
    removeFillers: $("#l-fillers").checked,
    note: ($("#l-note") ? $("#l-note").value.trim() : "") || null,
    doCutSilence: $("#l-cut").checked,
    doCaptions: $("#l-cap").checked,
    captionStyle: $("#l-capstyle").value,
    reframe: $("#l-reframe").value,
    model: $("#l-model").value,
    colorLevel: $("#l-color").value,
    sharpen: +$("#l-sharpen").value,
    aiCorrectText: $("#l-aitext").checked,
    smooth: $("#l-smooth").value,
    voiceClean: $("#l-voice").value,
    film: $("#l-film").checked,
    normalize: $("#l-norm").checked,
    musicPath: $("#l-music").value.trim() || null,
    musicVol: (parseInt($("#l-mv").value, 10) || 14) / 100,
    transition: $("#l-trans").value,
    introPath: $("#l-intro").value.trim() || null,
    outroPath: $("#l-outro").value.trim() || null,
    aspect: $("#l-aspect").value,
    titleTop: $("#l-ttop").value.trim(),
    titleBottom: $("#l-tbot").value.trim(),
    smartPrune: $("#l-smart").checked,
    brollFolder: $("#l-broll").value.trim() || null,
    brollFill: $("#l-brollfill").value,
    makeThumb: $("#l-thumb").checked,
    thumbPhotoDir: $("#l-thumbdir").value.trim() || (VSS_CFG.brand && VSS_CFG.brand.thumbPhotoDir) || null,
    thumbTitle: $("#l-thumbtitle").value.trim(),
    thumbName: $("#l-thumbname").value.trim() || (VSS_CFG.brand && VSS_CFG.brand.name) || "",
    makeContent: $("#l-mkcontent") ? $("#l-mkcontent").checked : true,
    postLark: $("#l-mklark") ? $("#l-mklark").checked : false,
    maxMinutes: parseInt($("#l-maxmin").value, 10) || 10,
  };
}
function renderLongResult(host, result) {
  const parts = (result && result.parts) || [];
  const cards = parts.map((p, i) => {
    const url = "/api/file?path=" + encodeURIComponent(p.outPath);
    return `<div class="clip-card" style="max-width:420px">
      <video src="${url}" controls style="width:100%;aspect-ratio:${result.aspect === "1:1" ? "1/1" : "16/9"};background:#000"></video>
      <div class="clip-body">
        <div class="clip-top"><b>${parts.length > 1 ? "Phần " + (i + 1) : "Video dài"}</b> · ${p.meta.width}x${p.meta.height} · ${Math.round(p.meta.duration)}s</div>
        <div class="clip-dls">
          <a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(p.outPath)}" download>⬇ Tải video</a>
        </div>
        ${publishHtml(p)}
      </div></div>`;
  }).join("");
  host.innerHTML = `<div class="scorecard"><h3>✅ Đã xong ${parts.length > 1 ? parts.length + " phần" : "video dài"} (${result.aspect})</h3>
    <div class="clip-grid">${cards}</div></div>`;
}
async function runLong() {
  const paths = $("#long-paths").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!paths.length) return alert("Thêm ít nhất 1 video (kéo-thả nhiều file, chọn file, hoặc dán đường dẫn — mỗi dòng 1 video).");
  saveProject("vss-long", LONG_FIELDS);
  confirmLark("l");
  const body = buildLongBody(paths);
  const post = (url, b) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  $("#btn-long").disabled = true; $("#long-out").innerHTML = "";

  // 👁️ DUYỆT TRƯỚC: ghép + lên kế hoạch cắt → bảng duyệt trục thời gian → render.
  if ($("#l-review-first") && $("#l-review-first").checked) {
    $("#long-out").innerHTML = '<div class="muted">👁️ Đang ghép video + lên kế hoạch cắt để anh DUYỆT trên trục thời gian… (chưa render)</div>';
    const r = await post("/api/longedit/plan", body);
    if (r.error) { $("#btn-long").disabled = false; return alert(r.error); }
    pollJob(r.jobId, (j) => {
      $("#btn-long").disabled = false;
      if (j.status === "error") return alert(j.error);
      makeReviewPanel($("#long-out"), j.result, {
        title: `Duyệt ${(j.result.clips || []).length} đoạn của video dài trước khi render`,
        note: "Khối xanh = GIỮ · vùng đỏ = CẮT (chào hỏi/lan man/lặng — tuỳ chế độ đã chọn). Kéo mép lấy thêm/bớt, ✓/✗ giữ/bỏ, nghe thử từng đoạn rồi bấm render.",
        renderLabel: "🚀 Render video dài đã duyệt →",
        onRender: async (kept, P, ui) => {
          const rb = {
            ...buildLongBody(paths), source: P.source, keep: P.keep,
            clips: kept.map((c) => ({ start: c.sourceStart, end: c.sourceEnd, origStart: c.origStart, origEnd: c.origEnd })),
          };
          ui.status(`🎬 Đang render video dài từ ${kept.length} đoạn đã duyệt…`);
          const rr = await post("/api/longedit/render", rb);
          if (rr.error) { alert(rr.error); return; }
          pollJob(rr.jobId, (jj) => {
            if (jj.status === "error") return alert(jj.error);
            renderLongResult($("#long-out"), jj.result);
          });
        },
      });
    });
    return;
  }

  // Chạy 1 phát như cũ.
  const r = await post("/api/longedit", body);
  if (r.error) { $("#btn-long").disabled = false; return alert(r.error); }
  pollJob(r.jobId, (j) => {
    $("#btn-long").disabled = false;
    if (j.status === "error") return alert(j.error);
    renderLongResult($("#long-out"), j.result);
  });
}
$("#btn-long").addEventListener("click", runLong);
wireUpload("file-lmusic", "l-music");
wireUpload("file-lintro", "l-intro");
wireUpload("file-loutro", "l-outro");

// ================= 🎙️ SHORT LỒNG VOICE =================
async function voiceAddClips(files) {
  const ta = $("#voice-clips");
  for (const f of files) { try { showLog("Tải lên: " + f.name); const pth = await uploadFile(f); ta.value += (ta.value.trim() ? "\n" : "") + pth; } catch (e) { alert(e.message); } }
  setLog(["✔ Đã thêm " + files.length + " clip bối cảnh"]);
}
$("#file-voiceclips").addEventListener("change", (e) => { if (e.target.files.length) voiceAddClips([...e.target.files]); });
(function () {
  const dz = $("#dz-voice"); if (!dz) return;
  ["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) voiceAddClips([...e.dataTransfer.files]); });
})();
wireUpload("file-voice", "voice-audio");
wireUpload("file-voicemusic", "voice-music");

// Preset phong cách — 1 bấm cấu hình theo kiểu video mẫu.
function applyVoicePreset(name) {
  const set = (id, v) => { const e = $("#" + id); if (e) { if (e.type === "checkbox") e.checked = v; else e.value = v; e.dispatchEvent(new Event("input")); } };
  if (name === "cinematic") {
    // 🎬 Kể chuyện điện ảnh như video mẫu FB: màu nhẹ tự nhiên, KHÔNG phụ đề/hook, cắt mượt, nhạc êm.
    set("voice-color", "low"); set("voice-smooth", "off"); set("voice-film", false);
    set("voice-cap", false); set("voice-prog", false); set("voice-hook", "");
    set("voice-trans", "cut"); set("voice-mv", 10); set("voice-vv", 100);
  } else if (name === "viral") {
    // ⚡ Viral năng động: phụ đề karaoke, màu đậm, vignette, hook (tự điền), nhạc rõ hơn.
    set("voice-color", "high"); set("voice-smooth", "medium"); set("voice-film", true);
    set("voice-cap", true); set("voice-capstyle", "karaoke"); set("voice-prog", true);
    set("voice-trans", "fade"); set("voice-mv", 15); set("voice-vv", 100);
  }
}
$("#voice-preset").addEventListener("change", (e) => applyVoicePreset(e.target.value));
applyVoicePreset("cinematic"); // mặc định theo video mẫu
$("#voice-vv").addEventListener("input", (e) => { $("#voice-vvval").textContent = e.target.value; });
$("#voice-mv").addEventListener("input", (e) => { $("#voice-mvval").textContent = e.target.value; });
function buildVoiceBody(clips, voicePath) {
  return {
    clips, voicePath,
    voiceVol: (parseInt($("#voice-vv").value, 10) || 100) / 100,
    musicPath: $("#voice-music").value.trim() || null,
    musicVol: (parseInt($("#voice-mv").value, 10) || 12) / 100,
    colorLevel: $("#voice-color").value,
    smooth: $("#voice-smooth").value,
    film: $("#voice-film").checked,
    doCaptions: $("#voice-cap").checked,
    captionStyle: $("#voice-capstyle").value,
    progress: $("#voice-prog").checked,
    hookText: $("#voice-hook").value.trim() || null,
    brollFolder: $("#voice-broll").value.trim() || null,
    brollFill: $("#voice-brollfill").value,
    transition: $("#voice-trans").value,
    ...publishBody("voice"),
    postLark: $("#voice-mklark") ? $("#voice-mklark").checked : false,
  };
}
function renderVoiceResult(host, result) {
  const out = result.outPath, url = "/api/file?path=" + encodeURIComponent(out);
  host.innerHTML = `<div class="result-video"><h3>✅ Short lồng voice đã xong (${result.meta.width}x${result.meta.height}, ${Math.round(result.meta.duration)}s)</h3>
    <video src="${url}" controls style="max-width:300px;width:100%"></video><br>
    <a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(out)}" download>⬇ Tải video</a>
    <div class="muted" style="font-size:12px;margin-top:8px">${out}</div>
    ${publishHtml(result)}</div>`;
}
async function runVoice() {
  const clips = $("#voice-clips").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const voicePath = $("#voice-audio").value.trim();
  if (!clips.length) return alert("Thêm ít nhất 1 clip bối cảnh.");
  if (!voicePath) return alert("Chọn file giọng đọc (voice-over).");
  saveProject("vss-voice", VOICE_FIELDS);
  confirmLark("voice");
  const body = buildVoiceBody(clips, voicePath);
  const post = (url, b) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  $("#btn-voice").disabled = true; $("#voice-out").innerHTML = "";

  // 👁️ DUYỆT TRƯỚC: nghe + cắt gọn GIỌNG ĐỌC trên trục sóng âm (bỏ khoảng chết/đoạn hỏng) → dựng.
  if ($("#voice-review-first") && $("#voice-review-first").checked) {
    $("#voice-out").innerHTML = '<div class="muted">👁️ Đang gõ chữ giọng đọc + lên kế hoạch cắt gọn để anh DUYỆT… (chưa dựng)</div>';
    const r = await post("/api/voiceshort/plan", { voicePath });
    if (r.error) { $("#btn-voice").disabled = false; return alert(r.error); }
    pollJob(r.jobId, (j) => {
      $("#btn-voice").disabled = false;
      if (j.status === "error") return alert(j.error);
      makeReviewPanel($("#voice-out"), j.result, {
        title: `Duyệt ${(j.result.clips || []).length} đoạn GIỌNG ĐỌC trước khi dựng`,
        audioOnly: true,
        note: "Sóng âm = giọng đọc. Khối xanh = GIỮ · vùng đỏ = khoảng lặng/chết sẽ bị CẮT. Nghe thử từng đoạn, bỏ đoạn đọc hỏng, kéo mép nếu cắt phạm chữ — video sẽ dựng khớp giọng đã cắt gọn.",
        legend: 'sóng âm + khối xanh đánh số = <b>ĐƯỢC GIỮ</b> · vùng phủ đỏ mờ = <b>BỊ CẮT BỎ</b>',
        renderLabel: "🚀 Dựng short với giọng đã duyệt →",
        onRender: async (kept, P, ui) => {
          const rb = {
            ...buildVoiceBody(clips, voicePath),
            source: P.source, keep: P.keep, sceneClips: clips,
            clips: kept.map((c) => ({ start: c.sourceStart, end: c.sourceEnd, origStart: c.origStart, origEnd: c.origEnd })),
          };
          ui.status("🎙️ Đang dựng short với giọng đọc đã cắt gọn…");
          const rr = await post("/api/voiceshort/render", rb);
          if (rr.error) { alert(rr.error); return; }
          pollJob(rr.jobId, (jj) => {
            if (jj.status === "error") return alert(jj.error);
            renderVoiceResult($("#voice-out"), jj.result);
          });
        },
      });
    });
    return;
  }

  // Chạy 1 phát như cũ.
  const r = await post("/api/voiceshort", body);
  if (r.error) { $("#btn-voice").disabled = false; return alert(r.error); }
  pollJob(r.jobId, (j) => {
    $("#btn-voice").disabled = false;
    if (j.status === "error") return alert(j.error);
    renderVoiceResult($("#voice-out"), j.result);
  });
}
$("#btn-voice").addEventListener("click", runVoice);

// ================= 💾 LƯU / MỞ LẠI PROJECT (2 mode mới) =================
// Nhớ thiết lập + đường dẫn input để chỉnh lại KHÔNG phải nhập lại; kèm nút "Dựng lại (giữ phân tích)".
// Nhờ cache Whisper + Claude, chạy lại cùng nguồn = bỏ qua gõ chữ + 0 token, chỉ render lại.
const LONG_FIELDS = ["long-paths", "l-aspect", "l-reframe", "l-smart", "l-fillers", "l-cut", "l-cap", "l-capstyle",
  "l-model", "l-maxmin", "l-ttop", "l-tbot", "l-broll", "l-brollfill", "l-thumb", "l-thumbdir", "l-thumbtitle",
  "l-thumbname", "l-color", "l-smooth", "l-voice", "l-film", "l-norm", "l-music", "l-mv", "l-trans", "l-intro", "l-outro",
  "l-mkcontent", "l-mklark", "l-note", "l-sharpen", "l-aitext", "l-review-first"];
const VOICE_FIELDS = ["voice-clips", "voice-preset", "voice-audio", "voice-vv", "voice-broll", "voice-brollfill",
  "voice-trans", "voice-color", "voice-smooth", "voice-cap", "voice-capstyle", "voice-film", "voice-prog",
  "voice-hook", "voice-music", "voice-mv", "voice-mkthumb", "voice-mkcontent", "voice-mklark", "voice-review-first"];
const AC_FIELDS = ["path-ac", "url-ac", "ac-broll", "ac-brollfill", "ac-cta", "ac-logo", "ac-music", "ac-mv",
  "ac-thumbbrand", "ac-thumbdir", "ac-thumbname", "ac-model", "ac-score", "ac-max", "ac-trans", "ac-reframe",
  "ac-smooth", "ac-voice", "ac-hook", "ac-film", "ac-prog", "ac-thumb", "ac-scoreclip", "ac-autolark",
  "ac-note", "ac-stickers", "ac-aitext", "ac-speed",
  "ac-lenmin", "ac-lenmax", "ac-prefer", "ac-review-first"];
function saveProject(key, ids) {
  const data = {};
  ids.forEach((id) => { const e = $("#" + id); if (e) data[id] = e.type === "checkbox" ? e.checked : e.value; });
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
function loadProject(key, ids, announce) {
  let data; try { data = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { data = null; }
  if (!data) { if (announce) alert("Chưa có project nào được lưu cho mục này."); return false; }
  ids.forEach((id) => {
    if (data[id] == null) return; const e = $("#" + id); if (!e) return;
    if (e.type === "checkbox") e.checked = data[id]; else e.value = data[id];
    e.dispatchEvent(new Event("input"));
  });
  if (announce) setLog(["📂 Đã mở lại project — chỉnh thiết lập rồi bấm Dựng lại (giữ phân tích, 0 token)."]);
  return true;
}
// Khôi phục project gần nhất khi mở app (sau khi preset mặc định đã chạy)
loadProject("vss-ac", AC_FIELDS);
loadProject("vss-long", LONG_FIELDS);
loadProject("vss-voice", VOICE_FIELDS);
offerRestoreSession();   // 💾 mời mở lại phiên kết quả gần nhất (nếu có)
// ---- DỰ ÁN LƯU RA FILE .vss.json (đặt tên, mở lại nhiều dự án, chuyển máy) ----
function collectFields(fields) {
  const data = {};
  fields.forEach((id) => { const e = $("#" + id); if (e) data[id] = e.type === "checkbox" ? e.checked : e.value; });
  return data;
}
function applyFields(fields, data) {
  fields.forEach((id) => {
    if (!data || data[id] == null) return; const e = $("#" + id); if (!e) return;
    if (e.type === "checkbox") e.checked = data[id]; else e.value = data[id];
    e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change"));
  });
}
async function fileSaveProject(mode, key, fields) {
  const def = (mode === "ac" ? "cat-tu-dong" : mode) + "-" + new Date().toISOString().slice(0, 10);
  const name = prompt("Đặt TÊN cho dự án (để mở lại sau):", def);
  if (!name || !name.trim()) return;
  saveProject(key, fields); // vẫn nhớ nhanh trong trình duyệt
  const r = await fetch("/api/project/save", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), mode, data: collectFields(fields) }),
  }).then((x) => x.json());
  if (r.error) return alert("Lưu lỗi: " + r.error);
  setLog(["💾 Đã lưu dự án ra file: " + r.path]);
  alert("Đã lưu dự án:\n" + r.path + "\n\n(Copy file .vss.json này sang máy khác để dùng lại.)");
}
async function loadProjectFile(pth, fields) {
  const d = await fetch("/api/project/get?path=" + encodeURIComponent(pth)).then((x) => x.json());
  if (d.error) return alert(d.error);
  applyFields(fields, d.data || {});
  setLog(["📂 Đã mở dự án: " + (d.name || pth) + " — chỉnh rồi bấm chạy."]);
}
async function fileOpenProject(mode, key, fields) {
  const r = await fetch("/api/project/list").then((x) => x.json()).catch(() => ({ items: [] }));
  const items = (r.items || []).filter((it) => it.mode === mode || mode === "*");
  openProjectModal(items, r.dir, fields, (pth) => loadProjectFile(pth, fields));
}
// Cửa sổ chọn dự án đã lưu (kèm nút mở file .vss.json từ nơi khác + xoá)
function openProjectModal(items, dir, fields, onPick) {
  let m = $("#projmodal");
  if (!m) {
    m = document.createElement("div"); m.id = "projmodal"; m.className = "vss-modal"; m.style.display = "none";
    m.innerHTML = '<div class="vss-modal-box"><div class="vss-modal-head"><b>📂 Mở dự án đã lưu</b><button id="pm-close">✕</button></div>'
      + '<div class="vss-crumb" id="pm-dir"></div><div class="vss-list" id="pm-list"></div>'
      + '<div class="vss-modal-foot"><span class="cur muted">Hoặc mở file .vss.json từ nơi khác →</span><button id="pm-file" class="dl">📁 Chọn file .vss.json</button></div></div>';
    document.body.appendChild(m);
    $("#pm-close").onclick = () => { m.style.display = "none"; };
    m.onclick = (e) => { if (e.target === m) m.style.display = "none"; };
  }
  $("#pm-dir").textContent = "Thư mục dự án: " + (dir || "");
  const list = $("#pm-list"); list.innerHTML = "";
  if (!items.length) list.innerHTML = '<div class="vss-empty">Chưa có dự án nào lưu cho mục này.<br>Bấm "💾 Lưu project" để tạo.</div>';
  items.forEach((it) => {
    const row = document.createElement("div"); row.className = "vss-item";
    row.innerHTML = '<span class="ic">📄</span><span style="flex:1"><b>' + it.name.replace(/</g, "&lt;")
      + '</b><br><span class="muted" style="font-size:11px">' + (it.savedAt || "").slice(0, 16).replace("T", " ") + '</span></span>'
      + '<button class="dl ghost pm-del" title="Xoá">🗑️</button>';
    row.querySelector("span:nth-child(2)").onclick = () => { m.style.display = "none"; onPick(it.path); };
    row.querySelector(".pm-del").onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm("Xoá dự án \"" + it.name + "\"?")) return;
      await fetch("/api/project/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: it.path }) });
      row.remove();
    };
    list.appendChild(row);
  });
  $("#pm-file").onclick = () => {
    m.style.display = "none";
    window.__vssOpenPicker && window.__vssOpenPicker("file", "vss.json,json", dir || "root", (pth) => onPick(pth));
  };
  m.style.display = "flex";
}
// Nút Lưu / Mở lại / Dựng lại cho mỗi mode (Lưu = ra FILE ổ cứng)
function wireProjectBtns(mode, key, fields, runFn) {
  const s = $("#" + mode + "-save"), o = $("#" + mode + "-open"), r = $("#" + mode + "-rerun");
  if (s) s.addEventListener("click", () => fileSaveProject(mode, key, fields));
  if (o) o.addEventListener("click", () => fileOpenProject(mode, key, fields));
  if (r) r.addEventListener("click", runFn);
}
wireProjectBtns("ac", "vss-ac", AC_FIELDS, () => $("#btn-ac").click());
wireProjectBtns("long", "vss-long", LONG_FIELDS, runLong);
wireProjectBtns("voice", "vss-voice", VOICE_FIELDS, runVoice);

// ================= UPLOAD nhạc/logo + thanh trượt =================
// Nút chọn file → upload lên server → điền đường dẫn vào ô tương ứng.
function wireUpload(fileInputId, targetInputId) {
  const fi = $("#" + fileInputId); const ti = $("#" + targetInputId);
  if (!fi || !ti) return;
  fi.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    ti.value = "Đang tải lên…";
    try { ti.value = await uploadFile(f); } catch (err) { ti.value = ""; alert(err.message); }
  });
}
wireUpload("file-music", "e-music");
wireUpload("file-logo", "e-logo");
wireUpload("file-acmusic", "ac-music");

// Nhãn thanh trượt cập nhật trực tiếp.
[["e-bri", "e-brival"], ["e-con", "e-conval"], ["e-sat", "e-satval"], ["e-war", "e-warval"], ["e-logosize", "e-logosizeval"], ["e-sharpen", "e-sharpval"], ["l-sharpen", "l-sharpval"]]
  .forEach(([sl, lb]) => { const s = $("#" + sl), l = $("#" + lb); if (s && l) s.addEventListener("input", () => { l.textContent = s.value; }); });

// ============ 📁 TRÌNH DUYỆT CHỌN THƯ MỤC / FILE TRÊN MÁY ============
// App chạy local nên server đọc được ổ đĩa → bấm "📁 Chọn" để duyệt, thay vì dán tay.
(function () {
  const modal = document.createElement("div");
  modal.className = "vss-modal"; modal.style.display = "none";
  modal.innerHTML =
    '<div class="vss-modal-box">' +
      '<div class="vss-modal-head"><b id="pk-title">Chọn</b><button id="pk-close" title="Đóng">✕</button></div>' +
      '<div class="vss-crumb" id="pk-crumb"></div>' +
      '<div class="vss-list" id="pk-list"></div>' +
      '<div class="vss-modal-foot"><span class="cur" id="pk-cur"></span>' +
        '<button id="pk-choose" class="go" style="margin-left:0">✔ Chọn thư mục này</button></div>' +
    '</div>';
  document.body.appendChild(modal);

  const el = (id) => document.getElementById(id);
  const listEl = el("pk-list"), crumbEl = el("pk-crumb"), curEl = el("pk-cur"),
        titleEl = el("pk-title"), chooseBtn = el("pk-choose");
  let state = { mode: "dir", ext: "", onPick: null, cur: "root" };
  let sep = "\\";

  function close() { modal.style.display = "none"; }
  el("pk-close").onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  chooseBtn.onclick = () => { if (state.cur && state.cur !== "root") pick(state.cur); };

  function join(dir, name) {
    if (dir.endsWith(sep) || dir.endsWith("/")) return dir + name;
    return dir + sep + name;
  }
  function pick(p) { if (state.onPick) state.onPick(p); close(); }
  function addItem(icon, label, onClick) {
    const d = document.createElement("div");
    d.className = "vss-item";
    d.innerHTML = '<span class="ic">' + icon + '</span><span>' + label.replace(/</g, "&lt;") + "</span>";
    d.onclick = onClick;
    listEl.appendChild(d);
  }
  function render(data) {
    state.cur = data.cwd; sep = data.sep || sep;
    crumbEl.textContent = data.cwd === "root" ? "🖥️ Máy tính — chọn ổ đĩa" : data.cwd;
    curEl.textContent = data.cwd === "root" ? "" : data.cwd;
    listEl.innerHTML = "";
    if (data.parent !== null && data.parent !== undefined) addItem("⬆️", ".. (lên trên)", () => load(data.parent));
    (data.drives || []).forEach((d) => addItem("💽", d, () => load(d)));
    (data.dirs || []).forEach((d) => addItem("📁", d, () => load(join(data.cwd, d))));
    (data.files || []).forEach((f) => addItem("📄", f, () => pick(join(data.cwd, f))));
    if (!listEl.children.length) listEl.innerHTML = '<div class="vss-empty">(thư mục trống)</div>';
    chooseBtn.style.display = (state.mode === "dir" && data.cwd !== "root") ? "" : "none";
  }
  function load(p) {
    fetch("/api/browse?path=" + encodeURIComponent(p || "root") + "&mode=" + state.mode + "&ext=" + encodeURIComponent(state.ext))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          if (/route/i.test(d.error)) {
            chooseBtn.style.display = "none";
            listEl.innerHTML = '<div class="vss-empty">⚠ Máy chủ đang chạy bản CŨ (chưa có duyệt thư mục).<br><br>Hãy đóng cửa sổ đen server cũ rồi chạy <b>RESTART.bat</b> (trong thư mục phần mềm) để nạp bản mới, sau đó thử lại.</div>';
            return;
          }
          if (p && p !== "root") return load("root");
          listEl.innerHTML = '<div class="vss-empty">' + d.error + "</div>"; return;
        }
        render(d);
      })
      .catch((e) => { listEl.innerHTML = '<div class="vss-empty">Lỗi: ' + e.message + "</div>"; });
  }
  function openPicker(mode, ext, start, onPick) {
    state = { mode, ext, onPick, cur: "root" };
    titleEl.textContent = mode === "dir" ? "📁 Chọn thư mục" : "📄 Chọn file";
    modal.style.display = "flex";
    load(start && start.trim() ? start.trim() : "root");
  }

  // Tự gắn nút "📁 Chọn" sau MỌI ô đường dẫn (input.pathbox), suy ra chế độ + loại file.
  function attach() {
    document.querySelectorAll("input.pathbox").forEach((inp) => {
      const id = inp.id || "";
      if (!id || /url/i.test(id) || inp.dataset.pick) return;
      inp.dataset.pick = "1";
      const isDir = /broll|sticker|folder|thumbdir|thumb-?dir|photodir|dir$/i.test(id);
      let ext = "";
      if (!isDir) {
        if (/music|nhac|voice|audio/i.test(id)) ext = "mp3,m4a,wav,aac,ogg,flac,opus";
        else if (/logo/i.test(id)) ext = "png,webp,jpg,jpeg";
        else if (/cta|intro|outro/i.test(id)) ext = "mp4,mov,mkv,webm";
        else ext = "mp4,mov,mkv,webm,avi,m4v";
      }
      const fire = (i) => { i.dispatchEvent(new Event("input")); i.dispatchEvent(new Event("change")); };
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "pickbtn";
      btn.textContent = isDir ? "📁 Chọn thư mục" : "📄 Chọn file";
      if (isDir) {
        // Thư mục: dùng trình duyệt thư mục của server (cần route /api/browse).
        btn.onclick = () => openPicker("dir", ext, inp.value, (pth) => { inp.value = pth; fire(inp); });
      } else {
        // File: dùng HỘP THOẠI GỐC của máy (có sẵn, không cần route) → upload → lấy đường dẫn.
        btn.onclick = () => {
          const fi = document.createElement("input");
          fi.type = "file"; fi.style.display = "none";
          if (ext) fi.accept = ext.split(",").map((e) => "." + e.trim()).join(",");
          document.body.appendChild(fi);
          fi.onchange = async () => {
            const f = fi.files[0];
            if (f) { const old = inp.value; inp.value = "Đang tải lên…"; try { inp.value = await uploadFile(f); fire(inp); } catch (e) { inp.value = old; alert(e.message); } }
            fi.remove();
          };
          fi.click();
        };
      }
      inp.insertAdjacentElement("afterend", btn);
    });
  }
  attach();
  // Gắn lại nếu có ô đường dẫn sinh động sau này.
  window.vssAttachPickers = attach;
  // Cho phần khác (mở dự án .vss.json từ nơi khác) dùng lại trình duyệt file.
  window.__vssOpenPicker = openPicker;
})();

// ================= ⚙️ TAB CẤU HÌNH (Kết nối Lark Base + Thương hiệu) =================
// Luồng của người dùng: dán link Base → 🔎 Dò bảng → chọn bảng → nạp cột → chọn cột → 💾 Lưu.
// Không ai phải mở code hay đi tìm base_token/field_id thủ công.
(function wireConfig() {
  const esc2 = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const probeStatus = $("#cfg-probe-status");
  if (!probeStatus) return; // bản không có tab Cấu hình → bỏ qua
  let PROBE = { baseToken: "", tableId: "", tables: [], fields: [] };

  // Đổ options vào 1 <select>. useName=true → value là TÊN cột (dùng khi tạo record);
  // false → value là FIELD ID (bắt buộc cho cột đính kèm vì tên cột có thể chứa "/").
  function fillFieldSelect(sel, fields, { useName = false, allowBlank = false, selected = "" } = {}) {
    if (!sel) return;
    const opts = [];
    if (allowBlank) opts.push('<option value="">— không dùng —</option>');
    for (const f of fields) {
      const val = useName ? (f.name || "") : (f.id || "");
      const lbl = esc2(f.name || f.id) + (f.type ? ` (${f.type})` : "");
      opts.push(`<option value="${esc2(val)}"${val === selected ? " selected" : ""}>${lbl}</option>`);
    }
    sel.innerHTML = opts.join("");
  }

  // Nạp danh sách cột của bảng đang chọn → đổ vào các ô map cột.
  async function loadFields(saved = {}) {
    const baseToken = PROBE.baseToken;
    const tableId = $("#cfg-table") ? $("#cfg-table").value : "";
    if (!baseToken || !tableId) return;
    probeStatus.textContent = "⏳ đang nạp cột…";
    try {
      const r = await fetch("/api/lark/probe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseToken, tableId }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "không đọc được cột");
      PROBE.fields = r.fields || [];
      if (!PROBE.fields.length) { probeStatus.textContent = "⚠ bảng không có cột (hoặc tài khoản thiếu quyền)"; return; }
      fillFieldSelect($("#cfg-f-attach"), PROBE.fields, { useName: false, selected: saved.attachField || "" });
      fillFieldSelect($("#cfg-f-thumb"), PROBE.fields, { useName: false, allowBlank: true, selected: saved.thumbField || "" });
      fillFieldSelect($("#cfg-f-content"), PROBE.fields, { useName: true, selected: saved.contentField || "" });
      fillFieldSelect($("#cfg-f-loai"), PROBE.fields, { useName: true, allowBlank: true, selected: saved.typeField || "" });
      fillFieldSelect($("#cfg-f-fanpage"), PROBE.fields, { useName: true, allowBlank: true, selected: saved.fanpageField || "" });
      $("#cfg-fields").style.display = "";
      probeStatus.textContent = `✅ ${PROBE.fields.length} cột — chọn cột rồi bấm Lưu`;
    } catch (e) { probeStatus.textContent = "⚠ " + e.message; }
  }

  // Dò bảng: dán link → liệt kê các bảng trong Base đó.
  async function probe(saved = {}) {
    const link = $("#cfg-lark-link").value.trim();
    if (!link) { probeStatus.textContent = "⚠ dán link Base trước"; return; }
    probeStatus.textContent = "⏳ đang dò bảng…";
    try {
      const r = await fetch("/api/lark/probe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseLink: link }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "không đọc được Base");
      PROBE.baseToken = r.baseToken; PROBE.tables = r.tables || [];
      const tsel = $("#cfg-table");
      tsel.innerHTML = PROBE.tables.map((t) =>
        `<option value="${esc2(t.id)}"${t.id === (saved.tableId || r.tableId) ? " selected" : ""}>${esc2(t.name)}</option>`).join("");
      $("#cfg-map").style.display = "";
      probeStatus.textContent = `✅ ${PROBE.tables.length} bảng — chọn bảng rồi nạp cột`;
      // Link đã kèm ?table= hoặc đã lưu bảng từ trước → nạp cột luôn cho nhanh.
      if (r.tableId || saved.tableId) { if (r.tableId) tsel.value = saved.tableId || r.tableId; await loadFields(saved); }
    } catch (e) { probeStatus.textContent = "⚠ " + e.message; }
  }

  if ($("#cfg-probe")) $("#cfg-probe").addEventListener("click", () => probe());
  if ($("#cfg-loadfields")) $("#cfg-loadfields").addEventListener("click", () => loadFields());
  if ($("#cfg-table")) $("#cfg-table").addEventListener("change", () => { $("#cfg-fields").style.display = "none"; });

  // Lưu kết nối Lark.
  if ($("#cfg-save-lark")) $("#cfg-save-lark").addEventListener("click", async () => {
    const st = $("#cfg-lark-savestatus");
    const attach = $("#cfg-f-attach") ? $("#cfg-f-attach").value : "";
    if (!PROBE.baseToken || !($("#cfg-table") && $("#cfg-table").value) || !attach) {
      st.textContent = "⚠ cần đủ 3 bước: dò bảng → chọn bảng → chọn cột đính kèm video"; return;
    }
    const lark = {
      baseToken: PROBE.baseToken,
      tableId: $("#cfg-table").value,
      attachField: attach,
      thumbField: $("#cfg-f-thumb").value || "",
      contentField: $("#cfg-f-content").value || "Nội dung",
      typeField: $("#cfg-f-loai").value || "",
      typeValue: $("#cfg-loai-value").value.trim() || "Video",
      fanpageField: $("#cfg-f-fanpage").value || "",
      fanpageRec: $("#cfg-fanpage-rec").value.trim() || "",
    };
    st.textContent = "⏳ đang lưu…";
    try {
      const r = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lark }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "lưu lỗi");
      st.textContent = "✅ Đã lưu — nút đăng Lark đã sẵn sàng dùng";
      refreshLarkState();
    } catch (e) { st.textContent = "⚠ " + e.message; }
  });

  // Lưu thương hiệu (áp ngay cho video/caption làm sau đó).
  if ($("#cfg-save-brand")) $("#cfg-save-brand").addEventListener("click", async () => {
    const st = $("#cfg-brand-savestatus");
    const brand = {
      name: $("#cfg-brand-name").value.trim(),
      niche: $("#cfg-brand-niche").value.trim(),
      color: $("#cfg-brand-color").value,
      hashtags: $("#cfg-brand-hashtags").value.trim(),
      thumbPhotoDir: $("#cfg-brand-thumbdir").value.trim(),
    };
    st.textContent = "⏳ đang lưu…";
    try {
      const r = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "lưu lỗi");
      st.textContent = "✅ Đã lưu — áp dụng ngay cho video/caption mới";
      if (VSS_CFG.brand) Object.assign(VSS_CFG.brand, brand);
      // Đồng bộ luôn các ô "tên hiển thị / thư mục ảnh" ở các tab làm video.
      ["ac-thumbname", "l-thumbname"].forEach((id) => { const e = $("#" + id); if (e && brand.name) e.value = brand.name; });
      ["ac-thumbdir", "l-thumbdir"].forEach((id) => { const e = $("#" + id); if (e) e.value = brand.thumbPhotoDir; });
    } catch (e) { st.textContent = "⚠ " + e.message; }
  });

  function refreshLarkState() {
    const el = $("#cfg-lark-state"); if (!el) return;
    fetch("/api/config").then((r) => r.json()).then((cfg) => {
      const s = (cfg && cfg.lark) || {};
      el.textContent = s.ready
        ? `✅ Đã kết nối (Base ${String(s.base).slice(0, 8)}… · bảng ${String(s.table).slice(0, 8)}…)`
        : "⛔ Chưa kết nối — dán link Base bên dưới để bật tính năng đăng Lark";
      el.style.color = s.ready ? "#1a7f37" : "";
    }).catch(() => { el.textContent = "?"; });
  }

  // Mở app → nạp cấu hình đã lưu vào form.
  fetch("/api/settings").then((r) => r.json()).then((s) => {
    const b = s.brand || {}, lk = s.lark || {};
    const setV = (id, v) => { const e = $("#" + id); if (e && v != null && v !== "") e.value = v; };
    setV("cfg-brand-name", b.name); setV("cfg-brand-niche", b.niche);
    setV("cfg-brand-hashtags", b.hashtags); setV("cfg-brand-thumbdir", b.thumbPhotoDir);
    if (b.color && $("#cfg-brand-color")) $("#cfg-brand-color").value = b.color;
    setV("cfg-loai-value", lk.typeValue); setV("cfg-fanpage-rec", lk.fanpageRec);
    // Đã cấu hình rồi → dựng lại link và tự dò để hiện lại đúng cột đã chọn.
    if (lk.baseToken) {
      $("#cfg-lark-link").value = "https://open.larksuite.com/base/" + lk.baseToken + (lk.tableId ? "?table=" + lk.tableId : "");
      probe(lk).catch(() => {});
    }
    refreshLarkState();
  }).catch(() => {});
})();
