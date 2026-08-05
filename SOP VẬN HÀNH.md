# SOP VẬN HÀNH — VIRAL SHORT STUDIO

Quy trình chuẩn để chạy phần mềm hằng ngày. Đọc một lần, sau đó chỉ cần liếc phần "Quy trình 15 phút".

---

## 0. Trước khi bắt đầu (làm 1 lần duy nhất)

| Việc | Cách làm | Xong chưa? |
|---|---|---|
| Cài công cụ nền | Chạy `CÀI ĐẶT (chạy 1 lần).bat` (Windows) hoặc `CÀI ĐẶT (Mac).command` | ☐ |
| Đăng nhập Claude | Trong Terminal/CMD gõ `claude login` | ☐ |
| Đăng nhập Lark | Trong Terminal/CMD gõ `lark-cli login` | ☐ |
| Kết nối Lark Base | Mở phần mềm → tab **⚙️ Cấu hình** → dán link Base → Dò bảng → chọn cột → Lưu | ☐ |
| Khai thương hiệu | Cùng tab ⚙️ Cấu hình, phần "Thương hiệu của bạn" | ☐ |

> Không làm bước Lark vẫn dùng được phần mềm bình thường — chỉ là video không tự đưa về Lark, phải tải tay.

---

## 1. Quy trình 15 phút (dùng hằng ngày)

```
Quay/có sẵn video dài  →  Cắt tự động  →  Duyệt đoạn  →  Render  →  Về Lark Base  →  Đăng
```

**Bước 1 — Mở phần mềm.** Bấm đúp `MỞ PHẦN MỀM.vbs` (Windows). Cửa sổ app hiện ra, góc phải hiện "GPU NVENC bật" là máy chạy nhanh.

**Bước 2 — Chọn đúng cửa.** Màn hình "Bắt đầu nhanh" hỏi bạn đang có gì:

| Bạn có | Chọn | Kết quả |
|---|---|---|
| 1 video dài (buổi dạy, livestream, hội thảo) | 🧠 Cắt tự động | Nhiều short 30–90s |
| Nhiều video cần ghép, hoặc bản cho YouTube | 🎬 Video dài YouTube | 1 video 16:9 hoàn chỉnh |
| Cảnh rời + file giọng đọc | 🎙️ Short lồng voice | 1 short kể chuyện |
| 1 clip thô cần làm đẹp | ✂️ Tự biên tập | Bản có phụ đề, màu, nhạc |
| Short đã có, muốn chấm điểm | ⭐ Đánh giá | Điểm 6 trục + việc cần sửa |
| Link video viral của người khác | 🔎 Bóc ý tưởng | Hook + công thức để làm lại |

**Bước 3 — Điền đầu vào.** Tối thiểu chỉ cần ô ① (video nguồn): dán đường dẫn file, kéo–thả, hoặc dán **link Google Drive / YouTube**. Các ô còn lại (b-roll, CTA, logo, nhạc) bỏ trống vẫn chạy.

**Bước 4 — Duyệt trước khi render.** Để bật ô "👁️ Duyệt các đoạn trước khi render". AI chọn xong sẽ hiện bảng: đọc phụ đề từng đoạn, bấm ▶ nghe thử, kéo dài/rút ngắn đầu–cuối bằng nút ±1s/±3s, bỏ đoạn không ưng. **Đây là bước quyết định chất lượng** — đừng bỏ qua.

**Bước 5 — Render.** Máy chạy: gõ chữ → cắt → phụ đề → màu → nhạc → xuất file. Video 60 phút mất khoảng 20–40 phút tùy máy.

**Bước 6 — Xem & chỉnh trực tiếp.** Ở phần kết quả: kéo–thả logo, chỉnh 3 thanh màu, chọn nhạc, chọn CTA — xem ngay trên video. Ưng thì bấm **"⬇ Tải kèm logo/nhạc/CTA"**.

**Bước 7 — Đưa về Lark.** Nếu đã cấu hình Lark: bấm nút đăng, hoặc bật "📤 Tự đăng Lark" từ đầu để chạy xong tự đưa về. Mỗi short thành 1 dòng trong Base: caption vào cột Nội dung, video và ảnh bìa vào cột đính kèm.

---

## 2. Nguyên tắc chất lượng (rút từ thực chiến)

1. **Mỗi short = đúng MỘT trọng điểm.** Một khái niệm, trọn vẹn, người lạ xem không cần biết gì trước đó vẫn hiểu. Tham nhiều ý = không ai nhớ gì.
2. **Thà dài mà trọn còn hơn ngắn mà cụt.** Đừng ép 30 giây nếu ý cần 80 giây. Bật "⭐ Ưu tiên đủ ý".
3. **Không cắt giữa câu.** Bảng duyệt có nút ±1s chính là để sửa việc này — nghe lại mép cắt trước khi render.
4. **Sai chế độ là hỏng.** Video feedback/testimonial/bài giảng cần giữ đủ ý → chọn "🎬 Giữ trọn cả video, chỉ dọn gọn", đừng dùng Cắt tự động (nó là thợ săn highlight, vứt phần lớn video).
5. **Video đã là short 9:16 có phụ đề cháy sẵn thì đừng đưa vào Cắt tự động** — sẽ chồng 2 lớp phụ đề. Cắt tự động dành cho video gốc quay ngang.
6. **Ra lệnh bằng lời.** Ô "📝 Ghi chú / ra lệnh cho AI" nhận câu như *"tập trung đoạn nói về tuyển dụng, màu ấm, bỏ tiếng à ừ"* — lệnh này thắng mọi thiết lập bên dưới.

---

## 3. Bảng xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Mở app không lên | Server cũ còn giữ cổng 5178 | Chạy `RESTART.bat` |
| "AI cloud lỗi" / không chọn được đoạn | Chưa `claude login`, hoặc mạng chậm | Đăng nhập lại; phần mềm vẫn có chế độ dự phòng tự chia đoạn |
| Nút "Dò bảng" báo không đọc được Base | Chưa `lark-cli login`, hoặc tài khoản không có quyền vào Base đó | Đăng nhập lại; nhờ chủ Base cấp quyền Chỉnh sửa |
| Đăng Lark báo "Chưa cấu hình Lark Base" | Chưa lưu cấu hình | Tab ⚙️ Cấu hình → dán link → Dò bảng → chọn cột đính kèm video → Lưu |
| Video ra bị cụt ý | Không duyệt trước khi render | Bật "👁️ Duyệt các đoạn", kéo dài đầu–cuối |
| Phụ đề sai chính tả | Máy nghe nhầm (tiếng Việt) | Bật "AI sửa chính tả phụ đề"; hoặc đổi model nghe sang `medium`/`large` |
| Render rất chậm | Máy không có GPU NVENC | Bình thường — vẫn chạy bằng CPU, chỉ lâu hơn |
| Ổ đĩa đầy nhanh | Kho `work/` phình theo mỗi lần chạy | Chạy `DỌN KHO.bat`, hoặc bật `BẬT DỌN KHO TỰ ĐỘNG.bat` |
| Link Drive tải không được | File chưa mở chia sẻ | Đặt "Bất kỳ ai có đường liên kết" |

---

## 4. Lịch bảo trì

| Việc | Tần suất |
|---|---|
| Dọn kho `work/` | Hằng tuần (hoặc bật dọn tự động) |
| Kiểm tra dung lượng ổ còn trống | Hằng tuần — app cảnh báo khi sắp đầy |
| Sao lưu `settings.local.json` | Sau mỗi lần đổi cấu hình (file này là toàn bộ thiết lập của bạn) |
| Đăng nhập lại `claude` / `lark-cli` | Khi có thông báo hết hạn |

---

## 5. Những file quan trọng

| File / thư mục | Là gì |
|---|---|
| `settings.local.json` | Toàn bộ cấu hình riêng của bạn (Lark + thương hiệu). **Không đưa cho ai.** |
| `.env` | Cấu hình nâng cao (tuỳ chọn). Copy từ `.env.example`. |
| `work/out/` | Video thành phẩm nằm ở đây |
| `projects/` | Dự án đã lưu (`.vss.json`) — mở lại để chạy tiếp |
| `assets/fonts/` | Bỏ thêm file `.otf/.ttf` vào đây để có thêm font phụ đề |
| `assets/watermark.png` | Thả ảnh PNG nền trong suốt của bạn vào đây để đóng dấu giữa video |
| `assets/logo-mentor.png` | Thả logo của bạn vào đây để đóng dấu góc trên-trái video |
| `standards/thuong-hieu.md` | Viết "chất riêng" kênh bạn vào đây → AI chọn đoạn bám đúng chất |
| `Tài nguyên/` | Nơi để nhạc nền, video CTA, intro/outro của bạn |

---

*Phần mềm phát triển bởi Mentor Internet System.*
