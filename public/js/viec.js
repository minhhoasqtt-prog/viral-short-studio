// 📋 VIỆC GẦN ĐÂY — việc đang chạy, đang chờ, đã xong, lỗi, bị ngắt. Huỷ hoặc Chạy lại ngay tại đây.
(() => {
  const $v = (s) => document.getElementById(s);
  const KIND = { autoclip: "Cắt tự động", acplan: "Cắt tự động · phân tích", edit: "Tự biên tập", voiceshort: "Short lồng voice",
    longedit: "Video dài YouTube", eval: "Đánh giá", standard: "Chấm tiêu chuẩn", extract: "Bóc ý tưởng", reclip: "Dựng lại 1 short",
    doikhung: "Đổi khung", lark: "Đăng Lark", finalize: "Tải kèm logo/nhạc", batch: "Hàng loạt" };
  const STAT = { running: ["⚙️ Đang chạy", "run"], queued: ["⏳ Đang chờ", "wait"], done: ["✅ Xong", "ok"], error: ["❌ Lỗi", "bad"],
    cancelled: ["⛔ Đã huỷ", "off"], interrupted: ["⚠ Bị ngắt", "bad"] };
  const t = (ms) => (ms ? new Date(ms).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "");
  const dur = (a, b) => { if (!a) return ""; const s = Math.round(((b || Date.now()) - a) / 1000); return s < 60 ? s + "s" : Math.round(s / 60) + " phút"; };
  let timer = null;

  async function load() {
    let d; try { d = await (await fetch("/api/jobs")).json(); } catch { return; }
    const items = d.items || [];
    const run = items.filter((j) => j.status === "running").length, wait = items.filter((j) => j.status === "queued").length;
    $v("viec-sum").textContent = `${run} đang chạy · ${wait} đang chờ · ${items.length} việc trong 7 ngày`;
    $v("viec-out").innerHTML = !items.length ? `<div class="muted" style="padding:20px">Chưa có việc nào.</div>` : `
      <table class="viec-tbl"><thead><tr><th>Lúc</th><th>Việc</th><th>Trạng thái</th><th>Tiến độ</th><th>Thời gian</th><th></th></tr></thead><tbody>
      ${items.map((j) => { const [lab, cls] = STAT[j.status] || [j.status, "off"]; return `<tr>
        <td>${t(j.createdAt)}</td><td>${KIND[j.kind] || j.kind}</td>
        <td><span class="st st-${cls}">${lab}</span>${j.status === "queued" && j.queuePos ? ` <span class="muted">thứ ${j.queuePos}</span>` : ""}${j.error && j.status !== "cancelled" ? `<div class="viec-err">${esc(String(j.error).slice(0, 220))}</div>` : ""}</td>
        <td>${j.progress ? `<div class="mini-bar"><i style="width:${j.status === "done" ? 100 : j.progress.pct}%"></i></div><span class="muted">${j.status === "done" ? 100 : j.progress.pct}%${j.progress.etaSec != null && j.status === "running" ? " · còn ~" + fmtEta(j.progress.etaSec) : ""}</span>` : ""}</td>
        <td class="muted">${dur(j.runAt, j.doneAt)}</td>
        <td>${["running", "queued"].includes(j.status) ? `<button class="dl vj" data-a="cancel" data-id="${j.id}" type="button">⛔ Huỷ</button>` : ""}
            ${["error", "interrupted", "cancelled"].includes(j.status) && j.route ? `<button class="dl vj" data-a="rerun" data-id="${j.id}" type="button">↻ Chạy lại</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table>`;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".vj");
    if (b) {
      if (b.dataset.a === "cancel" && !confirm("Huỷ việc này?")) return;
      b.disabled = true;
      const r = await fetch(`/api/job/${b.dataset.id}/${b.dataset.a}`, { method: "POST" }).then((x) => x.json()).catch((er) => ({ error: er.message }));
      if (r.error) alert(r.error);
      load();
    }
    const tab = e.target.closest(".tab");
    if (tab) {
      clearInterval(timer);
      if (tab.dataset.tab === "viec") { load(); timer = setInterval(load, 3000); }
    }
  });
  if ($v("viec-reload")) $v("viec-reload").addEventListener("click", load);
})();
