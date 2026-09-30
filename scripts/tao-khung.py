# TẠO KHUNG THƯƠNG HIỆU CHO MỘT CHƯƠNG TRÌNH MỚI (1 lệnh)
#
#   python scripts/tao-khung.py <mã-khung> "<Tên hiển thị>" [--nen anh-nen.png] [--logo logo.png] [--chu "TÊN CHƯƠNG TRÌNH"]
#                               [--mau "#1a1a2e"] [--nhan "#ff6b35"] [--kieu tren|giua]
#
# Kiểu "tren" (mặc định): tên/logo ở dải trên, video 16:9 ngay dưới, phụ đề dưới video (như khung HPRKD).
# Kiểu "giua": video 16:9 ở giữa khung, nền mờ lấy từ chính video, dải trên có logo (như khung Mentor Business).
# --nen   : ảnh nền (tự phóng + cắt giữa cho đủ 1080x1920). Không có thì tô màu --mau.
# --logo  : ảnh logo nền trong suốt, đặt ở dải trên.   --chu : chữ tên chương trình (khi không có logo).
# Kết quả: assets/frames/<mã-khung>/frame.png + frame.json và public/frames/<mã-khung>.jpg (ảnh xem trước).
# Tải lại trang phần mềm là khung mới hiện trong ô "Khung thương hiệu". Không cần sửa mã.
import os, sys, json, argparse, time
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, VH = 1080, 1920, 608
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets", "fonts", "DTPhudu-Black.otf")

ap = argparse.ArgumentParser()
ap.add_argument("ma"); ap.add_argument("ten")
ap.add_argument("--nen"); ap.add_argument("--logo"); ap.add_argument("--chu")
ap.add_argument("--mau", default="#1a1a2e"); ap.add_argument("--nhan", default="#ff6b35")
ap.add_argument("--kieu", default="tren", choices=["tren", "giua"])
a = ap.parse_args()
hexc = lambda h: tuple(int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
DARK, ACC = hexc(a.mau), hexc(a.nhan)

def cover(im):
    im = im.convert("RGB")
    im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS) if im.width / im.height > W / H else im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))

def draw_title(img, top, bottom):
    area_h = bottom - top
    if a.logo:
        lg = Image.open(a.logo).convert("RGBA")
        lg = lg.crop(lg.split()[-1].getbbox() or (0, 0, lg.width, lg.height))
        k = min(900 / lg.width, (area_h - 80) / lg.height)
        lg = lg.resize((round(lg.width * k), round(lg.height * k)), Image.LANCZOS)
        img.alpha_composite(lg, ((W - lg.width) // 2, top + (area_h - lg.height) // 2))
    elif a.chu:
        d = ImageDraw.Draw(img)
        size = 120
        while size > 40:
            f = ImageFont.truetype(FONT, size) if os.path.exists(FONT) else ImageFont.load_default()
            lines = a.chu.upper().split("\\n") if "\\n" in a.chu else [a.chu.upper()]
            if max(d.textlength(l, font=f) for l in lines) <= 960: break
            size -= 6
        lh = size * 1.15; y = top + (area_h - lh * len(lines)) / 2
        for l in lines:
            d.text(((W - d.textlength(l, font=f)) / 2, y), l, font=f, fill="white", stroke_width=4, stroke_fill=(0, 0, 0))
            y += lh

if a.kieu == "tren":
    top = 640
    img = (cover(Image.open(a.nen)) if a.nen else Image.new("RGB", (W, H), DARK)).convert("RGBA")
    draw_title(img, 60, top - 20)
    ImageDraw.Draw(img).rectangle((0, top, W - 1, top + VH - 1), fill=(0, 0, 0, 0))
    cfg = {"name": a.ten, "hole": [0, top, W, VH], "captionTop": top + VH + 90, "hookTop": top + 40}
else:
    vy0 = (H - VH) // 2; vy1 = vy0 + VH
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for y in range(vy0): d.line([(0, y), (W, y)], fill=(*DARK, round(235 - 85 * y / (vy0 - 1))))
    for i, y in enumerate(range(vy1, H)): d.line([(0, y), (W, y)], fill=(*DARK, round(150 + 85 * i / (H - vy1 - 1))))
    d.rectangle((0, vy0 - 8, W, vy0 - 1), fill=ACC); d.rectangle((0, vy1, W, vy1 + 7), fill=ACC)
    draw_title(img, 60, vy0 - 20)
    cfg = {"name": a.ten, "hole": [0, vy0, W, VH], "captionTop": H - 490, "hookTop": vy0 + 40}

out = os.path.join(ROOT, "assets", "frames", a.ma)
os.makedirs(out, exist_ok=True)
tmp = os.path.join(out, "frame.tmp.png")
img.save(tmp)
for _ in range(30):   # ghi an toàn: tệp khung có thể đang được ffmpeg đọc
    try: os.replace(tmp, os.path.join(out, "frame.png")); break
    except OSError: time.sleep(1)
json.dump(cfg, open(os.path.join(out, "frame.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# Ảnh xem trước: video mẫu kẻ ô trong khung
prev = Image.new("RGB", (W, H), (40, 40, 60)).convert("RGBA")
hx, hy, hw, hh = cfg["hole"]
tile = Image.new("RGB", (hw, hh), (70, 90, 120)); td = ImageDraw.Draw(tile)
for x in range(0, hw, 60): td.line([(x, 0), (x, hh)], fill=(90, 110, 140), width=2)
for y in range(0, hh, 60): td.line([(0, y), (hw, y)], fill=(90, 110, 140), width=2)
prev.paste(tile, (hx, hy)); prev.alpha_composite(img)
os.makedirs(os.path.join(ROOT, "public", "frames"), exist_ok=True)
prev.convert("RGB").resize((270, 480), Image.LANCZOS).save(os.path.join(ROOT, "public", "frames", a.ma + ".jpg"), quality=85)
print("✅ Đã tạo khung:", a.ten, "→", out)
