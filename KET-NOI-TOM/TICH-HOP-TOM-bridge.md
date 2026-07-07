# 🌉 Tích hợp cầu nối TÔM — gửi video là tự vào thư mục đầu vào

Phần này dành cho ai đã có **cầu nối TÔM** (bridge Lark ↔ trợ lý AI). Mục tiêu: khi bạn **gửi một
file video cho TÔM qua Lark**, nó tự tải video về **thư mục video đầu vào** (`VSS_VIDEO_IN`) — để sau
đó chỉ cần nhắn *"làm video"* là skill chạy.

> Không có TÔM cũng không sao: bạn tự thả video vào `videos-vao/` rồi chạy skill (xem `README.md` mục ①).

---

## Ý tưởng
Cầu nối TÔM thường **chỉ lắng nghe** tin `text / audio / image` và **bỏ qua video** (`media`/`file`).
Thêm một nhánh nhỏ để nhận video và tải thẳng vào thư mục đầu vào.

## Đoạn mã tham khảo (chỉnh cho đúng cầu nối của bạn)

Trong hàm lọc sự kiện, cho phép thêm loại `media`/`file`:
```js
// CŨ: chỉ nhận text/audio/image
// if (mt !== "text" && mt !== "audio" && mt !== "image") return;
// MỚI: nhận thêm video/file
if (!["text","audio","image","media","file"].includes(mt)) return;
...
if (mt === "media" || mt === "file") {
  return enqueue({ kind: "video", messageId: id });
}
```

Thêm hàm xử lý — tải video vào thư mục đầu vào (đặt `VIDEO_IN` = `VSS_VIDEO_IN` của bạn):
```js
const VIDEO_IN = process.env.VSS_VIDEO_IN || "<đường-dẫn-thư-mục-video-đầu-vào>";

async function processVideo(job) {
  const messageId = job.messageId;
  // 1) Lấy file_key + file_name của tin video (gọi API message của Lark)
  const meta = await getMediaFileKey(messageId);      // trả { fileKey, fileName }
  if (!meta?.fileKey) return replyText(messageId, "❌ Không lấy được video.");

  const ext = (meta.fileName.match(/\.[A-Za-z0-9]{2,5}$/) || [".mp4"])[0];
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const stem = (meta.fileName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g," ").trim() || "video").slice(0,80);

  // 2) QUAN TRỌNG (Windows): nếu tải qua shell, đường dẫn CÓ DẤU CÁCH sẽ bị cắt.
  //    → tải về file tạm KHÔNG dấu cách rồi mới chuyển vào thư mục đích bằng fs.
  const tmp = path.join(TMP_DIR, `vid-${messageId}${ext}`);
  await larkDownload(messageId, meta.fileKey, tmp);   // lark-cli im +messages-resources-download --type file
  if (!fs.existsSync(tmp)) return replyText(messageId, "❌ Tải video thất bại.");

  fs.mkdirSync(VIDEO_IN, { recursive: true });
  const dest = path.join(VIDEO_IN, `${date}_${stem}${ext}`);
  fs.renameSync(tmp, dest);
  replyText(messageId, `✅ Đã lưu video. Nhắn "làm video" để em biên tập.`);
}
```

Và trong vòng lặp hàng đợi, thêm nhánh:
```js
else if (job.kind === "video") await processVideo(job);
```

## Lưu ý quan trọng (kinh nghiệm thực chiến)
- **Dấu cách trong đường dẫn + `shell:true` (Windows):** tải thẳng `--output` vào thư mục có dấu cách
  sẽ **thất bại lặng lẽ** (cmd.exe cắt đối số ở khoảng trắng). Luôn tải về file tạm không dấu cách rồi
  `fs.renameSync` vào thư mục đích.
- **Ngày dùng giờ máy (local)** — đừng dùng `toISOString()` (lệch UTC).
- Đây là mã **tham khảo** — tên hàm (`getMediaFileKey`, `larkDownload`, `replyText`, `enqueue`) tuỳ theo
  cầu nối của bạn. Giữ đúng ý: nhận `media/file` → tải về `VSS_VIDEO_IN`.

Xong bước này: **gửi video cho TÔM → nhắn "làm video" → xong.**
