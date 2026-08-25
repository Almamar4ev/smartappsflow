"""
TradeLog Pro — Play Store framed screenshots (Smart Loan style).
Outputs phone (1024x1536) + hires (2160x3240) + feature graphic (1024x500).
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "_raw"
OUT = ROOT
HIRES = ROOT / "hires"
ICON = ROOT.parent / "icon-512.png"

PHONE_W, PHONE_H = 1024, 1536
HIRES_W, HIRES_H = 2160, 3240

# Trading / investment palette (not Smart Loan purple)
BG_TOP = (14, 42, 78)       # deep navy
BG_MID = (22, 78, 110)      # teal-navy
BG_BOT = (16, 120, 110)     # soft teal
ACCENT = (45, 180, 140)     # mint
WHITE = (255, 255, 255)
CARD_BG = (255, 255, 255)
SHADOW = (0, 0, 0)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_background(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        if t < 0.55:
            c = lerp(BG_TOP, BG_MID, t / 0.55)
        else:
            c = lerp(BG_MID, BG_BOT, (t - 0.55) / 0.45)
        for x in range(w):
            px[x, y] = c

    # Soft bokeh orbs
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    orbs = [
        (int(w * 0.12), int(h * 0.18), int(w * 0.55), (80, 160, 200, 55)),
        (int(w * 0.72), int(h * 0.08), int(w * 0.48), (40, 200, 170, 45)),
        (int(w * 0.85), int(h * 0.55), int(w * 0.42), (30, 100, 180, 40)),
        (int(w * 0.05), int(h * 0.72), int(w * 0.50), (20, 160, 140, 35)),
        (int(w * 0.45), int(h * 0.88), int(w * 0.35), (100, 180, 220, 30)),
    ]
    for cx, cy, r, col in orbs:
        od.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=max(28, w // 35)))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    return img


def rounded_mask(size, radius: int) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def draw_phone(screenshot: Image.Image, scale: float = 1.0) -> Image.Image:
    """Return RGBA phone with screenshot inside bezel."""
    # Device outer size relative to canvas later; work in pixel units
    bezel = int(18 * scale)
    radius = int(52 * scale)
    island_w = int(120 * scale)
    island_h = int(34 * scale)
    island_y = int(18 * scale)

    # Target screen area inside phone
    screen_w = int(620 * scale)
    # Keep screenshot aspect
    sw, sh = screenshot.size
    screen_h = int(screen_w * sh / sw)

    phone_w = screen_w + bezel * 2
    phone_h = screen_h + bezel * 2

    phone = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(phone)

    # Outer frame (near-black)
    draw.rounded_rectangle(
        [0, 0, phone_w - 1, phone_h - 1],
        radius=radius,
        fill=(18, 20, 24, 255),
    )
    # Thin silver rim
    draw.rounded_rectangle(
        [2, 2, phone_w - 3, phone_h - 3],
        radius=radius - 2,
        outline=(70, 74, 82, 255),
        width=max(1, int(2 * scale)),
    )

    # Screen
    screen = screenshot.convert("RGBA").resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    screen_mask = rounded_mask((screen_w, screen_h), radius - bezel)
    phone.paste(screen, (bezel, bezel), screen_mask)

    # Dynamic Island
    ix0 = (phone_w - island_w) // 2
    iy0 = island_y
    draw.rounded_rectangle(
        [ix0, iy0, ix0 + island_w, iy0 + island_h],
        radius=island_h // 2,
        fill=(8, 8, 10, 255),
    )
    return phone


def drop_shadow(phone: Image.Image, blur: int = 28, offset=(0, 28), opacity: int = 110) -> Image.Image:
    w, h = phone.size
    pad = blur * 3
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", phone.size, (0, 0, 0, 0))
    alpha = phone.split()[-1]
    shadow.putalpha(alpha.point(lambda a: min(opacity, a)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    ox, oy = offset
    canvas.paste(shadow, (pad + ox, pad + oy), shadow)
    canvas.paste(phone, (pad, pad), phone)
    return canvas


def wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def callout_card(text_main: str, text_sub: str, scale: float = 1.0) -> Image.Image:
    pad_x, pad_y = int(28 * scale), int(20 * scale)
    f_main = font(int(36 * scale), bold=True)
    f_sub = font(int(20 * scale), bold=False)
    # measure
    tmp = Image.new("RGB", (10, 10))
    d = ImageDraw.Draw(tmp)
    mw = max(d.textlength(text_main, font=f_main), d.textlength(text_sub, font=f_sub))
    w = int(mw + pad_x * 2)
    h = int(pad_y * 2 + 36 * scale + 8 * scale + 22 * scale)
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=int(22 * scale), fill=(255, 255, 255, 245))
    # accent bar
    draw.rounded_rectangle([0, 0, int(8 * scale), h - 1], radius=int(4 * scale), fill=ACCENT + (255,))
    draw.text((pad_x, pad_y), text_main, font=f_main, fill=(15, 35, 55, 255))
    draw.text((pad_x, pad_y + int(40 * scale)), text_sub, font=f_sub, fill=(90, 110, 130, 255))
    return card


def compose_store(
    screenshot_path: Path,
    headline: str,
    subhead: str,
    callout: tuple[str, str] | None,
    out_name: str,
):
    shot = Image.open(screenshot_path).convert("RGB")
    bg = make_background(PHONE_W, PHONE_H)

    # Phone sized to fit under text
    scale = 1.0
    phone = draw_phone(shot, scale=scale)
    # Resize phone so width ~ 62% of canvas
    target_phone_w = int(PHONE_W * 0.62)
    ratio = target_phone_w / phone.width
    phone = phone.resize((target_phone_w, int(phone.height * ratio)), Image.Resampling.LANCZOS)
    phone_s = drop_shadow(phone, blur=26, offset=(0, 22), opacity=100)

    # Fit phone vertically: leave room for headline
    max_phone_h = int(PHONE_H * 0.68)
    if phone_s.height > max_phone_h:
        r = max_phone_h / phone_s.height
        phone_s = phone_s.resize((int(phone_s.width * r), max_phone_h), Image.Resampling.LANCZOS)

    canvas = bg.convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    # Headline
    f_h = font(54, bold=True)
    f_s = font(26, bold=False)
    max_tw = int(PHONE_W * 0.88)
    h_lines = wrap_text(draw, headline, f_h, max_tw)
    s_lines = wrap_text(draw, subhead, f_s, max_tw)

    y = 48
    for line in h_lines:
        tw = draw.textlength(line, font=f_h)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_h, fill=WHITE + (255,))
        y += 62
    y += 6
    for line in s_lines:
        tw = draw.textlength(line, font=f_s)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_s, fill=(220, 240, 245, 230))
        y += 34

    # Place phone centered below text
    px = (PHONE_W - phone_s.width) // 2
    py = max(y + 18, int(PHONE_H * 0.22))
    # If overflowing bottom, nudge up
    if py + phone_s.height > PHONE_H - 20:
        py = PHONE_H - phone_s.height - 20
    canvas.alpha_composite(phone_s, (px, py))

    if callout:
        card = callout_card(callout[0], callout[1], scale=1.0)
        # Soft shadow under callout
        sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
        sh.putalpha(card.split()[-1].point(lambda a: min(90, a)))
        sh = sh.filter(ImageFilter.GaussianBlur(12))
        cx = int(PHONE_W * 0.06)
        cy = min(py + int(phone_s.height * 0.72), PHONE_H - card.height - 36)
        canvas.alpha_composite(sh, (cx + 4, cy + 6))
        canvas.alpha_composite(card, (cx, cy))

    out_rgb = canvas.convert("RGB")
    out_path = OUT / out_name
    out_rgb.save(out_path, "PNG", optimize=True)

    # Hires 2160x3240
    HIRES.mkdir(exist_ok=True)
    hires = out_rgb.resize((HIRES_W, HIRES_H), Image.Resampling.LANCZOS)
    stem = out_name.replace(".png", "")
    hires.save(HIRES / f"{stem}-2160x3240.png", "PNG", optimize=True)
    print("wrote", out_path.name, out_rgb.size, "+", "hires")


def feature_graphic():
    w, h = 1024, 500
    bg = make_background(w, h).convert("RGBA")
    draw = ImageDraw.Draw(bg)

    # Icon
    if ICON.exists():
        icon = Image.open(ICON).convert("RGBA").resize((160, 160), Image.Resampling.LANCZOS)
        # round corners slightly already in asset; add soft shadow
        shadow = Image.new("RGBA", icon.size, (0, 0, 0, 0))
        shadow.putalpha(icon.split()[-1].point(lambda a: min(80, a)))
        shadow = shadow.filter(ImageFilter.GaussianBlur(10))
        bg.alpha_composite(shadow, (56, (h - 160) // 2 + 6))
        bg.alpha_composite(icon, (48, (h - 160) // 2))

    f_title = font(48, bold=True)
    f_sub = font(24, bold=False)
    tx = 240
    draw.text((tx, 160), "TradeLog Pro", font=f_title, fill=WHITE + (255,))
    draw.text((tx, 230), "Trading journal · P&L · calculators", font=f_sub, fill=(210, 235, 240, 240))
    draw.text((tx, 275), "Offline-first. Built for serious traders.", font=f_sub, fill=(180, 210, 220, 220))

    out = bg.convert("RGB")
    path = OUT / "feature-graphic-1024x500.png"
    out.save(path, "PNG", optimize=True)
    print("wrote", path.name, out.size)


SCREENS = [
    {
        "raw": "01-dashboard-kpis.png",
        "out": "store-01-dashboard.png",
        "headline": "See your edge at a glance",
        "subhead": "Balance, net P&L, win rate, and R:R — one dashboard.",
        "callout": ("+$5,676.21", "Net P&L · +24.45% of capital"),
    },
    {
        "raw": "02-dashboard-charts.png",
        "out": "store-02-equity-curve.png",
        "headline": "Watch your equity grow",
        "subhead": "Equity curve and win/loss charts that tell the story.",
        "callout": ("Equity Curve", "Track growth over every session"),
    },
    {
        "raw": "03-trade-log.png",
        "out": "store-03-trade-log.png",
        "headline": "Log every trade clearly",
        "subhead": "Filter wins, losses, and open positions in seconds.",
        "callout": ("+$814.15", "FLNC · +81.40% closed"),
    },
    {
        "raw": "04-analytics.png",
        "out": "store-04-analytics.png",
        "headline": "Pro-grade trading analytics",
        "subhead": "Win rate, profit factor, streaks, and best trades.",
        "callout": ("94.7%", "Win rate · 18 wins, 1 loss"),
    },
    {
        "raw": "05-pnl-calc.png",
        "out": "store-05-calculators.png",
        "headline": "Trading calculators built in",
        "subhead": "P&L, position size, compound growth, stock average.",
        "callout": ("+$350.00", "P&L · +35% on the trade"),
    },
    {
        "raw": "06-accounts.png",
        "out": "store-06-accounts.png",
        "headline": "Accounts, backup & export",
        "subhead": "Multi-account tracking with backup and Excel/PDF reports.",
        "callout": ("XTB 1", "+$446.12 · 100% win rate"),
    },
]


def main():
    missing = [s["raw"] for s in SCREENS if not (RAW / s["raw"]).exists()]
    if missing:
        raise SystemExit(f"Missing raw screenshots: {missing}")

    for s in SCREENS:
        compose_store(
            RAW / s["raw"],
            s["headline"],
            s["subhead"],
            s["callout"],
            s["out"],
        )
    feature_graphic()

    # Convenience copy of app icon for Play Console upload
    if ICON.exists():
        dest = OUT / "app-icon-512.png"
        Image.open(ICON).convert("RGBA").save(dest, "PNG")
        print("wrote", dest.name)


if __name__ == "__main__":
    main()
