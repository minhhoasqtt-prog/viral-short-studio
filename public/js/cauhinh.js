// 🛠️ CẤU HÌNH — thương hiệu + kết nối Lark Base (lưu settings.local.json, áp ngay).
// Chỉ nạp/dò khi mở tab Cấu hình (dò Base gọi lark-cli, không làm chậm lúc mở phần mềm).
(() => {
  const $c = (s) => document.getElementById(s);
  if (!$c("cfg-probe")) return;
  let PROBE = { baseToken: "", tables: [], fields: [] };
  let loaded = false;
  const st = (id, t) => { const e = $c(id); if (e) e.textContent = t; };

  function fillSel(sel, fields, { useName = false, allowBlank = false, selected = "" } = {}) {
    const opts = allowBlank ? ['<option value="">— không dùng —</option>'] : [];
    for (const f of fields) {
      const val = useName ? (f.name || "") : (f.id || "");
      opts.push(`<option value="${esc(val)}"${val === selected ? " selected" : ""}>${esc(f.name || f.id)}${f.type ? ` (${f.type})` : ""}</option>`);
    }
    $c(sel).innerHTML = opts.join("");
  }
  async function loadFields(saved = {}) {
    const tableId = $c("cfg-table").value;
    if (!PROBE.baseToken || !tableId) return;
    st("cfg-probe-status", "⏳ đang nạp cột…");
    try {
      const r = await fetch("/api/lark/probe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseToken: PROBE.baseToken, tableId }) }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "không đọc được cột");
      PROBE.fields = r.fields || [];
      fillSel("cfg-f-attach", PROBE.fields, { selected: saved.attachField || "" });
      fillSel("cfg-f-thumb", PROBE.fields, { allowBlank: true, selected: saved.thumbField || "" });
      fillSel("cfg-f-content", PROBE.fields, { useName: true, selected: saved.contentField || "" });
      fillSel("cfg-f-loai", PROBE.fields, { useName: true, allowBlank: true, selected: saved.typeField || "" });
      fillSel("cfg-f-fanpage", PROBE.fields, { useName: true, allowBlank: true, selected: saved.fanpageField || "" });
      $c("cfg-fields").style.display = "";
      st("cfg-probe-status", `✅ ${PROBE.fields.length} cột`);
    } catch (e) { st("cfg-probe-status", "⚠ " + e.message); }
  }
  async function probe(saved = {}) {
    const link = $c("cfg-lark-link").value.trim();
    if (!link) return st("cfg-probe-status", "⚠ dán link Base trước");
    st("cfg-probe-status", "⏳ đang dò bảng…");
    try {
      const r = await fetch("/api/lark/probe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseLink: link }) }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "không đọc được Base");
      PROBE.baseToken = r.baseToken; PROBE.tables = r.tables || [];
      $c("cfg-table").innerHTML = PROBE.tables.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
      if (saved.tableId || r.tableId) $c("cfg-table").value = saved.tableId || r.tableId;
      $c("cfg-map").style.display = "";
      st("cfg-probe-status", `✅ ${PROBE.tables.length} bảng`);
      if (saved.tableId || r.tableId) await loadFields(saved);
    } catch (e) { st("cfg-probe-status", "⚠ " + e.message); }
  }
  async function refreshState() {
    try {
      const s = (await (await fetch("/api/config")).json()).lark || {};
      st("cfg-lark-state", s.ready ? `✅ Đã kết nối (Base ${String(s.base).slice(0, 8)}… · bảng ${String(s.table).slice(0, 8)}…)` : "⛔ Chưa kết nối");
    } catch { st("cfg-lark-state", "?"); }
  }
  async function load() {
    const s = await (await fetch("/api/settings")).json();
    const b = s.brand || {}, lk = s.lark || {};
    const setV = (id, v) => { if (v != null && v !== "") $c(id).value = v; };
    setV("cfg-brand-name", b.name); setV("cfg-brand-role", b.role); setV("cfg-brand-niche", b.niche);
    setV("cfg-brand-hashtags", b.hashtags); setV("cfg-brand-thumbdir", b.thumbPhotoDir); if (b.color) $c("cfg-brand-color").value = b.color;
    setV("cfg-loai-value", lk.typeValue); setV("cfg-fanpage-rec", lk.fanpageRec);
    refreshState();
    if (lk.baseToken) { $c("cfg-lark-link").value = `https://open.larksuite.com/base/${lk.baseToken}${lk.tableId ? "?table=" + lk.tableId : ""}`; probe(lk); }
  }
  $c("cfg-probe").onclick = () => probe();
  $c("cfg-loadfields").onclick = () => loadFields();
  $c("cfg-table").onchange = () => { $c("cfg-fields").style.display = "none"; };
  $c("cfg-save-lark").onclick = async () => {
    const attach = $c("cfg-f-attach").value;
    if (!PROBE.baseToken || !$c("cfg-table").value || !attach) return st("cfg-lark-savestatus", "⚠ cần đủ: dò bảng → chọn bảng → chọn cột video");
    const lark = { baseToken: PROBE.baseToken, tableId: $c("cfg-table").value, attachField: attach, thumbField: $c("cfg-f-thumb").value || "",
      contentField: $c("cfg-f-content").value || "Nội dung", typeField: $c("cfg-f-loai").value || "", typeValue: $c("cfg-loai-value").value.trim() || "Video",
      fanpageField: $c("cfg-f-fanpage").value || "", fanpageRec: $c("cfg-fanpage-rec").value.trim() || "" };
    const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lark }) }).then((x) => x.json());
    st("cfg-lark-savestatus", r.ok ? "✅ Đã lưu" : "⚠ " + (r.error || "lưu lỗi"));
    refreshState();
  };
  $c("cfg-save-brand").onclick = async () => {
    const brand = { name: $c("cfg-brand-name").value.trim(), role: $c("cfg-brand-role").value.trim(), niche: $c("cfg-brand-niche").value.trim(),
      color: $c("cfg-brand-color").value, hashtags: $c("cfg-brand-hashtags").value.trim(), thumbPhotoDir: $c("cfg-brand-thumbdir").value.trim() };
    const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand }) }).then((x) => x.json());
    st("cfg-brand-savestatus", r.ok ? "✅ Đã lưu, áp dụng ngay cho video mới" : "⚠ " + (r.error || "lưu lỗi"));
    ["ac-thumbname", "l-thumbname"].forEach((id) => { const e = $c(id); if (e && brand.name) e.value = brand.name; });
    ["ac-thumbdir", "l-thumbdir"].forEach((id) => { const e = $c(id); if (e) e.value = brand.thumbPhotoDir; });
  };
  document.addEventListener("click", (e) => { if (e.target.closest('.tab[data-tab="config"]') && !loaded) { loaded = true; load().catch(() => {}); } });
})();
