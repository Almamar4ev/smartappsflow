"""Preview how the new emiGo art survives Android's adaptive-icon mask.

Android shows only the inner 72/108 (66.7%) of the foreground layer. Art that
runs to the edge loses its outer third. Run from smartloan/assets/brand-emigo.
"""
from PIL import Image, ImageDraw

SRC = "icon-master-1254.png"
SAFE = 72 / 108  # visible fraction of the adaptive foreground

src = Image.open(SRC).convert("RGBA")
side = 512
art = src.resize((side, side), Image.LANCZOS)

# What a round launcher would show if this art were used as-is.
crop = int(side * SAFE)
off = (side - crop) // 2
masked = Image.new("RGBA", (side, side), (255, 255, 255, 0))
inner = art.crop((off, off, off + crop, off + crop)).resize((side, side), Image.LANCZOS)
circle = Image.new("L", (side, side), 0)
ImageDraw.Draw(circle).ellipse((0, 0, side - 1, side - 1), fill=255)
masked.paste(inner, (0, 0), circle)

# Side by side, with the safe-zone circle drawn over the original.
guide = art.copy()
d = ImageDraw.Draw(guide)
d.ellipse((off, off, off + crop, off + crop), outline=(255, 60, 60, 255), width=5)

out = Image.new("RGBA", (side * 2 + 24, side), (245, 245, 248, 255))
out.paste(guide, (0, 0))
out.paste(masked, (side + 24, 0), masked)
out.convert("RGB").save("_preview-adaptive-crop.png")
print("wrote _preview-adaptive-crop.png")
