# 🔌 KẾT NỐI TÔM — Ra lệnh "làm video", trợ lý tự biên tập

Thư mục này biến Viral Short Studio thành **"làm video bằng một câu lệnh"**: bạn (hoặc trợ lý AI
**TÔM / Bộ Não thứ 2**) đưa một video vào, ra lệnh *"làm video"* → phần mềm tự mở, tự biên tập
(cắt short, phụ đề, màu, thumbnail, AI caption), rồi tuỳ chọn **đẩy lên Lark Base**.

> Đây là lớp **kết nối tuỳ chọn**. Không cài phần này thì phần mềm vẫn chạy bình thường qua giao diện.

---

## 🧭 Toàn cảnh luồng

```
        (bạn thả tay)                 hoặc          (TÔM tự lưu khi bạn gửi video)
              │                                                │
              ▼                                                ▼
   ┌──────────────────────────  THƯ MỤC VIDEO ĐẦU VÀO  ──────────────────────────┐
   │                         (mặc định: videos-vao/ · đổi bằng VSS_VIDEO_IN)       │
   └───────────────────────────────────────┬─────────────────────────────────────┘
                                            │  bạn nhắn: "làm video"
                                            ▼
                          skills/hmh-AIOS-lam-video-studio  (lam-video.mjs)
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                              ▼
     bật + mở Viral Short Studio     nộp đường dẫn qua API          theo dõi tới khi xong
                                     (cắt/biên tập đủ tính năng)     → (tuỳ chọn) đẩy Lark
```

---

## 📦 Có gì trong đây
```
KET-NOI-TOM/
├── README.md                         ← file này
├── skills/
│   └── hmh-AIOS-lam-video-studio/
│       ├── SKILL.md                  ← mô tả skill cho trợ lý AI đọc
│       └── scripts/lam-video.mjs     ← bộ điều khiển (zero-dep, Win/Mac/Linux)
└── videos-vao/                       ← thả video vào đây (tự tạo nếu chưa có)
```

---

## ① Dùng NGAY — KHÔNG cần trợ lý AI (đơn giản nhất)

1. Cài Viral Short Studio như hướng dẫn ở gốc repo (`ĐỌC TRƯỚC (bàn giao).txt`).
2. Thả 1 video vào thư mục **`KET-NOI-TOM/videos-vao/`**.
3. Chạy (mở Terminal/CMD tại thư mục repo):
   ```bash
   node "KET-NOI-TOM/skills/hmh-AIOS-lam-video-studio/scripts/lam-video.mjs"
   ```
   → phần mềm tự mở, cắt short từ video mới nhất, in kết quả.

Chọn kiểu / tuỳ chọn:
- Cắt short viral (mặc định): `--mode autoclip`
- Biên tập video dài 16:9: `--mode longedit`
- Video cụ thể: `--video "C:\đường\dẫn\video.mp4"`
- **Từ LINK (YouTube/Facebook/Drive/TikTok):** `--url "https://..."` → app tự tải bằng yt-dlp rồi cắt short.
- Đẩy Lark (sau khi đã cấu hình Lark trong app): `--lark`

> 💡 **Dán link là làm được ngay** — không cần tải video về trước:
> ```bash
> node "KET-NOI-TOM/skills/hmh-AIOS-lam-video-studio/scripts/lam-video.mjs" --url "https://www.youtube.com/watch?v=..."
> ```
> (Link riêng tư của Facebook/Drive có thể cần đăng nhập; link công khai chạy thẳng.)

---

## ② Dùng VỚI trợ lý AI (TÔM / Bộ Não thứ 2)

Nếu bạn có hệ **Bộ Não thứ 2** (thư mục có `.claude/skills/`):

1. **Chép skill vào trợ lý:** copy cả thư mục
   `KET-NOI-TOM/skills/hmh-AIOS-lam-video-studio/`
   vào `<Bộ Não>/.claude/skills/`.
2. **Trỏ thư mục video đầu vào:** đặt biến môi trường `VSS_VIDEO_IN` = thư mục mà trợ lý lưu
   video (vd nơi TÔM cất video bạn gửi qua Lark). Nếu để trống, mặc định là `videos-vao/`.
3. **Trỏ thư mục cài Studio** (nếu skill nằm khác chỗ Studio): đặt `VSS_STUDIO_DIR` = thư mục repo này.
4. Giờ chỉ cần nhắn trợ lý: **"làm video"** → nó chạy skill, biên tập, báo kết quả.

> **Muốn TÔM tự lưu video khi bạn GỬI file cho nó** (gửi video qua Lark → tự vào thư mục đầu vào)?
> Xem `TICH-HOP-TOM-bridge.md` — thêm một đoạn nhỏ vào cầu nối (bridge) của TÔM.

---

## ③ Đẩy lên Lark Base (tuỳ chọn)

Phần mềm có sẵn tính năng đăng video + thumbnail + caption vào **Lark Base của BẠN**:
1. Mở app → tab **⚙️ Cấu hình** → dán link Base của bạn → **Dò bảng & cột** → chọn cột → Lưu.
   (Hoặc điền `VSS_LARK_*` trong `.env` — xem `.env.example`.)
2. Khi chạy skill, thêm cờ **`--lark`** để tự đẩy sau khi biên tập xong.

Mặc định **TẮT** đẩy Lark (an toàn) — bạn chủ động bật.

---

## ⚙️ Bảng biến môi trường
| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `VSS_PORT` | cổng phần mềm | `5178` |
| `VSS_STUDIO_DIR` | thư mục cài Viral Short Studio | tự dò (tìm `server.mjs`) |
| `VSS_VIDEO_IN` | thư mục video đầu vào | `<studio>/videos-vao` |

Không có bí mật nào trong thư mục này — mọi cấu hình đều qua biến môi trường hoặc cấu hình ngay trong app.
