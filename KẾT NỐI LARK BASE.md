# KẾT NỐI LARK BASE — làm 1 lần, dùng mãi

Mục đích: video làm xong **tự chạy về một bảng Lark Base của bạn** — caption vào cột nội dung, file video và ảnh bìa vào cột đính kèm. Từ đó bạn duyệt và đăng lên kênh.

Toàn bộ việc này làm trong giao diện, **không cần đụng vào code**.

---

## Bước 1 — Chuẩn bị bảng trong Lark Base

Tạo (hoặc dùng bảng có sẵn) với tối thiểu các cột sau:

| Cột | Kiểu trong Lark | Bắt buộc | Dùng để |
|---|---|---|---|
| Nội dung | Văn bản nhiều dòng | Nên có | Chứa caption AI viết |
| Ảnh/video | **Tệp đính kèm** | ✅ Bắt buộc | Chứa file video |
| Thumbnail | Tệp đính kèm | Tuỳ chọn | Chứa ảnh bìa |
| Loại | Lựa chọn (Select) | Tuỳ chọn | Đánh dấu "Video" |
| Kênh/Fanpage | Liên kết bảng khác | Tuỳ chọn | Gắn về kênh sẽ đăng |

> Tên cột đặt sao cũng được — bước 3 bạn sẽ tự chỉ cột nào là cột nào.

---

## Bước 2 — Đăng nhập Lark trên máy (1 lần)

Mở Terminal (Mac) hoặc CMD (Windows), gõ:

```
lark-cli login
```

Trình duyệt mở ra, đăng nhập tài khoản Lark **có quyền chỉnh sửa** Base đó. Xong là thôi, không phải làm lại.

*(Nếu máy báo không có lệnh này: chạy `CÀI ĐẶT (chạy 1 lần).bat` — nó cài sẵn.)*

---

## Bước 3 — Nối trong phần mềm

1. Mở phần mềm → tab **⚙️ Cấu hình**
2. Mở Lark Base trên trình duyệt, vào **đúng bảng** muốn chứa video, copy link trên thanh địa chỉ. Link có dạng:
   ```
   https://xxx.larksuite.com/base/XXXXXXXXXXXX?table=tblYYYYYYYY&view=vewZZZZ
   ```
3. Dán vào ô ① rồi bấm **🔎 Dò bảng & cột**
4. Phần mềm liệt kê toàn bộ bảng trong Base đó → chọn bảng ở ô ②
5. Bấm **↻ Nạp cột của bảng này** → chọn cột ở ô ③:
   - **Cột đính kèm VIDEO** — bắt buộc, chọn đúng cột kiểu Tệp đính kèm
   - Cột ảnh bìa, cột nội dung, cột Loại, cột liên kết — tuỳ chọn, không dùng thì để "— không dùng —"
6. Bấm **💾 Lưu kết nối Lark**

Dòng trạng thái chuyển thành **✅ Đã kết nối** là xong.

---

## Bước 4 — Dùng

- **Tự động:** ở tab làm video, tích ô "📤 Tự đăng Lark" → chạy xong tự đưa về Base.
- **Thủ công:** ở phần kết quả, bấm nút đăng của từng video.

---

## Câu hỏi thường gặp

**Đổi sang Base khác được không?**
Được. Quay lại tab ⚙️ Cấu hình, dán link mới, dò lại, lưu. Ghi đè cấu hình cũ.

**Cấu hình lưu ở đâu?**
File `settings.local.json` ngay trong thư mục phần mềm. Đây là file riêng của bạn — sao lưu nó là giữ được toàn bộ thiết lập; đừng gửi cho người khác.

**Không dùng Lark có sao không?**
Không sao. Bỏ trống phần này, mọi tính năng làm video vẫn chạy đủ, chỉ là tải video về máy thủ công.

**Báo "Không đọc được Base"?**
Ba nguyên nhân theo thứ tự hay gặp:
1. Chưa chạy `lark-cli login`
2. Tài khoản đăng nhập không có quyền vào Base đó → nhờ chủ Base thêm quyền **Chỉnh sửa**
3. Link dán sai (dán nhầm link tài liệu, không phải link Base)

**Vì sao cột đính kèm phải chọn từ danh sách, không gõ tên?**
Vì tên cột có thể chứa ký tự đặc biệt (như dấu `/` trong "Ảnh/video") làm hỏng lệnh. Phần mềm dùng mã ID của cột nên chọn từ danh sách là chắc chắn đúng.
