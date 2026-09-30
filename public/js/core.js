// Viral Short Studio — Lõi: tab, cấu hình, font, log, tải tệp, theo dõi việc, hàng đợi nhiều video.
// (Tách từ app.js; các tệp js/*.js dùng chung biến toàn cục, nạp đúng thứ tự trong index.html.)
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
  $("#logtoggle").textContent = logEl.hidden ? "Xem chi tiết" : "Ẩn chi tiết";
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
// Theo dõi 1 việc: tiến độ %, còn bao lâu, đang chờ tới lượt, Huỷ. Việc bị huỷ / bị ngắt / mất
// đều chuyển thành "error" có lý do rõ ràng → mọi chỗ gọi (chỉ kiểm status==="error") không bị treo.
// onTick (tuỳ chọn): gọi mỗi nhịp — bảng hàng đợi nhiều video cập nhật từng dòng.
let _curJobId = null;
const fmtEta = (s) => (s == null ? "" : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} phút` : `${(s / 3600).toFixed(1)} giờ`);
function renderJobState(j) {
  const st = $("#logstatus"), fill = $("#jobfill"), cb = $("#jobcancel");
  const pct = j.progress ? j.progress.pct : 0;
  if (fill) fill.style.width = (j.status === "done" ? 100 : pct) + "%";
  if (cb) cb.hidden = !["running", "queued"].includes(j.status);
  if (!st) return;
  if (j.status === "queued") st.textContent = `⏳ Đang chờ tới lượt${j.queuePos ? ` (thứ ${j.queuePos})` : ""}…`;
  else if (j.status === "running") st.textContent = `⚙️ ${pct}%${j.progress && j.progress.label ? " · " + j.progress.label : ""}${j.progress && j.progress.etaSec != null ? " · còn khoảng " + fmtEta(j.progress.etaSec) : ""}`;
  else if (j.status === "done") st.textContent = "✅ Hoàn tất";
  else if (j.status === "cancelled") st.textContent = "⛔ Đã huỷ";
  else st.textContent = "❌ " + (j.error || "Lỗi");
}
async function pollJob(jobId, onDone, onTick) {
  _curJobId = jobId;
  showLog("Đang gửi việc…");
  const fill = $("#jobfill"); if (fill) fill.style.width = "0%";
  const timer = setInterval(async () => {
    let j;
    try { j = await (await fetch("/api/job/" + jobId)).json(); } catch (e) { return; }  // mạng chập chờn → giữ vòng lặp
    if (!j || j.status === "missing" || !j.status) j = { status: "error", error: (j && j.error) || "Mất liên lạc với việc này (phần mềm vừa khởi động lại?)." };
    if (j.log) setLog(j.log);
    renderJobState(j);
    if (onTick) { try { onTick(j); } catch (e) { /* không chặn vòng lặp */ } }
    if (j.status !== "running" && j.status !== "queued") {
      clearInterval(timer);
      if (_curJobId === jobId) _curJobId = null;
      if (j.status !== "done") j = { ...j, status: "error", error: j.error || "Việc không hoàn tất." };
      onDone(j);
    }
  }, 1200);
}
if ($("#jobcancel")) $("#jobcancel").addEventListener("click", async () => {
  if (!_curJobId || !confirm("Huỷ việc đang chạy?")) return;
  await fetch("/api/job/" + _curJobId + "/cancel", { method: "POST" });
});

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
  if (j.status === "running") return (runningTxt || "⏳ Đang xử lý…") + (j.progress ? ` ${j.progress.pct}%` : "");
  if (j.status === "done") return "✅ Xong";
  return "❌ Lỗi";
}

// Nút chọn file → upload lên server → điền đường dẫn vào ô tương ứng (dùng ở nhiều tab khi nạp).
function wireUpload(fileInputId, targetInputId) {
  const fi = $("#" + fileInputId); const ti = $("#" + targetInputId);
  if (!fi || !ti) return;
  fi.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    ti.value = "Đang tải lên…";
    try { ti.value = await uploadFile(f); } catch (err) { ti.value = ""; alert(err.message); }
  });
}
