"""
TradeLog Pro — icon variants + Play listing v2 (icon-blue palette).
Keeps existing store-01..06 files; writes v2-* and icon candidates.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "_raw"
OUT = ROOT / "v2-blue"
HIRES = OUT / "hires"
ICON_DIR = ROOT / "icon-candidates"
SRC_ICON = ROOT.parent / "icon-512.png"

PHONE_W, PHONE_H = 1024, 1536
HIRES_W, HIRES_H = 2160, 3240

# Sampled from icon-512.png
ICON_BLUE = (33, 89, 226)
ICON_BLUE_DEEP = (18, 48, 150)
ICON_BLUE_MID = (46, 110, 235)
ICON_BLUE_PALE = (232, 239, 255)
CANVAS_WHITE = (244, 247, 251)
WHITE = (255, 255, 255)
ACCENT = (33, 89, 226)


def font(size: int, bold: bool = False):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_rect_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def draw_mini_chart(draw, x, y, w, h, color=(255, 255, 255, 230), width=7):
    """Upward polyline + 3 candlestick-like bars — trading journal cue."""
    pts = [
        (x, y + int(h * 0.78)),
        (x + int(w * 0.22), y + int(h * 0.55)),
        (x + int(w * 0.40), y + int(h * 0.62)),
        (x + int(w * 0.62), y + int(h * 0.32)),
        (x + int(w * 0.82), y + int(h * 0.18)),
        (x + w, y + int(h * 0.08)),
    ]
    draw.line(pts, fill=color, width=width, joint="curve")
    # last point arrow
    ax, ay = pts[-1]
    draw.polygon(
        [(ax, ay), (ax - 14, ay + 10), (ax - 4, ay + 12)],
        fill=color[:3] + (255,) if len(color) == 4 else color,
    )


def make_icon_journal(path: Path):
    """Keep white canvas + blue tile; add chart mark under TL."""
    size = 512
    img = Image.new("RGBA", (size, size), CANVAS_WHITE + (255,))
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    pad = 56
    r = 96
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=r, fill=ICON_BLUE + (255,))
    f = font(168, bold=True)
    # TL
    text = "TL"
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) // 2
    ty = 128
    d.text((tx, ty), text, font=f, fill=WHITE + (255,))
    # chart under letters
    draw_mini_chart(d, 128, 318, 256, 88, color=(255, 255, 255, 235), width=8)
    img.alpha_composite(tile)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print("wrote", path)


def make_icon_fullbleed(path: Path):
    """Full-bleed Play icon: blue rounded field + TL + chart (no white margin)."""
    size = 512
    img = Image.new("RGBA", (size, size), ICON_BLUE + (255,))
    d = ImageDraw.Draw(img)
    f = font(176, bold=True)
    text = "TL"
    bbox = d.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    d.text(((size - tw) // 2, 118), text, font=f, fill=WHITE + (255,))
    draw_mini_chart(d, 110, 330, 292, 96, color=(255, 255, 255, 235), width=9)
    img.save(path, "PNG")
    print("wrote", path)


def make_background(w, h, variant="blue"):
    img = Image.new("RGB", (w, h))
    px = img.load()
    if variant == "white":
        top, bot = (248, 250, 255), (226, 234, 252)
        for y in range(h):
            c = lerp(top, bot, y / max(h - 1, 1))
            for x in range(w):
                px[x, y] = c
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.ellipse([-w * 0.2, -h * 0.1, w * 0.7, h * 0.45], fill=ICON_BLUE + (28,))
        od.ellipse([int(w * 0.45), int(h * 0.55), w + 80, h + 80], fill=(33, 89, 226, 22))
        overlay = overlay.filter(ImageFilter.GaussianBlur(max(24, w // 40)))
        return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    # royal blue matching icon
    top, mid, bot = ICON_BLUE_DEEP, ICON_BLUE, ICON_BLUE_MID
    for y in range(h):
        t = y / max(h - 1, 1)
        c = lerp(top, mid, t / 0.5) if t < 0.5 else lerp(mid, bot, (t - 0.5) / 0.5)
        for x in range(w):
            px[x, y] = c
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    orbs = [
        (int(w * 0.18), int(h * 0.12), int(w * 0.50), (255, 255, 255, 28)),
        (int(w * 0.82), int(h * 0.22), int(w * 0.42), (120, 170, 255, 50)),
        (int(w * 0.10), int(h * 0.78), int(w * 0.48), (10, 30, 120, 50)),
        (int(w * 0.70), int(h * 0.85), int(w * 0.40), (180, 205, 255, 32)),
    ]
    for cx, cy, r, col in orbs:
        od.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    overlay = overlay.filter(ImageFilter.GaussianBlur(max(26, w // 36)))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def draw_phone(screenshot: Image.Image, scale: float = 1.0) -> Image.Image:
    bezel = int(16 * scale)
    radius = int(48 * scale)
    island_w = int(112 * scale)
    island_h = int(32 * scale)
    island_y = int(16 * scale)
    screen_w = int(640 * scale)
    sw, sh = screenshot.size
    screen_h = int(screen_w * sh / sw)
    phone_w = screen_w + bezel * 2
    phone_h = screen_h + bezel * 2
    phone = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(phone)
    draw.rounded_rectangle([0, 0, phone_w - 1, phone_h - 1], radius=radius, fill=(16, 18, 22, 255))
    draw.rounded_rectangle(
        [2, 2, phone_w - 3, phone_h - 3],
        radius=radius - 2,
        outline=(90, 96, 110, 255),
        width=max(1, int(2 * scale)),
    )
    screen = screenshot.convert("RGBA").resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    phone.paste(screen, (bezel, bezel), rounded_mask((screen_w, screen_h), radius - bezel))
    ix0 = (phone_w - island_w) // 2
    draw.rounded_rectangle(
        [ix0, island_y, ix0 + island_w, island_y + island_h],
        radius=island_h // 2,
        fill=(6, 6, 8, 255),
    )
    return phone


def drop_shadow(phone, blur=32, offset=(0, 36), opacity=140):
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


def tilt_phone(img: Image.Image, degrees: float = 7.0) -> Image.Image:
    """Slight 3D yaw via perspective."""
    w, h = img.size
    # shrink source a bit so rotation doesn't clip badly
    k = 0.08
    dx = int(w * k)
    src = (0, 0, w, 0, w, h, 0, h)
    # right side shorter → slight turn
    dst = (dx, int(h * 0.04), w - 4, 0, w - 4, h, dx, h - int(h * 0.04))
    return img.transform(img.size, Image.Transform.PERSPECTIVE, [
        *src[:2], *dst[:2],
        *src[2:4], *dst[2:4],
        *src[4:6], *dst[4:6],
        *src[6:8], *dst[6:8],
    ], resample=Image.Resampling.BICUBIC)


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


def callout_card(text_main, text_sub, dark=False, scale=1.0):
    pad_x, pad_y = int(26 * scale), int(18 * scale)
    f_main = font(int(34 * scale), bold=True)
    f_sub = font(int(18 * scale), bold=False)
    tmp = Image.new("RGB", (10, 10))
    d = ImageDraw.Draw(tmp)
    mw = max(d.textlength(text_main, font=f_main), d.textlength(text_sub, font=f_sub))
    w = int(mw + pad_x * 2 + 10)
    h = int(pad_y * 2 + 34 * scale + 8 * scale + 20 * scale)
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    fill = (20, 32, 72, 245) if dark else (255, 255, 255, 248)
    t1 = WHITE + (255,) if dark else (18, 32, 70, 255)
    t2 = (180, 200, 255, 255) if dark else (90, 110, 150, 255)
    draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=int(20 * scale), fill=fill)
    draw.rounded_rectangle([0, 0, int(8 * scale), h - 1], radius=int(4 * scale), fill=ICON_BLUE + (255,))
    draw.text((pad_x, pad_y), text_main, font=f_main, fill=t1)
    draw.text((pad_x, pad_y + int(38 * scale)), text_sub, font=f_sub, fill=t2)
    return card


def compose_store(screenshot_path, headline, subhead, callout, out_name, variant="blue", tilt=True, dark_text=False):
    shot = Image.open(screenshot_path).convert("RGB")
    bg = make_background(PHONE_W, PHONE_H, variant=variant)
    phone = draw_phone(shot, scale=1.0)
    target_phone_w = int(PHONE_W * 0.64)
    ratio = target_phone_w / phone.width
    phone = phone.resize((target_phone_w, int(phone.height * ratio)), Image.Resampling.LANCZOS)
    # Keep the phone face-on (Smart Loan style). Perspective warp was clipping the frame.
    phone_s = drop_shadow(phone, blur=34, offset=(0, 32), opacity=130)

    max_phone_h = int(PHONE_H * 0.70)
    if phone_s.height > max_phone_h:
        r = max_phone_h / phone_s.height
        phone_s = phone_s.resize((int(phone_s.width * r), max_phone_h), Image.Resampling.LANCZOS)

    canvas = bg.convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    title_color = (18, 36, 90, 255) if dark_text else WHITE + (255,)
    sub_color = (70, 90, 140, 230) if dark_text else (230, 238, 255, 235)

    f_h = font(52, bold=True)
    f_s = font(24, bold=False)
    max_tw = int(PHONE_W * 0.88)
    h_lines = wrap_text(draw, headline, f_h, max_tw)
    s_lines = wrap_text(draw, subhead, f_s, max_tw)
    y = 46
    for line in h_lines:
        tw = draw.textlength(line, font=f_h)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_h, fill=title_color)
        y += 60
    y += 4
    for line in s_lines:
        tw = draw.textlength(line, font=f_s)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_s, fill=sub_color)
        y += 32

    px = (PHONE_W - phone_s.width) // 2
    py = max(y + 16, int(PHONE_H * 0.21))
    if py + phone_s.height > PHONE_H - 16:
        py = PHONE_H - phone_s.height - 16
    canvas.alpha_composite(phone_s, (px, py))

    if callout:
        card = callout_card(callout[0], callout[1], dark=variant == "white")
        sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
        sh.putalpha(card.split()[-1].point(lambda a: min(90, a)))
        sh = sh.filter(ImageFilter.GaussianBlur(12))
        cx = int(PHONE_W * 0.05)
        cy = min(py + int(phone_s.height * 0.68), PHONE_H - card.height - 28)
        canvas.alpha_composite(sh, (cx + 6, cy + 10))
        canvas.alpha_composite(card, (cx, cy))

    out_rgb = canvas.convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    HIRES.mkdir(parents=True, exist_ok=True)
    out_path = OUT / out_name
    out_rgb.save(out_path, "PNG", optimize=True)
    stem = out_name.replace(".png", "")
    out_rgb.resize((HIRES_W, HIRES_H), Image.Resampling.LANCZOS).save(
        HIRES / f"{stem}-2160x3240.png", "PNG", optimize=True
    )
    print("wrote", out_path.name)


def feature_graphic(icon_path: Path):
    w, h = 1024, 500
    bg = make_background(w, h, "blue").convert("RGBA")
    draw = ImageDraw.Draw(bg)
    icon = Image.open(icon_path).convert("RGBA").resize((168, 168), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    shadow.putalpha(icon.split()[-1].point(lambda a: min(90, a)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    iy = (h - 168) // 2
    bg.alpha_composite(shadow, (52, iy + 8))
    bg.alpha_composite(icon, (44, iy))
    f_title = font(46, bold=True)
    f_sub = font(22, bold=False)
    tx = 240
    draw.text((tx, 155), "TradeLog Pro", font=f_title, fill=WHITE + (255,))
    draw.text((tx, 222), "Trading journal  ·  P&L  ·  calculators", font=f_sub, fill=(220, 230, 255, 245))
    draw.text((tx, 262), "Offline-first. Built for serious traders.", font=f_sub, fill=(190, 210, 255, 230))
    path = OUT / "feature-graphic-1024x500.png"
    bg.convert("RGB").save(path, "PNG", optimize=True)
    print("wrote", path.name)


SCREENS = [
    dict(raw="01-dashboard-kpis.png", out="store-v2-01-dashboard.png", variant="blue",
         headline="See your edge at a glance",
         subhead="Balance, net P&L, win rate, and R:R — one dashboard.",
         callout= ("+$5,676.21", "Net P&L  ·  +24.45% of capital")),
    dict(raw="02-dashboard-charts.png", out="store-v2-02-equity-curve.png", variant="white",
         headline="Watch your equity grow",
         subhead="Charts that show the story of every session.",
         callout=("Equity Curve", "Growth you can actually see")),
    dict(raw="03-trade-log.png", out="store-v2-03-trade-log.png", variant="blue",
         headline="Log every trade clearly",
         subhead="Filter wins, losses, and open positions in seconds.",
         callout=("+$814.15", "FLNC  ·  +81.40% closed")),
    dict(raw="04-analytics.png", out="store-v2-04-analytics.png", variant="white",
         headline="Pro-grade trading analytics",
         subhead="Win rate, profit factor, streaks, and best trades.",
         callout=("94.7%", "Win rate  ·  18 wins, 1 loss")),
    dict(raw="05-pnl-calc.png", out="store-v2-05-calculators.png", variant="blue",
         headline="Trading calculators built in",
         subhead="P&L, position size, compound growth, stock average.",
         callout=("+$350.00", "P&L  ·  +35% on the trade")),
    dict(raw="06-accounts.png", out="store-v2-06-accounts.png", variant="white",
         headline="Accounts, backup & export",
         subhead="Multi-account tracking with Excel and PDF reports.",
         callout=("XTB 1", "+$446.12  ·  100% win rate")),
]


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    journal = ICON_DIR / "icon-512-tl-chart.png"
    fullbleed = ICON_DIR / "icon-512-fullbleed-chart.png"
    make_icon_journal(journal)
    make_icon_fullbleed(fullbleed)

    for s in SCREENS:
        compose_store(
            RAW / s["raw"], s["headline"], s["subhead"], s["callout"],
            s["out"], variant=s["variant"], tilt=True, dark_text=s["variant"] == "white",
        )
    feature_graphic(journal)
    # convenience copies next to listing files
    Image.open(journal).save(OUT / "app-icon-512-tl-chart.png", "PNG")
    Image.open(fullbleed).save(OUT / "app-icon-512-fullbleed-chart.png", "PNG")
    print("done ->", OUT)


if __name__ == "__main__":
    main()
