# VIRAL SHORT STUDIO · bản 3 (30/09/2026)

Phần mềm chạy trên máy bạn, biến video dài thành nhiều video ngắn: tự nghe, tự chọn đoạn đắt giá, tự cắt, làm phụ đề, chỉnh màu, ghép nhạc, đặt vào khung thương hiệu, dựng ảnh bìa, rồi đưa về Lark Base để bạn duyệt và đăng.

Mọi thứ chạy trên máy bạn. Video không đi qua máy chủ của ai.

## Đọc theo thứ tự

| Thứ tự | Tệp | Khi nào đọc |
|---|---|---|
| 1 | `CÓ GÌ MỚI (bản 3).md` | Đọc trước, vì giao diện đã đổi hoàn toàn so với bản cũ |
| 2 | `HƯỚNG DẪN.txt` (Windows) hoặc `HƯỚNG DẪN (Mac).txt` | Các bước cài đặt |
| 3 | `KẾT NỐI LARK BASE.md` | Khi nối Lark Base |
| 4 | `SOP VẬN HÀNH.md` | Quy trình dùng hằng ngày + xử lý sự cố |
| 5 | `HƯỚNG DẪN SỬ DỤNG.md` · `HƯỚNG DẪN SỬ DỤNG (có hình).docx` | Tra cứu chi tiết từng tính năng (hình minh hoạ là giao diện cũ, chức năng vẫn vậy) |
| 6 | `HƯỚNG DẪN CHUYỂN GIAO.pdf` | Cách tải phần mềm từ GitHub và cập nhật bản mới |
| 7 | `KET-NOI-TOM/` | Nối phần mềm với trợ lý TÔM (ra lệnh "làm video" qua chat) |

## Bắt đầu trong 5 bước

1. Cài công cụ: bấm đúp `CÀI ĐẶT (chạy 1 lần).bat`.
2. Đăng nhập: mở CMD gõ `claude login`, rồi `lark-cli auth login`.
3. Mở phần mềm: bấm đúp `MỞ PHẦN MỀM.vbs`.
4. Vào mục ⚙️ Hệ thống: xem máy đã đủ đồ nghề chưa. Mục nào đỏ thì làm theo dòng "Cách sửa".
5. Vào mục 🛠️ Cấu hình: khai tên kênh, lĩnh vực, rồi dán link Lark Base → Dò bảng → chọn cột → Lưu.

Muốn chắc mọi thứ chạy đúng: bấm đúp `KIỂM THỬ.bat`. Phần mềm tự dựng thử video mẫu với mọi khung, rồi báo ✅/❌ từng mục.

## Cập nhật bản mới

Đã tải bằng git: mở CMD trong thư mục phần mềm, gõ `git pull`. Tải bằng ZIP: tải lại ZIP rồi chép đè, GIỮ LẠI `settings.local.json`, `vss.local.json`, thư mục `work/` và `projects/` của bạn.
