"""Build emiGo brand assets from the master icon, then a review collage.

Outputs land in assets/brand-emigo/out/ — production files are NOT touched.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

MASTER = HERE / "icon-master-1254.png"
BG = (0x3A, 0x1D, 0x7A)          # deep purple — chosen splash / adaptive background
SAFE = 72 / 108                  # Android adaptive visible fraction
ICON = 1024
SPLASH = 2732

src = Image.open(MASTER).convert("RGBA")

# ── 1. Solid background layer (Android adaptive) ─────────────────────────────
bg = Image.new("RGB", (ICON, ICON), BG)
bg.save(OUT / "icon-background.png")

# ── 2. Foreground: art shrunk into the safe zone on a transparent canvas ─────
# The master already includes a purple rounded square. For the adaptive
# foreground we want ONLY the chart+coin, so we first crop the art off the
# purple plate by detecting the near-edge purple and punching it out, then
# scale the remaining art to fill ~66% of the canvas (the safe zone).
#
# Simpler and more reliable for this asset: the whole rounded-square icon IS
# the brand mark. Place that whole mark inside the safe zone so Android's
# circle/squircle crop never clips the arrow tip or the coin.
art_side = int(ICON * SAFE)                          # 682
art = src.resize((art_side, art_side), Image.LANCZOS)
fg = Image.new("RGBA", (ICON, ICON), (0, 0, 0, 0))
off = (ICON - art_side) // 2
fg.paste(art, (off, off), art)
fg.save(OUT / "icon-foreground.png")

# ── 3. icon-only: full mark on the solid purple (used for splash icon + store) ─
only = Image.new("RGBA", (ICON, ICON), (*BG, 255))
# Use the master resized to fill the whole canvas — this is the store/PWA look
only_mark = src.resize((ICON, ICON), Image.LANCZOS)
only = only_mark  # master already has the purple plate baked in
only.convert("RGB").save(OUT / "icon-only.png")
only.convert("RGBA").save(OUT / "icon-only-rgba.png")

# ── 4. Web / PWA icons ───────────────────────────────────────────────────────
for size, name in ((192, "icon-192.png"), (512, "icon-512.png")):
    src.resize((size, size), Image.LANCZOS).convert("RGB").save(OUT / name)

# Maskable 512: same as icon-only (full bleed) — safe for adaptive web install.
src.resize((512, 512), Image.LANCZOS).convert("RGB").save(OUT / "icon-maskable-512.png")

# ── 5. Splash source: large canvas, brand mark centred ───────────────────────
splash = Image.new("RGB", (SPLASH, SPLASH), BG)
mark = src.resize((1100, 1100), Image.LANCZOS)
splash.paste(mark, ((SPLASH - 1100) // 2, (SPLASH - 1100) // 2), mark)
splash.save(OUT / "splash-source.png")

# ── 6. Android 12+ splash_icon mock (540 art on 1152 canvas) ─────────────────
splash_icon = Image.new("RGBA", (1152, 1152), (0, 0, 0, 0))
small = src.resize((540, 540), Image.LANCZOS)
splash_icon.paste(small, ((1152 - 540) // 2, (1152 - 540) // 2), small)
splash_icon.save(OUT / "splash_icon-mock.png")

print("wrote layers to", OUT)

# ── 7. Review collage ────────────────────────────────────────────────────────
try:
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
    big = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 28)
    small_f = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
except OSError:
    font = big = small_f = ImageFont.load_default()

W, H = 1280, 1680
collage = Image.new("RGB", (W, H), "#F4F5F8")
d = ImageDraw.Draw(collage)
d.text((40, 28), "emiGo — brand review (not yet applied)", fill="#1a1a2e", font=big)
d.text((40, 68), "Splash / adaptive background: #3A1D7A   ·   Launcher label: emiGo", fill="#555", font=small_f)

# Row 1: store / web icons
y = 110
labels_r1 = [
    (OUT / "icon-512.png", "Store / PWA 512"),
    (OUT / "icon-192.png", "PWA 192"),
    (OUT / "icon-maskable-512.png", "Maskable 512"),
]
x = 40
for path, label in labels_r1:
    im = Image.open(path).convert("RGB").resize((220, 220), Image.LANCZOS)
    # rounded preview
    mask = Image.new("L", (220, 220), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 219, 219), radius=48, fill=255)
    tile = Image.new("RGB", (220, 220), "#F4F5F8")
    tile.paste(im, (0, 0), mask)
    collage.paste(tile, (x, y))
    d.text((x, y + 230), label, fill="#333", font=font)
    x += 260

# Row 2: adaptive layers + what Android shows
y = 400
d.text((40, y - 30), "Android adaptive layers", fill="#1a1a2e", font=font)

fg_im = Image.open(OUT / "icon-foreground.png").convert("RGBA").resize((220, 220), Image.LANCZOS)
# Checkerboard behind transparent foreground
chk = Image.new("RGB", (220, 220), "#ddd")
for yy in range(0, 220, 16):
    for xx in range(0, 220, 16):
        if (xx // 16 + yy // 16) % 2 == 0:
            ImageDraw.Draw(chk).rectangle((xx, yy, xx + 15, yy + 15), fill="#eee")
chk.paste(fg_im, (0, 0), fg_im)
collage.paste(chk, (40, y))
d.text((40, y + 230), "Foreground (safe zone)", fill="#333", font=font)

bg_im = Image.open(OUT / "icon-background.png").convert("RGB").resize((220, 220), Image.LANCZOS)
collage.paste(bg_im, (300, y))
d.text((300, y + 230), "Background #3A1D7A", fill="#333", font=font)

# Composited: bg + fg, then circular cropped (what many launchers show)
comp = Image.new("RGBA", (220, 220), (*BG, 255))
comp.paste(fg_im, (0, 0), fg_im)
circ = Image.new("L", (220, 220), 0)
ImageDraw.Draw(circ).ellipse((0, 0, 219, 219), fill=255)
shown = Image.new("RGBA", (220, 220), (0, 0, 0, 0))
shown.paste(comp, (0, 0), circ)
# paste on white so the circle is visible
pad = Image.new("RGB", (220, 220), "#F4F5F8")
pad.paste(shown.convert("RGB"), (0, 0), shown)
collage.paste(pad, (560, y))
d.text((560, y + 230), "Launcher (circle crop)", fill="#333", font=font)

# Squircle composite
squ = Image.new("L", (220, 220), 0)
ImageDraw.Draw(squ).rounded_rectangle((0, 0, 219, 219), radius=48, fill=255)
shown2 = Image.new("RGBA", (220, 220), (0, 0, 0, 0))
shown2.paste(comp, (0, 0), squ)
pad2 = Image.new("RGB", (220, 220), "#F4F5F8")
pad2.paste(shown2.convert("RGB"), (0, 0), shown2)
collage.paste(pad2, (820, y))
d.text((820, y + 230), "Launcher (squircle)", fill="#333", font=font)

# Row 3: splash phone mock
y = 700
d.text((40, y - 30), "Splash screen (phone mock)", fill="#1a1a2e", font=font)
phone_w, phone_h = 320, 640
phone = Image.new("RGB", (phone_w, phone_h), BG)
mark = Image.open(MASTER).convert("RGBA").resize((150, 150), Image.LANCZOS)
phone.paste(mark, ((phone_w - 150) // 2, (phone_h - 150) // 2 - 20), mark)
# draw a soft rounded bezel
bezel = Image.new("RGBA", (phone_w + 16, phone_h + 16), (0, 0, 0, 0))
ImageDraw.Draw(bezel).rounded_rectangle((0, 0, phone_w + 15, phone_h + 15), radius=28, fill=(30, 30, 40, 255))
bezel.paste(phone, (8, 8))
collage.paste(bezel.convert("RGB"), (40, y))
d.text((40, y + phone_h + 28), "Background #3A1D7A + centred mark", fill="#333", font=font)

# Name / listing card
card_x, card_y = 420, y
ImageDraw.Draw(collage).rounded_rectangle((card_x, card_y, card_x + 800, card_y + 360), radius=16, fill="#ffffff", outline="#ddd")
# tiny icon
tiny = Image.open(OUT / "icon-512.png").convert("RGB").resize((96, 96), Image.LANCZOS)
tm = Image.new("L", (96, 96), 0)
ImageDraw.Draw(tm).rounded_rectangle((0, 0, 95, 95), radius=22, fill=255)
tpad = Image.new("RGB", (96, 96), "#fff")
tpad.paste(tiny, (0, 0), tm)
collage.paste(tpad, (card_x + 28, card_y + 28))

d.text((card_x + 140, card_y + 36), "emiGo: EMI & Loan", fill="#1a1a2e", font=big)
d.text((card_x + 140, card_y + 72), "Under the icon on the home screen:  emiGo", fill="#555", font=font)
d.text((card_x + 28, card_y + 150), "Short description (Play — 80 chars max):", fill="#333", font=font)
d.text((card_x + 28, card_y + 185), "EMI, loan & mortgage calculator with bank", fill="#1a1a2e", font=font)
d.text((card_x + 28, card_y + 210), "comparison & payment schedule", fill="#1a1a2e", font=font)
d.text((card_x + 28, card_y + 260), "Inside the app (unchanged for now — review later):", fill="#555", font=small_f)
d.text((card_x + 28, card_y + 285), "EN  Smart Loan Calculator", fill="#333", font=small_f)
d.text((card_x + 28, card_y + 305), "AR  حاسبة القروض الذكية", fill="#333", font=small_f)
d.text((card_x + 28, card_y + 325), "ES  Calculadora de Préstamos", fill="#333", font=small_f)

# Footer notes
d.text((40, H - 80), "Package ID stays com.smartapps.smartloanadvisor  ·  Backup tag stays SmartLoanCalculator", fill="#777", font=small_f)
d.text((40, H - 55), "Nothing in production has been changed yet — approve and I will apply.", fill="#777", font=small_f)

collage.save(OUT / "_REVIEW.png")
print("wrote review collage", OUT / "_REVIEW.png")
