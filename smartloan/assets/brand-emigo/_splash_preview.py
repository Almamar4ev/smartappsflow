"""Mock up the Android 12+ splash for each candidate background colour.

The real pipeline centres the icon art (540px inside a 1152 canvas) on a solid
colour, so the mock-up uses the same proportion. Run from this folder.
"""
from PIL import Image, ImageDraw, ImageFont

ART = "icon-master-1254.png"
PANEL = (420, 780)
CANDIDATES = [
    ("#221B3E", "Current dark navy"),
    ("#3A1D7A", "Deep purple"),
    ("#4C22A0", "Mid purple (icon average)"),
]

art = Image.open(ART).convert("RGBA")

# Average the outer ring of the icon: that is its background gradient.
ring, n = [0, 0, 0], 0
w, h = art.size
band = int(w * 0.06)
for x in range(0, w, 7):
    for y in list(range(0, band, 7)) + list(range(h - band, h, 7)):
        r, g, b, _ = art.getpixel((x, y))
        ring[0] += r; ring[1] += g; ring[2] += b; n += 1
avg = tuple(v // n for v in ring)
print("icon background average: #%02X%02X%02X" % avg)

try:
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 20)
    small = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
except OSError:
    font = small = ImageFont.load_default()

gap = 20
out = Image.new("RGB", (PANEL[0] * len(CANDIDATES) + gap * (len(CANDIDATES) + 1), PANEL[1] + 70), "#f1f1f5")
d = ImageDraw.Draw(out)

icon = art.resize((int(PANEL[0] * 0.42),) * 2, Image.LANCZOS)
for i, (hexcol, label) in enumerate(CANDIDATES):
    x = gap + i * (PANEL[0] + gap)
    panel = Image.new("RGBA", PANEL, hexcol)
    panel.paste(icon, ((PANEL[0] - icon.width) // 2, (PANEL[1] - icon.height) // 2), icon)
    out.paste(panel.convert("RGB"), (x, 12))
    d.text((x, PANEL[1] + 22), f"{label}", fill="#111", font=font)
    d.text((x, PANEL[1] + 46), hexcol, fill="#555", font=small)

out.save("_preview-splash-options.png")
print("wrote _preview-splash-options.png")
