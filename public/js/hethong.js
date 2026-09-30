// ⚙️ HỆ THỐNG — máy đủ đồ nghề chưa (đỏ đúng mục thiếu + cách sửa), bật/tắt báo Lark khi xong, lỗi 7 ngày.
(() => {
  const $h = (s) => document.getElementById(s);
  async function ready() {
    $h("ht-ready").innerHTML = "Đang kiểm tra máy (vài giây)…";
    let d; try { d = await (await fetch("/api/readiness")).json(); } catch (e) { $h("ht-ready").textContent = "Không kiểm được: " + e.message; return; }
    $h("ht-ready").innerHTML = `<div class="ready-sum ${d.ok ? "ok" : "bad"}">${d.ok ? "✅ Máy đã sẵn sàng" : "❌ Máy còn thiếu, xem mục đỏ"}</div>
      <ul class="ready-list">${d.items.map((i) => `<li class="${i.ok ? "ok" : i.optional ? "warn" : "bad"}"><b>${i.ok ? "✅" : i.optional ? "⚠" : "❌"} ${i.name}</b><span>${esc(i.info || "")}</span>${i.ok ? "" : `<em>Cách sửa: ${esc(i.fix)}</em>`}</li>`).join("")}</ul>
      <button class="dl" id="ht-recheck" type="button">↻ Kiểm lại</button>`;
    $h("ht-recheck").onclick = ready;
  }
  async function notify() {
    let p = {}, cfg = {}; try { p = await (await fetch("/api/prefs")).json(); cfg = await (await fetch("/api/settings")).json(); } catch { /* bỏ */ }
    const chat = (cfg.notify || {}).chatId || "";
    $h("ht-notify").innerHTML = `<label><input type="checkbox" id="ht-lark"${p.notifyLark ? " checked" : ""}> Gửi tin vào nhóm Lark khi một việc xong hoặc lỗi</label>
      <label style="margin-top:6px">Mã nhóm nhận tin (chat_id, dạng oc_…): <input class="khobox" id="ht-chat" value="${esc(chat)}" placeholder="oc_xxxxxxxx"> <button class="dl" id="ht-chat-save" type="button">Lưu</button></label>
      <button class="dl" id="ht-lark-test" type="button">Gửi thử 1 tin</button> <span class="muted" id="ht-lark-st"></span>`;
    $h("ht-lark").onchange = async (e) => { await fetch("/api/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifyLark: e.target.checked }) }); $h("ht-lark-st").textContent = e.target.checked ? "Đã bật" : "Đã tắt"; };
    $h("ht-chat-save").onclick = async () => { await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notify: { chatId: $h("ht-chat").value } }) }); $h("ht-lark-st").textContent = "Đã lưu mã nhóm"; };
    $h("ht-lark-test").onclick = async () => { $h("ht-lark-st").textContent = "Đang gửi…"; const r = await fetch("/api/prefs/test-lark", { method: "POST" }).then((x) => x.json()); $h("ht-lark-st").textContent = r.ok ? "✅ Đã gửi, xem nhóm TÔM" : "❌ " + r.error; };
  }
  async function loi() {
    let d; try { d = await (await fetch("/api/loi?days=7")).json(); } catch { return; }
    $h("ht-loi").innerHTML = !d.total ? "✅ Không có lỗi nào trong 7 ngày." :
      `<div><b>${d.total}</b> lần lỗi, gom thành ${d.groups.length} loại:</div><ul class="loi-list">${d.groups.map((g) => `<li><b>${g.count}×</b> ${esc(g.key)} <span class="muted">(gần nhất ${new Date(g.last).toLocaleString("vi-VN")})</span></li>`).join("")}</ul>`;
  }
  document.addEventListener("click", (e) => { const t = e.target.closest('.tab[data-tab="hethong"]'); if (t) { ready(); notify(); loi(); } });
})();
