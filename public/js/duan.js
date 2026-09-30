// Viral Short Studio — Dự án (.vss.json), tải nhạc/logo, trình chọn thư mục/tệp.
// (Tách từ app.js; các tệp js/*.js dùng chung biến toàn cục, nạp đúng thứ tự trong index.html.)
// ================= 💾 LƯU / MỞ LẠI PROJECT (2 mode mới) =================
// Nhớ thiết lập + đường dẫn input để chỉnh lại KHÔNG phải nhập lại; kèm nút "Dựng lại (giữ phân tích)".
// Nhờ cache Whisper + Claude, chạy lại cùng nguồn = bỏ qua gõ chữ + 0 token, chỉ render lại.
const LONG_FIELDS = ["long-paths", "l-aspect", "l-reframe", "l-smart", "l-fillers", "l-cut", "l-cap", "l-capstyle",
  "l-model", "l-maxmin", "l-ttop", "l-tbot", "l-broll", "l-brollfill", "l-thumb", "l-thumbdir", "l-thumbtitle",
  "l-thumbname", "l-color", "l-smooth", "l-voice", "l-film", "l-norm", "l-music", "l-mv", "l-trans", "l-intro", "l-outro",
  "l-mkcontent", "l-mklark", "l-note", "l-sharpen", "l-aitext", "l-review-first"];
const VOICE_FIELDS = ["voice-clips", "voice-preset", "voice-audio", "voice-vv", "voice-broll", "voice-brollfill",
  "voice-trans", "voice-reframe", "voice-color", "voice-smooth", "voice-cap", "voice-capstyle", "voice-film", "voice-prog",
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
      if (/(max|count|name|title|ttop|tbot|hook|maxmin)$/i.test(id)) return;   // ô số / chữ, không phải tệp
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
// (Tab Cấu hình: xem js/cauhinh.js)
