"""
v4: professional white (varied 3D callouts) + muted teal set + turquoise journal icon.
Removes v3-slate and v2-blue listing folders after generating v4.
"""
from __future__ import annotations

from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "_raw"
ICON_DIR = ROOT / "icon-candidates"
BLUE_ICON = ICON_DIR / "icon-512-tl-chart.png"
if not BLUE_ICON.exists():
    BLUE_ICON = ROOT.parent / "icon-512.png"

PHONE_W, PHONE_H = 1024, 1536
HIRES_W, HIRES_H = 2160, 3240

# Muted teal (not neon turquoise)
TEAL = (38, 138, 132)          # icon fill
TEAL_DEEP = (28, 92, 96)
TEAL_SOFT_TOP = (46, 110, 118)
TEAL_SOFT_BOT = (62, 148, 142)
ICON_BLUE = (33, 89, 226)
SLATE = (36, 40, 48)
WHITE = (255, 255, 255)
OFFWHITE = (246, 247, 249)


def font(size: int, bold: bool = False):
    for path in (
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _fill_rect(px, x0, y0, x1, y1, color, w, h):
    """Inclusive pixel fill — no PIL rectangle rounding."""
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(w - 1, x1)
    y1 = min(h - 1, y1)
    col = color + (255,) if len(color) == 3 else color
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[x, y] = col


def make_turquoise_icon(path: Path):
    """Flat journal (no fake perspective) + thick centered candlesticks."""
    size = 512
    img = Image.new("RGBA", (size, size), TEAL + (255,))
    d = ImageDraw.Draw(img)

    # Flat notebook — stacked pages on the right created a skew illusion
    d.rounded_rectangle([108, 72, 404, 440], radius=26, fill=(252, 253, 252, 255))
    d.rounded_rectangle([108, 72, 162, 440], radius=20, fill=(24, 86, 84, 255))
    d.rectangle([144, 88, 162, 424], fill=(24, 86, 84, 255))
    for cy in (148, 256, 364):
        d.ellipse([122, cy - 18, 158, cy + 18], fill=TEAL + (255,))
        d.ellipse([130, cy - 9, 150, cy + 9], fill=(252, 253, 252, 255))
    d.polygon([(366, 72), (392, 72), (379, 122)], fill=(24, 86, 84, 255))

    px = img.load()
    ink, ink_down = TEAL, (196, 72, 72)
    body_w, wick_w = 36, 12  # wick = 1/3 body; survives preview scaling
    gap = 16
    # 4 candles, group centered on the page (page inner ~162..404)
    group_w = 4 * body_w + 3 * gap
    left0 = 162 + (404 - 162 - group_w) // 2
    candles = [
        (left0 + 0 * (body_w + gap), 214, 78, 26, 22, True),
        (left0 + 1 * (body_w + gap), 164, 128, 30, 24, True),
        (left0 + 2 * (body_w + gap), 198, 94, 24, 22, False),
        (left0 + 3 * (body_w + gap), 186, 106, 28, 24, True),
    ]
    for left, top, bh, wu, wd, up in candles:
        col = ink if up else ink_down
        cx = left + body_w // 2
        wx0 = cx - wick_w // 2
        wx1 = wx0 + wick_w - 1
        _fill_rect(px, wx0, top - wu, wx1, top - 1, col, size, size)
        _fill_rect(px, left, top, left + body_w - 1, top + bh - 1, col, size, size)
        _fill_rect(px, wx0, top + bh, wx1, top + bh + wd - 1, col, size, size)

    d.rectangle([left0, 352, left0 + group_w - 1, 355], fill=(200, 214, 210, 255))

    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print("wrote", path.name)


def make_background(w, h, variant: str) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    if variant == "white":
        top, bot = (250, 251, 253), (236, 238, 242)
        for y in range(h):
            c = lerp(top, bot, y / max(h - 1, 1))
            for x in range(w):
                px[x, y] = c
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        # large soft discs
        od.ellipse([-80, int(h * 0.35), int(w * 0.55), int(h * 0.95)], fill=(210, 214, 220, 50))
        od.ellipse([int(w * 0.45), int(h * 0.05), w + 60, int(h * 0.42)], fill=(220, 224, 230, 40))
        overlay = overlay.filter(ImageFilter.GaussianBlur(42))
        base = Image.alpha_composite(img.convert("RGBA"), overlay)
        # faint dot grid (Smart Loan style)
        dots = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        dd = ImageDraw.Draw(dots)
        for gx in range(40, w - 20, 28):
            for gy in range(30, 160, 28):
                dd.ellipse([gx, gy, gx + 3, gy + 3], fill=(160, 166, 176, 35))
        return Image.alpha_composite(base, dots).convert("RGB")

    # muted teal gradient
    for y in range(h):
        t = y / max(h - 1, 1)
        c = lerp(TEAL_DEEP, TEAL_SOFT_BOT, t)
        for x in range(w):
            px[x, y] = c
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([int(w * -0.15), int(h * 0.45), int(w * 0.7), h + 80], fill=(90, 190, 180, 45))
    od.ellipse([int(w * 0.4), -80, w + 100, int(h * 0.4)], fill=(20, 70, 80, 50))
    overlay = overlay.filter(ImageFilter.GaussianBlur(48))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def draw_phone(screenshot: Image.Image) -> Image.Image:
    bezel, radius = 16, 48
    island_w, island_h, island_y = 112, 32, 16
    screen_w = 640
    sw, sh = screenshot.size
    screen_h = int(screen_w * sh / sw)
    phone_w, phone_h = screen_w + bezel * 2, screen_h + bezel * 2
    phone = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(phone)
    draw.rounded_rectangle([0, 0, phone_w - 1, phone_h - 1], radius=radius, fill=(20, 22, 26, 255))
    draw.rounded_rectangle(
        [2, 2, phone_w - 3, phone_h - 3],
        radius=radius - 2,
        outline=(120, 124, 132, 255),
        width=2,
    )
    screen = screenshot.convert("RGBA").resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    phone.paste(screen, (bezel, bezel), rounded_mask((screen_w, screen_h), radius - bezel))
    ix0 = (phone_w - island_w) // 2
    draw.rounded_rectangle(
        [ix0, island_y, ix0 + island_w, island_y + island_h],
        radius=island_h // 2,
        fill=(8, 8, 10, 255),
    )
    return phone


def drop_shadow(img, blur=28, offset=(0, 22), opacity=130):
    w, h = img.size
    pad = blur * 3
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shadow.putalpha(img.split()[-1].point(lambda a: min(opacity, a)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(shadow, (pad + offset[0], pad + offset[1]), shadow)
    canvas.paste(img, (pad, pad), img)
    return canvas


def wrap_text(draw, text, fnt, max_width):
    words, lines, cur = text.split(), [], ""
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


def card_rect(main, sub, style: str, accent):
    """style: dark | light | light-wide"""
    f_main = font(32 if style != "light-wide" else 28, True)
    f_sub = font(16, False)
    tmp = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    mw = max(tmp.textlength(main, font=f_main), tmp.textlength(sub, font=f_sub))
    pad_x, pad_y = 24, 16
    w = int(mw + pad_x * 2 + 12)
    if style == "light-wide":
        w = max(w, 420)
    h = 78 if style != "light-wide" else 72
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    if style == "dark":
        fill, t1, t2 = (32, 36, 42, 250), WHITE + (255,), (176, 182, 190, 255)
    else:
        fill, t1, t2 = (255, 255, 255, 250), SLATE + (255,), (100, 108, 118, 255)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=18, fill=fill)
    d.rounded_rectangle([0, 0, 8, h - 1], radius=4, fill=accent + (255,))
    d.text((pad_x, pad_y - 2), main, font=f_main, fill=t1)
    d.text((pad_x, pad_y + 34), sub, font=f_sub, fill=t2)
    return card


def pill_badge(main, sub, accent):
    f_main, f_sub = font(26, True), font(14, False)
    tmp = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    w = int(max(tmp.textlength(main, font=f_main), tmp.textlength(sub, font=f_sub)) + 88)
    h = 64
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=32, fill=(255, 255, 255, 250))
    d.ellipse([10, 12, 50, 52], fill=accent + (255,))
    d.text((64, 8), main, font=f_main, fill=SLATE + (255,))
    d.text((64, 36), sub, font=f_sub, fill=(110, 116, 126, 255))
    return card


def circle_stat(value, label, accent):
    s = 168
    card = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.ellipse([4, 4, s - 5, s - 5], fill=(255, 255, 255, 250))
    d.ellipse([14, 14, s - 15, s - 15], outline=accent + (255,), width=8)
    f_v, f_l = font(36, True), font(13, False)
    tw = d.textlength(value, font=f_v)
    d.text(((s - tw) / 2, 52), value, font=f_v, fill=SLATE + (255,))
    tw2 = d.textlength(label, font=f_l)
    d.text(((s - tw2) / 2, 100), label, font=f_l, fill=(110, 116, 126, 255))
    return card


def mini_bars_card(title, accent):
    w, h = 210, 150
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=20, fill=(255, 255, 255, 250))
    d.text((16, 12), title, font=font(16, True), fill=SLATE + (255,))
    bars = [0.55, 0.38, 0.92, 0.48, 0.70]
    base_y, max_h = 128, 78
    bw = 22
    gap = 12
    x0 = 22
    for i, t in enumerate(bars):
        bh = int(max_h * t)
        x = x0 + i * (bw + gap)
        d.rounded_rectangle([x, base_y - bh, x + bw, base_y], radius=5, fill=accent + (int(160 + 80 * t),))
    return card


def calendar_strip(accent):
    w, h = 460, 70
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=18, fill=(255, 255, 255, 250))
    d.text((16, 12), "Daily P&L", font=font(18, True), fill=SLATE + (255,))
    d.text((16, 38), "Green wins  ·  Red losses", font=font(14, False), fill=(110, 116, 126, 255))
    # dots
    colors = [(46, 160, 90), (46, 160, 90), (200, 70, 70), (46, 160, 90), (180, 180, 180)]
    x = 268
    for col in colors:
        d.rounded_rectangle([x, 18, x + 28, 50], radius=8, fill=col + (220,))
        x += 36
    return card


def paste_callout(canvas, piece, xy):
    sh = Image.new("RGBA", piece.size, (0, 0, 0, 0))
    sh.putalpha(piece.split()[-1].point(lambda a: min(100, a)))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    x, y = xy
    canvas.alpha_composite(sh, (x + 6, y + 10))
    canvas.alpha_composite(piece, (x, y))


def compose(shot_path, headline, subhead, out_dir, out_name, variant, callout_kind, callout_data, accent):
    shot = Image.open(shot_path).convert("RGB")
    bg = make_background(PHONE_W, PHONE_H, variant)
    phone = draw_phone(shot)
    target_w = int(PHONE_W * 0.62)
    ratio = target_w / phone.width
    phone = phone.resize((target_w, int(phone.height * ratio)), Image.Resampling.LANCZOS)
    phone_s = drop_shadow(phone, blur=30, offset=(0, 24), opacity=100 if variant == "teal" else 145)

    max_h = int(PHONE_H * 0.68)
    if phone_s.height > max_h:
        r = max_h / phone_s.height
        phone_s = phone_s.resize((int(phone_s.width * r), max_h), Image.Resampling.LANCZOS)

    canvas = bg.convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    if variant == "white":
        title_c, sub_c = SLATE + (255,), (92, 98, 108, 255)
    else:
        title_c, sub_c = WHITE + (255,), (220, 236, 232, 240)

    f_h, f_s = font(50, True), font(22, False)
    y = 44
    for line in wrap_text(draw, headline, f_h, int(PHONE_W * 0.88)):
        tw = draw.textlength(line, font=f_h)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_h, fill=title_c)
        y += 56
    y += 2
    for line in wrap_text(draw, subhead, f_s, int(PHONE_W * 0.88)):
        tw = draw.textlength(line, font=f_s)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_s, fill=sub_c)
        y += 28

    px = (PHONE_W - phone_s.width) // 2
    py = max(y + 12, int(PHONE_H * 0.20))
    if py + phone_s.height > PHONE_H - 12:
        py = PHONE_H - phone_s.height - 12
    canvas.alpha_composite(phone_s, (px, py))

    # callout placements relative to phone box
    pw, ph = phone_s.size
    kinds = {
        "bl_light": ("light", (px - 20, py + int(ph * 0.72))),
        "ml_dark": ("dark", (px - 36, py + int(ph * 0.42))),
        "mr_light": ("light", (px + int(pw * 0.58), py + int(ph * 0.38))),
        "br_light": ("light", (px + int(pw * 0.42), py + int(ph * 0.74))),
        "bc_wide": ("wide", (px + (pw - 460) // 2, py + int(ph * 0.82))),
        "tr_circle": ("circle", (px + int(pw * 0.62), py + int(ph * 0.10))),
        "tr_pill": ("pill", (px + int(pw * 0.48), py + int(ph * 0.08))),
        "ml_bars": ("bars", (px - 28, py + int(ph * 0.48))),
    }

    kind = callout_kind
    main, sub = callout_data
    if kind == "bl_light":
        piece = card_rect(main, sub, "light", accent)
        xy = kinds[kind][1]
    elif kind == "ml_dark":
        piece = card_rect(main, sub, "dark", accent)
        xy = kinds[kind][1]
    elif kind == "mr_light":
        piece = card_rect(main, sub, "light", accent)
        xy = kinds[kind][1]
    elif kind == "br_light":
        piece = card_rect(main, sub, "light", accent)
        xy = kinds[kind][1]
    elif kind == "bc_wide":
        piece = calendar_strip(accent)
        xy = kinds[kind][1]
    elif kind == "tr_circle":
        piece = circle_stat(main, sub, accent)
        xy = kinds[kind][1]
    elif kind == "tr_pill":
        piece = pill_badge(main, sub, accent)
        xy = kinds[kind][1]
    elif kind == "ml_bars":
        piece = mini_bars_card(main, accent)
        xy = kinds[kind][1]
    else:
        piece = card_rect(main, sub, "light", accent)
        xy = (px, py + int(ph * 0.7))

    # clamp
    x, y2 = xy
    x = max(12, min(x, PHONE_W - piece.width - 12))
    y2 = max(12, min(y2, PHONE_H - piece.height - 16))
    paste_callout(canvas, piece, (x, y2))

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "hires").mkdir(exist_ok=True)
    rgb = canvas.convert("RGB")
    rgb.save(out_dir / out_name, "PNG", optimize=True)
    rgb.resize((HIRES_W, HIRES_H), Image.Resampling.LANCZOS).save(
        out_dir / "hires" / out_name.replace(".png", "-2160x3240.png"), "PNG", optimize=True
    )
    print("wrote", variant, out_name)


def feature_graphic(out_dir: Path, variant: str, icon_path: Path):
    w, h = 1024, 500
    bg = make_background(w, h, variant).convert("RGBA")
    draw = ImageDraw.Draw(bg)
    icon = Image.open(icon_path).convert("RGBA").resize((168, 168), Image.Resampling.LANCZOS)
    sh = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    sh.putalpha(icon.split()[-1].point(lambda a: min(90, a)))
    sh = sh.filter(ImageFilter.GaussianBlur(12))
    iy = (h - 168) // 2
    bg.alpha_composite(sh, (52, iy + 8))
    bg.alpha_composite(icon, (44, iy))
    title = SLATE + (255,) if variant == "white" else WHITE + (255,)
    sub = (92, 98, 108, 255) if variant == "white" else (220, 236, 232, 240)
    draw.text((240, 155), "TradeLog Pro", font=font(46, True), fill=title)
    draw.text((240, 222), "Trading journal  ·  P&L  ·  calculators", font=font(22, False), fill=sub)
    draw.text((240, 262), "Offline-first. Built for serious traders.", font=font(22, False), fill=sub)
    bg.convert("RGB").save(out_dir / "feature-graphic-1024x500.png", "PNG", optimize=True)
    print("wrote", variant, "feature-graphic")


SCREENS = [
    # raw, out, headline, sub, callout_kind, (main, sub)
    ("01-dashboard-kpis.png", "store-01-dashboard.png",
     "See your edge at a glance",
     "Balance, net P&L, win rate, and R:R — one dashboard.",
     "bl_light", ("+$5,676.21", "Net P&L  ·  +24.45% of capital")),
    ("02-dashboard-charts.png", "store-02-equity-curve.png",
     "Watch your equity grow",
     "Charts that show the story of every session.",
     "ml_bars", ("P&L by symbol", "")),
    ("03-trade-log.png", "store-03-trade-log.png",
     "Log every trade clearly",
     "Filter wins, losses, and open positions in seconds.",
     "ml_dark", ("+$814.15", "FLNC  ·  +81.40% closed")),
    ("07-calendar.png", "store-04-calendar.png",
     "See P&L by day",
     "Green days, red days — your month at a glance.",
     "bc_wide", ("Daily P&L", "Green wins · Red losses")),
    ("04-analytics.png", "store-05-analytics.png",
     "Pro-grade trading analytics",
     "Win rate, profit factor, streaks, and best trades.",
     "tr_circle", ("94.7%", "Win rate")),
    ("05-pnl-calc.png", "store-06-calculators.png",
     "Trading calculators built in",
     "P&L, position size, compound growth, stock average.",
     "br_light", ("+$350.00", "P&L  ·  +35% on the trade")),
    ("06-accounts.png", "store-07-accounts.png",
     "Accounts, backup & export",
     "Multi-account tracking with Excel and PDF reports.",
     "tr_pill", ("XTB 1", "+$446.12  ·  100% WR")),
]


def rm_dir(p: Path):
    if p.exists():
        shutil.rmtree(p)
        print("removed", p.name)


def main():
    teal_icon = ICON_DIR / "icon-512-turquoise-journal.png"
    make_turquoise_icon(teal_icon)

    sets = [
        ("white", ROOT / "v4-white", BLUE_ICON, ICON_BLUE),
        ("teal", ROOT / "v4-teal-soft", teal_icon, TEAL),
    ]
    for variant, folder, icon, accent in sets:
        for raw, out, h, s, kind, data in SCREENS:
            compose(RAW / raw, h, s, folder, out, variant, kind, data, accent)
        feature_graphic(folder, variant, icon)
        Image.open(icon).save(folder / "app-icon-512.png", "PNG")

    # user asked to drop slate + royal-blue listing sets
    rm_dir(ROOT / "v3-slate")
    rm_dir(ROOT / "v2-blue")
    print("done")


if __name__ == "__main__":
    main()
