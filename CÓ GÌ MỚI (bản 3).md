# Có gì mới ở bản 3 (30/09/2026)

Bản 3 GIỮ NGUYÊN mọi tính năng của bản 05/08: duyệt đoạn trên trục thời gian kiểu CapCut ở Cắt tự động, Tự biên tập, Video dài, Short lồng voice (duyệt giọng trên sóng âm); thả NHIỀU video một lượt; thư mục KET-NOI-TOM. Phần dưới là những gì THÊM MỚI.

## 1. Giao diện mới
- Nền tối, thanh chức năng dọc bên trái chia 3 nhóm: Sản xuất · Phân tích · Quản lý.
- Tab Cắt tự động và Tự biên tập có nút ⚡ Nhanh / 🛠 Nâng cao. Chế độ Nhanh chỉ còn: dán link video, chọn khung, bấm chạy.
- Video kết quả hiện thành thẻ nhỏ, nhiều video một màn hình. Nút S / M / L ở góc trên để chỉnh cỡ.

## 2. Khung thương hiệu theo chương trình
- Ô "Khung thương hiệu" chọn bằng ảnh, có ở Cắt tự động, Tự biên tập, Short lồng voice.
- Có khung: video nằm trong ô của khung, phụ đề ngay dưới video, câu hook nằm trong video (không đè tên chương trình), b-roll co vừa ô.
- Bản giao có 2 khung mẫu trống ("tên ở trên" và "video ở giữa"). Tạo khung cho chương trình của bạn bằng 1 lệnh:

```
python scripts/tao-khung.py hoc-ban-hang "Khung Học Bán Hàng" --chu "HỌC BÁN HÀNG"
python scripts/tao-khung.py hoc-ban-hang "Khung Học Bán Hàng" --nen anh-nen.png --logo logo.png
python scripts/tao-khung.py su-kien "Khung Sự Kiện" --logo logo.png --kieu giua --mau "#1a1a2e" --nhan "#ff6b35"
```

Tải lại trang phần mềm là khung mới hiện ra. Không cần sửa mã.

## 3. Đổi khung không cần dựng lại
Video đã xuất mà chưa ưng khung: chọn khung khác dưới thẻ video → bấm 🖼️ Đổi. Phần mềm chỉ ghép lại khung và chữ, mất vài chục giây, không bóc âm hay chạy AI lại. Đổi bao nhiêu lần cũng được. Làm được cả trong mục 🗂️ Kho video.

## 4. Dán link Record Zoom Lark
Ô video nguồn nhận thẳng link Lark Minutes (…larksuite.com/minutes/…). Phần mềm tự tải bản ghi gốc (cần `lark-cli auth login` bằng tài khoản xem được buổi đó).

## 5. Quản lý việc
- Bảng tiến độ nổi góc trên phải: %, việc đang làm, còn khoảng bao lâu, nút ⛔ Huỷ.
- Bấm nhiều việc liền: phần mềm xếp hàng, làm lần lượt, không tranh máy.
- 📋 Việc gần đây: xem việc đang chạy / chờ / lỗi. Phần mềm tắt giữa chừng thì việc hiện "Bị ngắt", bấm ↻ Chạy lại.
- 🗂️ Kho video: mọi video đã xuất, lọc theo tên / khung / ngày / "cần xem lại" (điểm kỹ thuật dưới 60).

## 6. Chất lượng
- Tự kiểm mỗi video sau khi xuất; hỏng thì tự dựng lại 1 lần.
- Bóc âm hỏng thì báo lỗi rõ ràng, không xuất video thiếu phụ đề.
- Từ điển tên riêng: sửa tệp `assets/tu-dien-ten-rieng.txt` để phụ đề nghe đúng tên người, thương hiệu của bạn (hướng dẫn ngay trong tệp).
- AI chọn đoạn chạy song song 3 phần một lúc, video dài xong nhanh hơn.

## 7. An toàn
- Phần mềm chỉ mở trên chính máy bạn. Máy khác trong mạng không đọc được tệp của bạn.
- Muốn cho máy khác dùng: đặt biến môi trường `VSS_HOST=0.0.0.0` và `VSS_PASS=<mật khẩu>`, rồi mở `http://<IP máy>:5178/?k=<mật khẩu>`.

## 8. Hệ thống
- ⚙️ Hệ thống: kiểm máy đủ đồ nghề chưa, bật báo tin Lark khi xong việc (khai mã nhóm chat_id), xem lỗi trong 7 ngày.
- Đặt kho làm việc sang ổ SSD cho nhanh: tạo tệp `vss.local.json` ở thư mục phần mềm:

```json
{ "may": { "TÊN-MÁY-CỦA-BẠN": { "workDir": "D:/VIDEO-VIRAL-WORK" } } }
```

(Tên máy: mở CMD gõ `hostname`.) Thành phẩm vẫn nằm trong `work/out` của thư mục phần mềm.
