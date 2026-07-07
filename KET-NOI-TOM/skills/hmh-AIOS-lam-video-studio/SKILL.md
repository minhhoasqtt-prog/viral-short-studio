---
name: hmh-AIOS-lam-video-studio
description: >
  Ra lệnh "làm video" → trợ lý lấy video mới nhất trong thư mục đầu vào (nơi bạn/TÔM thả video),
  đưa đường dẫn vào phần mềm Viral Short Studio, mở app lên, bật đủ tính năng biên tập
  (cắt thông minh, phụ đề động, chỉnh màu, thumbnail, AI viết caption), rồi tuỳ chọn đẩy lên Lark Base.
  CŨNG nhận LINK: dán link YouTube/Facebook/Drive/TikTok → app tự tải (yt-dlp) rồi cắt short.
  Dùng khi người dùng muốn làm/biên tập video từ clip vừa gửi, cắt short viral, biên tập video dài 16:9,
  hoặc cắt short từ một link video.
  Kích hoạt khi có từ: "làm video", "biên tập video", "cắt short", "cắt video", "dựng video",
  "làm short", "video dài 16:9", "đưa video vào phần mềm", "cắt link", "làm video từ link",
  "link youtube/facebook/drive", "dán link làm video".
---

# hmh-AIOS-lam-video-studio — Làm video bằng Viral Short Studio

Một lệnh "làm video" → **video → Studio biên tập → (tuỳ chọn) đẩy Lark**. Trợ lý chạy trọn, báo kết quả.

Đây là **skill kết nối** (glue) giữa trợ lý AI của bạn và phần mềm Viral Short Studio. Nó điều khiển
phần mềm qua API nội bộ (`http://localhost:5178`) — không đụng tới bí mật nào.

---

## Luồng
```
Video vào thư mục đầu vào (bạn thả tay, HOẶC TÔM/Bộ Não tự lưu về)
Bạn nhắn "làm video" ──▶ skill này:
   1. Lấy đường dẫn video MỚI NHẤT trong thư mục đầu vào
   2. Bảo đảm Studio đang chạy (bật nếu chưa) + MỞ cửa sổ app để xem
   3. Nộp đường dẫn vào app qua API → biên tập (bật đủ tính năng)
   4. Xong → (tuỳ chọn) đẩy lên Lark Base + báo kết quả
```

## Khi nào dùng / KHÔNG dùng
- **Dùng:** đã có video trong thư mục đầu vào và muốn biên tập ra short / video dài.
- **KHÔNG** tự chạy khi người dùng chỉ thả video mà chưa ra lệnh "làm video".

## Chọn kiểu biên tập (đọc lệnh để quyết)
| Người dùng nói… | mode | Kết quả |
|---|---|---|
| "làm video", "cắt short", "cắt video", "làm short" | `autoclip` (mặc định) | 1 video dài → nhiều **short 9:16** + chấm điểm + phụ đề karaoke |
| "video dài", "16:9", "youtube", "biên tập video dài" | `longedit` | 1 video dài → **bản 16:9** đã biên tập (cắt lặng, phụ đề, màu, logo) |

Không rõ → mặc định `autoclip` (đây là Viral **SHORT** Studio).

## Nguồn từ LINK (YouTube / Facebook / Drive / TikTok)
Nếu người dùng **dán một link video**: truyền `--url "<link>"`. Phần mềm tự tải bằng **yt-dlp** rồi cắt short.
**Link chỉ chạy `autoclip`** (longedit cần file — script tự chuyển sang autoclip khi gặp link).
- Nếu `--video` thực ra là URL, script tự hiểu là link.
- Facebook/Drive riêng tư có thể cần đăng nhập/cookies; link công khai chạy thẳng.

## Tiền điều kiện
- Đã cài **Viral Short Studio** (xem `ĐỌC TRƯỚC (bàn giao).txt` / `HƯỚNG DẪN.txt` ở gốc repo).
- Node ≥ 18 (đã có sẵn khi cài Studio).
- (Tuỳ chọn) Muốn đẩy Lark: cấu hình Lark trong app trước (tab **⚙️ Cấu hình** → dán link Base → Dò bảng), rồi thêm cờ `--lark`.

## Cấu hình (biến môi trường — đều tuỳ chọn)
| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `VSS_PORT` | cổng phần mềm | `5178` |
| `VSS_STUDIO_DIR` | thư mục cài Studio | tự dò từ vị trí file (tìm `server.mjs`) |
| `VSS_VIDEO_IN` | thư mục video đầu vào (nơi TÔM/bạn thả video) | `<studio>/videos-vao` |

## Quy trình thực thi
Chạy **một lệnh**:
```bash
node "KET-NOI-TOM/skills/hmh-AIOS-lam-video-studio/scripts/lam-video.mjs" --mode autoclip
```
Tuỳ chọn:
- `--url "<link>"` — nguồn là LINK YouTube/Facebook/Drive/TikTok (app tự tải; chỉ autoclip).
- `--video "<đường-dẫn>"` — video cụ thể (bỏ trống = video mới nhất trong `VSS_VIDEO_IN`).
- `--mode autoclip|longedit` — chọn kiểu (bảng trên).
- `--note "giữ đoạn nói về bán hàng"` — chỉ đạo đạo diễn cho AI.
- `--lark` — BẬT đẩy Lark (mặc định TẮT — an toàn cho bản trắng).
- `--no-open` — không mở cửa sổ app.
- `--max-minutes 10` — (longedit) tách phần nếu dài hơn.

Script sẽ: chọn video → bật/kiểm tra Studio → mở app → nộp job → **in log tiến trình** → in tóm tắt.

## Tham chiếu
- Script: `scripts/lam-video.mjs` (zero-dep, dùng `fetch` built-in; chạy Windows/macOS/Linux).
- API Studio: `POST /api/autoclip {path,…}` · `POST /api/longedit {paths:[…],…}` → `{jobId}`; theo dõi `GET /api/job/<id>`.

## Lưu ý
- **Đẩy Lark mặc định của phần mềm là TẮT** ("xuất bản phải chủ động"). Skill này bật lại khi bạn thêm `--lark`, và chỉ hoạt động nếu bạn đã cấu hình Lark trong app.
- **autoclip dùng cờ `autoPostLark`, longedit dùng `postLark`** — script gửi cả hai cho chắc.
- Video dài → autoclip cắt NHIỀU short. Muốn ít → thêm `--note` khu biệt hoặc dùng `longedit`.
- Đường dẫn có dấu cách / tiếng Việt: script truyền qua HTTP JSON (không qua shell) nên an toàn.
