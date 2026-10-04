"""Build Google Play Feature Graphic 1024x500 for emiGo."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]  # smartloan/
OUT_DIR = ROOT / "store-graphics" / "play-listing"
OUT_DIR.mkdir(parents=True, exist_ok=True)
ICON = ROOT / "icon-512.png"

W, H = 1024, 500
# Brand purple gradient
base = Image.new("RGB", (W, H), "#2A1460")
px = base.load()
for y in range(H):
    t = y / (H - 1)
    r = int(0x3A + (0x1A - 0x3A) * t)
    g = int(0x1D + (0x0C - 0x1D) * t)
    b = int(0x7A + (0x45 - 0x7A) * t)
    for x in range(W):
        # soft radial glow from left-center
        dx = (x - 280) / 420
        dy = (y - 250) / 280
        glow = max(0.0, 1.0 - (dx * dx + dy * dy) ** 0.5)
        gr = min(255, int(r + 55 * glow))
        gg = min(255, int(g + 35 * glow))
        gb = min(255, int(b + 70 * glow))
        px[x, y] = (gr, gg, gb)

# Decorative soft orbs
orb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(orb)
od.ellipse((720, -80, 1100, 300), fill=(255, 200, 80, 28))
od.ellipse((-60, 300, 220, 580), fill=(180, 120, 255, 35))
base = Image.alpha_composite(base.convert("RGBA"), orb).convert("RGB")

# Icon with soft shadow
icon = Image.open(ICON).convert("RGBA").resize((300, 300), Image.LANCZOS)
# rounded mask already in the art; add drop shadow
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle((78, 108, 78 + 300, 108 + 300), radius=68, fill=(0, 0, 0, 90))
shadow = shadow.filter(ImageFilter.GaussianBlur(18))
canvas = Image.alpha_composite(base.convert("RGBA"), shadow)
canvas.paste(icon, (78, 100), icon)

# Text
try:
    font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 64)
    font_sub = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 26)
    font_tag = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
except OSError:
    font_title = font_sub = font_tag = ImageFont.load_default()

d = ImageDraw.Draw(canvas)
tx, ty = 420, 145
d.text((tx, ty), "emiGo", fill="#FFFFFF", font=font_title)
d.text((tx, ty + 78), "EMI & Loan Calculator", fill="#E8D9FF", font=font_sub)
d.text((tx, ty + 120), "Bank comparison  ·  Payment schedule", fill="#C4B0E8", font=font_tag)

out = OUT_DIR / "feature-graphic-1024x500.png"
canvas.convert("RGB").save(out, "PNG", optimize=True)
print("wrote", out, canvas.size)
