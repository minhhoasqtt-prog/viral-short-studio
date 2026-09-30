// 🖼️ KHUNG THƯƠNG HIỆU — đọc danh sách khung từ máy chủ (assets/frames), dựng ô chọn bằng ảnh,
// và gắn widget "Đổi khung" cho mọi video có lớp đổi khung (Tự biên tập, Kho video...).
// Thêm chương trình mới = thêm thư mục assets/frames/<tên>, tải lại trang là có, không sửa mã.
(() => {
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const BASE = [["blur", "Nền mờ (không khung)", "/frames/blur.jpg"], ["fill", "Cắt đầy 9:16", "/frames/fill.jpg"]];
  let FRAMES = [];

  function buildPickers() {
    qa(".framepick").forEach((fp) => {
      const sel = document.getElementById(fp.dataset.for);
      const grid = fp.querySelector(".fp-grid");
      if (!sel || !grid) return;
      const base = fp.dataset.base ? BASE.filter(([v]) => fp.dataset.base.split(",").includes(v)) : BASE;
      const opts = [...FRAMES.map((f) => [`frame:${f.id}`, f.name.replace(/^Khung\s+/i, ""), f.preview]), ...base];
      grid.innerHTML = opts.map(([v, t, img]) => `<button type="button" class="fp-opt" data-v="${v}"><img src="${img}" alt="" loading="lazy"><span>${t}</span></button>`).join("");
      const cur = sel.value;
      const extra = [...sel.options].filter((o) => !o.value.startsWith("frame:") && !["blur", "fill"].includes(o.value));
      sel.innerHTML = opts.map(([v, t]) => `<option value="${v}">${v.startsWith("frame:") ? "🖼️ Khung " + t : t}</option>`).join("") + extra.map((o) => o.outerHTML).join("");
      sel.value = [...sel.options].some((o) => o.value === cur) ? cur : base[0][0];
      sync(fp);
    });
    const kf = document.getElementById("kho-khung");
    if (kf) kf.innerHTML = `<option value="">Mọi khung</option>` + [...FRAMES.map((f) => [`frame:${f.id}`, f.name]), ["blur", "Nền mờ"], ["fill", "Cắt đầy"]].map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
  }
  function sync(fp) {
    const sel = document.getElementById(fp.dataset.for);
    if (sel) qa(".fp-opt", fp).forEach((o) => o.classList.toggle("on", o.dataset.v === sel.value));
  }
  // Bấm ảnh → đổi <select> gốc (app.js đọc/lưu/khôi phục <select> đó).
  document.addEventListener("click", (e) => {
    const o = e.target.closest(".fp-opt");
    if (!o) return;
    const fp = o.closest(".framepick");
    const sel = document.getElementById(fp.dataset.for);
    sel.value = o.dataset.v;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    sync(fp);
  });
  document.addEventListener("change", (e) => { const fp = e.target.closest && e.target.closest(".framepick"); if (fp) sync(fp); });
  setInterval(() => qa(".framepick").forEach(sync), 1500);   // khôi phục project gán value không bắn change

  // Widget Đổi khung dùng chung: <div class="kh-mount" data-path="..."> → ô chọn + nút.
  window.mountDoiKhung = function (el, onNew) {
    if (el.dataset.wired) return;
    el.dataset.wired = "1";
    el.classList.add("clip-khung-w");
    el.innerHTML = `<div class="clip-khung"><select>${(window.KHUNG_OPTS_LIST || KHUNG_OPTS).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select><button type="button" class="dl kh-btn2">🖼️ Đổi khung</button></div><div class="kh-status muted"></div>`;
    const btn = el.querySelector("button"), st = el.querySelector(".kh-status");
    btn.onclick = async () => {
      btn.disabled = true; st.textContent = "⏳ Đang đổi khung…";
      try {
        const r = await fetch("/api/doi-khung", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: el.dataset.path, reframe: el.querySelector("select").value }) }).then((x) => x.json());
        if (r.noLayer) throw new Error("Video này dựng trước khi có tính năng Đổi khung. Dựng lại 1 lần là đổi được.");
        if (r.error) throw new Error(r.error);
        await new Promise((res, rej) => pollJob(r.jobId, (j) => (j.status === "error" ? rej(new Error(j.error)) : res(j))))
          .then((j) => {
            const out = j.result.outPath;
            el.dataset.path = out;
            const box = el.closest(".result-video, .clip-card");
            if (box) {
              const v = box.querySelector("video"); if (v) { v.src = "/api/file?path=" + encodeURIComponent(out) + "&t=" + Date.now() + "#t=0.5"; v.load(); }
              box.querySelectorAll("a[download]").forEach((a) => { a.href = "/api/file?dl=1&path=" + encodeURIComponent(out); });
            }
            if (onNew) onNew(out);
          });
        st.textContent = "✅ Đã đổi khung";
      } catch (err) { st.textContent = "❌ " + err.message; }
      finally { btn.disabled = false; }
    };
  };
  new MutationObserver(() => qa(".kh-mount:not([data-wired])").forEach((el) => window.mountDoiKhung(el))).observe(document.body, { childList: true, subtree: true });

  fetch("/api/frames").then((r) => r.json()).then((d) => {
    FRAMES = d.items || [];
    KHUNG_OPTS = [...FRAMES.map((f) => [`frame:${f.id}`, f.name.replace(/^Khung\s+/i, "")]), ["blur", "Nền mờ"], ["fill", "Cắt đầy"]];
    window.KHUNG_OPTS_LIST = KHUNG_OPTS;
    buildPickers();
  }).catch(() => qa(".framepick").forEach(sync));
})();
