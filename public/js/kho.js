// 🗂️ KHO VIDEO — mọi video đã xuất, mới nhất trước. Lọc theo tên / khung / ngày / "cần xem lại".
// Mỗi thẻ: xem, tải, đổi khung (nếu video có lớp đổi khung).
(() => {
  const $k = (s) => document.getElementById(s);
  let ITEMS = [];
  const fmtDate = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const khungName = (v) => { if (!v) return "—"; const f = (window.KHUNG_OPTS_LIST || KHUNG_OPTS).find(([x]) => x === v); return f ? f[1] : v; };

  function render() {
    const q = ($k("kho-q").value || "").trim().toLowerCase();
    const kh = $k("kho-khung").value, days = +$k("kho-ngay").value, low = $k("kho-low").checked;
    const cut = days ? Date.now() - days * 86400e3 : 0;
    const list = ITEMS.filter((it) => (!q || (it.title + " " + it.name).toLowerCase().includes(q))
      && (!kh || it.reframe === kh) && (!cut || it.mtime >= cut) && (!low || it.low));
    $k("kho-count").textContent = `${list.length} / ${ITEMS.length} video`;
    const shown = list.slice(0, 150);
    $k("kho-out").innerHTML = !shown.length ? `<div class="muted" style="padding:20px">Không có video nào khớp bộ lọc.</div>` :
      `<div class="clip-grid">${shown.map((it) => `
        <div class="clip-card kho-card${it.low ? " is-low" : ""}">
          <div class="clip-vwrap"><video data-src="/api/file?path=${encodeURIComponent(it.path)}#t=0.5" controls preload="none"></video></div>
          <div class="clip-body">
            <div class="clip-top">
              ${it.score != null ? `<span class="clip-score">📝 ${it.score}</span>` : ""}
              ${it.techScore != null ? `<span class="clip-score tech">🔧 ${it.techScore}</span>` : ""}
              ${it.low ? `<span class="clip-flag" title="Điểm kỹ thuật dưới ngưỡng">⚠ xem lại</span>` : ""}
              <span class="clip-dur">${fmtDate(it.mtime)}</span>
            </div>
            <div class="clip-title" title="${esc(it.title)}">${esc(it.title)}</div>
            <div class="kho-meta muted">Khung: ${esc(khungName(it.reframe))} · ${(it.size / 1048576).toFixed(0)} MB</div>
            <div class="clip-dls"><a class="dl" href="/api/file?dl=1&path=${encodeURIComponent(it.path)}" download>⬇ Tải</a><button class="dl ghost kho-copy" data-p="${esc(it.path)}" type="button" title="Chép đường dẫn tệp">📋 Đường dẫn</button></div>
            ${it.hasLayer ? `<div class="kh-mount" data-path="${esc(it.path)}"></div>` : `<div class="muted kho-old">Video dựng trước 29/09: chưa đổi khung nhanh được.</div>`}
          </div>
        </div>`).join("")}</div>${list.length > shown.length ? `<div class="muted" style="margin-top:10px">Đang hiện 150 video mới nhất, lọc thêm để xem video cũ hơn.</div>` : ""}`;
    // Chỉ nạp video khi cuộn tới (kho có thể hàng trăm video trên ổ mạng).
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { const v = en.target; v.preload = "metadata"; v.src = v.dataset.src; io.unobserve(v); } }), { rootMargin: "300px" });
    document.querySelectorAll("#kho-out video[data-src]").forEach((v) => io.observe(v));
  }
  async function load() {
    $k("kho-count").textContent = "đang tải…";
    try { ITEMS = (await (await fetch("/api/kho")).json()).items || []; } catch { ITEMS = []; }
    render();
  }
  ["kho-q", "kho-khung", "kho-ngay", "kho-low"].forEach((id) => { const el = $k(id); if (el) el.addEventListener(id === "kho-q" ? "input" : "change", render); });
  if ($k("kho-reload")) $k("kho-reload").addEventListener("click", load);
  document.addEventListener("click", (e) => {
    const c = e.target.closest(".kho-copy");
    if (c) { navigator.clipboard.writeText(c.dataset.p).then(() => { c.textContent = "✅ Đã chép"; setTimeout(() => (c.textContent = "📋 Đường dẫn"), 1500); }); }
    const t = e.target.closest('.tab[data-tab="kho"]');
    if (t) load();
  });
})();
