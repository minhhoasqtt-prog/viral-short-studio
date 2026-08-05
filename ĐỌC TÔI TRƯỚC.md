# VIRAL SHORT STUDIO

Phần mềm chạy trên máy bạn, biến **video dài thành nhiều video ngắn viral** — tự nghe, tự chọn đoạn đắt giá, tự cắt, tự làm phụ đề, chỉnh màu, ghép nhạc, dựng ảnh bìa, rồi đưa về Lark Base cho bạn duyệt và đăng.

Toàn bộ chạy **local trên máy bạn**, video không đi qua máy chủ của ai.

---

## Đọc theo thứ tự này

| Thứ tự | File | Khi nào đọc |
|---|---|---|
| 1 | **`HƯỚNG DẪN SỬ DỤNG (có hình).docx`** | **Đọc cái này trước tiên** — hướng dẫn đầy đủ từ cài đặt đến xuất video, có 17 hình chụp màn hình |
| 2 | `HƯỚNG DẪN.txt` | Các bước cài đặt rút gọn (Windows) — hoặc `HƯỚNG DẪN (Mac).txt` |
| 3 | `KẾT NỐI LARK BASE.md` | Riêng phần nối Lark, khi cần tra nhanh |
| 4 | `SOP VẬN HÀNH.md` | Quy trình dùng hằng ngày + bảng xử lý sự cố |

---

## Bắt đầu trong 4 bước

1. **Cài công cụ:** bấm đúp `CÀI ĐẶT (chạy 1 lần).bat` — máy tự cài Node, FFmpeg, Python, whisper, yt-dlp, Claude CLI, lark-cli.
2. **Đăng nhập:** trong CMD gõ `claude login`, rồi `lark-cli login`.
3. **Mở phần mềm:** bấm đúp `MỞ PHẦN MỀM.vbs`.
4. **Khai cấu hình:** tab **⚙️ Cấu hình** → dán link Lark Base → Dò bảng → chọn cột → Lưu. Khai luôn tên kênh và lĩnh vực của bạn.

Xong. Từ giờ chỉ việc thả video vào và bấm chạy.

---

## Phần mềm làm được gì

| Tính năng | Mô tả |
|---|---|
| 🧠 **Cắt tự động** | Video dài → nhiều short. AI đọc toàn bộ lời nói, chọn các đoạn có một trọng điểm trọn vẹn, cắt đúng ranh giới câu. Có bảng **duyệt trước khi render** để bạn nghe và chỉnh mép cắt. |
| 🎬 **Video dài YouTube** | Ghép nhiều video hoặc dọn 1 video dài → bản 16:9 / 1:1 hoàn chỉnh, có trám cảnh, phụ đề, nhạc. |
| 🎙️ **Short lồng voice** | Cảnh rời + file giọng đọc → 1 short kể chuyện, hình tự khớp độ dài giọng. |
| ✂️ **Tự biên tập** | 1 clip thô → cắt khoảng lặng, bỏ tiếng đệm "à ừ", phụ đề động, chỉnh màu, làm mịn, khử tạp âm, nhạc nền. |
| ⭐ **Đánh giá** | Chấm short theo 6 trục + chỉ ra việc cần sửa. |
| 🔎 **Bóc ý tưởng** | Dán link video viral của người khác → bóc hook và công thức. |
| 📦 **Hàng loạt** | Xử lý cả thư mục video một lượt. |
| 📤 **Đưa về Lark Base** | Video + ảnh bìa + caption tự thành một dòng trong bảng của bạn. |

Nhận đầu vào từ **file trên máy** hoặc **link Google Drive / YouTube / Facebook / TikTok**.

---

## Những gì bạn cần tự chuẩn bị

Phần mềm giao đến bạn **không kèm** các thứ mang dấu ấn riêng — bạn tự thả vào:

| Bạn muốn | Bỏ file vào |
|---|---|
| Đóng dấu logo góc video | `assets/logo-mentor.png` (PNG nền trong suốt) |
| Đóng dấu tên miền giữa đỉnh video | `assets/watermark.png` |
| Nhạc nền, video CTA, intro/outro | `Tài nguyên/` |
| Ảnh chân dung để dựng bìa thương hiệu | Thư mục bất kỳ, rồi khai đường dẫn ở tab ⚙️ Cấu hình |
| Font phụ đề khác | `assets/fonts/` (file `.otf` hoặc `.ttf`) |
| Dạy AI "chất riêng" kênh bạn | Viết vào `standards/thuong-hieu.md` |

---

## Máy cần gì

- **Windows 10/11** hoặc **macOS** — bộ cài tự lo phần còn lại
- Có **GPU NVIDIA** thì render nhanh hơn nhiều (không có vẫn chạy được bằng CPU)
- Ổ cứng trống ≥ 50 GB (video tạm chiếm nhiều chỗ — có sẵn công cụ dọn kho)
- Tài khoản **Claude** (cho phần AI) và **Lark** (nếu dùng đăng Lark)

---

*Phần mềm phát triển bởi Mentor Internet System.*
