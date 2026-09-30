// Viral Short Studio — Các tab: Đánh giá, Tự biên tập, Bóc ý tưởng, Hàng loạt, Video dài, Short lồng voice.
// (Tách từ app.js; các tệp js/*.js dùng chung biến toàn cục, nạp đúng thứ tự trong index.html.)
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
      <a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(out)}" download>⬇ Tải video</a><div class="kh-mount" data-path="${esc(out)}"></div>
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
    reframe: $("#voice-reframe") ? $("#voice-reframe").value : "fill",
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
