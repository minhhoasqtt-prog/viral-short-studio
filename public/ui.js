// Viral Short Studio — lớp giao diện (chạy SAU app.js, không đụng logic xử lý).
// 1) Tiêu đề trang theo tab  2) Chế độ Nhanh / Nâng cao  3) Cỡ thẻ video kết quả  4) Thu gọn bảng tiến độ.
// (Ô chọn khung bằng ảnh nằm ở js/khung.js.)
(() => {
  const $$ = (s, r = document) => r.querySelectorAll(s);

  // 1) Tiêu đề trang
  const setTitle = (btn) => {
    if (!btn) return;
    const t = document.getElementById("page-title"), d = document.getElementById("page-desc");
    if (t) t.textContent = btn.dataset.title || btn.textContent.trim();
    if (d) d.textContent = btn.dataset.desc || "";
  };
  $$(".tab").forEach((b) => b.addEventListener("click", () => setTitle(b)));
  $$(".wiz-b").forEach((b) => b.addEventListener("click", () => setTitle(document.querySelector(`.tab[data-tab="${b.dataset.go}"]`))));
  setTitle(document.querySelector(".tab.active"));

  // 2) Chế độ NHANH: chỉ giữ ô nguồn video + mục đích + khung + ghi chú + nút chạy. Còn lại gập vào Nâng cao.
  const KEEP = {
    "tab-autoclip": (g) => g.querySelector("#dz-ac, input[name='ac-mode']"),
    "tab-edit": () => false,
  };
  $$(".modebar").forEach((mb) => {
    const panel = document.getElementById(mb.dataset.for);
    if (!panel) return;
    const keep = KEEP[panel.id] || (() => false);
    $$(".optgroup", panel).forEach((g) => { if (!keep(g)) g.classList.add("adv"); });
    $$(".opts", panel).forEach((o) => { if ([...o.children].every((c) => c.classList.contains("adv"))) o.classList.add("adv"); });
    $$(".hero-note", panel).forEach((h) => h.classList.add("adv"));
    ["#btn-ac-review", "#ac-save", "#ac-open", "#ac-rerun"].forEach((s) => { const b = panel.querySelector(s); if (b) b.classList.add("adv"); });
    const key = "vss-mode-" + panel.id;
    const apply = (m) => {
      panel.classList.toggle("simple", m === "simple");
      $$("button", mb).forEach((b) => b.classList.toggle("on", b.dataset.m === m));
      try { localStorage.setItem(key, m); } catch { /* bỏ */ }
    };
    $$("button", mb).forEach((b) => b.addEventListener("click", () => apply(b.dataset.m)));
    let m = "simple"; try { m = localStorage.getItem(key) || "simple"; } catch { /* bỏ */ }
    apply(m);
  });

  // 3) Cỡ thẻ video kết quả (nhỏ = nhiều video trên một màn hình). Nhớ lựa chọn.
  const SIZES = { S: 150, M: 190, L: 250 };
  const bar = document.querySelector(".topbar");
  if (bar) {
    const box = document.createElement("div");
    box.className = "density";
    box.innerHTML = `<span>Cỡ video</span>` + Object.keys(SIZES).map((k) => `<button type="button" data-k="${k}">${k}</button>`).join("");
    bar.appendChild(box);
    const apply = (k) => {
      document.documentElement.style.setProperty("--cw", SIZES[k] + "px");
      $$("button", box).forEach((b) => b.classList.toggle("on", b.dataset.k === k));
      try { localStorage.setItem("vss-density", k); } catch { /* bỏ */ }
    };
    $$("button", box).forEach((b) => b.addEventListener("click", () => apply(b.dataset.k)));
    let k = "M"; try { k = localStorage.getItem("vss-density") || "M"; } catch { /* bỏ */ }
    apply(SIZES[k] ? k : "M");
  }

  // 4) Thu gọn bảng tiến độ (việc vẫn chạy; xem lại ở "Việc gần đây").
  const lc = document.getElementById("logclose");
  if (lc) lc.addEventListener("click", () => { document.getElementById("logbox").hidden = true; });
})();
