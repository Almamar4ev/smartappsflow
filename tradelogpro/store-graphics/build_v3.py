"""
TradeLog Pro store graphics v3: white (Alphavision-like) + slate charcoal.
No royal-blue or turquoise backgrounds.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "_raw"
ICON = ROOT / "icon-candidates" / "icon-512-tl-chart.png"
if not ICON.exists():
    ICON = ROOT.parent / "icon-512.png"

PHONE_W, PHONE_H = 1024, 1536
HIRES_W, HIRES_H = 2160, 3240
ICON_BLUE = (33, 89, 226)
WHITE = (255, 255, 255)


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


def make_background(w, h, variant: str) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    if variant == "white":
        # Cool light grey — like Alphavision, not saturated blue
        top, bot = (246, 247, 249), (232, 234, 238)
        for y in range(h):
            c = lerp(top, bot, y / max(h - 1, 1))
            for x in range(w):
                px[x, y] = c
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.ellipse([int(w * 0.15), int(h * 0.28), int(w * 0.85), int(h * 0.78)], fill=(200, 206, 214, 40))
        overlay = overlay.filter(ImageFilter.GaussianBlur(max(40, w // 22)))
        return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    # Slate / charcoal — dark grey, not pitch black, not blue
    top, bot = (58, 62, 70), (42, 45, 52)
    for y in range(h):
        c = lerp(top, bot, y / max(h - 1, 1))
        for x in range(w):
            px[x, y] = c
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([int(w * 0.08), int(h * 0.22), int(w * 0.92), int(h * 0.82)], fill=(88, 92, 100, 55))
    od.ellipse([-int(w * 0.1), -int(h * 0.05), int(w * 0.55), int(h * 0.35)], fill=(70, 74, 82, 40))
    overlay = overlay.filter(ImageFilter.GaussianBlur(max(36, w // 24)))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def draw_phone(screenshot: Image.Image, scale: float = 1.0) -> Image.Image:
    bezel = int(16 * scale)
    radius = int(48 * scale)
    island_w, island_h, island_y = int(112 * scale), int(32 * scale), int(16 * scale)
    screen_w = int(640 * scale)
    sw, sh = screenshot.size
    screen_h = int(screen_w * sh / sw)
    phone_w, phone_h = screen_w + bezel * 2, screen_h + bezel * 2
    phone = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(phone)
    draw.rounded_rectangle([0, 0, phone_w - 1, phone_h - 1], radius=radius, fill=(22, 24, 28, 255))
    draw.rounded_rectangle(
        [2, 2, phone_w - 3, phone_h - 3],
        radius=radius - 2,
        outline=(110, 114, 122, 255),
        width=max(1, int(2 * scale)),
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


def drop_shadow(phone, blur=36, offset=(0, 28), opacity=150):
    w, h = phone.size
    pad = blur * 3
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", phone.size, (0, 0, 0, 0))
    alpha = phone.split()[-1]
    shadow.putalpha(alpha.point(lambda a: min(opacity, a)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(shadow, (pad + offset[0], pad + offset[1]), shadow)
    canvas.paste(phone, (pad, pad), phone)
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


def callout_card(text_main, text_sub, on_dark: bool):
    """White card on slate; navy card on light grey."""
    pad_x, pad_y = 26, 18
    f_main, f_sub = font(34, True), font(18, False)
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    mw = max(tmp.textlength(text_main, font=f_main), tmp.textlength(text_sub, font=f_sub))
    w = int(mw + pad_x * 2 + 10)
    h = int(pad_y * 2 + 62)
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    if on_dark:
        fill, t1, t2 = (255, 255, 255, 248), (28, 32, 40, 255), (90, 96, 108, 255)
    else:
        fill, t1, t2 = (36, 40, 48, 248), WHITE + (255,), (190, 196, 206, 255)
    draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=20, fill=fill)
    draw.rounded_rectangle([0, 0, 8, h - 1], radius=4, fill=ICON_BLUE + (255,))
    draw.text((pad_x, pad_y), text_main, font=f_main, fill=t1)
    draw.text((pad_x, pad_y + 38), text_sub, font=f_sub, fill=t2)
    return card


def compose(screenshot_path, headline, subhead, callout, out_dir: Path, out_name: str, variant: str):
    shot = Image.open(screenshot_path).convert("RGB")
    bg = make_background(PHONE_W, PHONE_H, variant)
    phone = draw_phone(shot)
    target_w = int(PHONE_W * 0.64)
    ratio = target_w / phone.width
    phone = phone.resize((target_w, int(phone.height * ratio)), Image.Resampling.LANCZOS)
    shadow_op = 90 if variant == "slate" else 140
    phone_s = drop_shadow(phone, blur=32, offset=(0, 26), opacity=shadow_op)
    max_h = int(PHONE_H * 0.70)
    if phone_s.height > max_h:
        r = max_h / phone_s.height
        phone_s = phone_s.resize((int(phone_s.width * r), max_h), Image.Resampling.LANCZOS)

    canvas = bg.convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    if variant == "white":
        title_color, sub_color = (36, 40, 48, 255), (92, 98, 108, 255)
    else:
        title_color, sub_color = WHITE + (255,), (198, 204, 212, 235)

    f_h, f_s = font(50, True), font(23, False)
    max_tw = int(PHONE_W * 0.88)
    y = 48
    for line in wrap_text(draw, headline, f_h, max_tw):
        tw = draw.textlength(line, font=f_h)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_h, fill=title_color)
        y += 58
    y += 4
    for line in wrap_text(draw, subhead, f_s, max_tw):
        tw = draw.textlength(line, font=f_s)
        draw.text(((PHONE_W - tw) / 2, y), line, font=f_s, fill=sub_color)
        y += 30

    px = (PHONE_W - phone_s.width) // 2
    py = max(y + 14, int(PHONE_H * 0.20))
    if py + phone_s.height > PHONE_H - 14:
        py = PHONE_H - phone_s.height - 14
    canvas.alpha_composite(phone_s, (px, py))

    if callout:
        card = callout_card(callout[0], callout[1], on_dark=(variant == "slate"))
        sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
        sh.putalpha(card.split()[-1].point(lambda a: min(80, a)))
        sh = sh.filter(ImageFilter.GaussianBlur(10))
        cx, cy = int(PHONE_W * 0.05), min(py + int(phone_s.height * 0.68), PHONE_H - card.height - 28)
        canvas.alpha_composite(sh, (cx + 5, cy + 8))
        canvas.alpha_composite(card, (cx, cy))

    out_dir.mkdir(parents=True, exist_ok=True)
    hires = out_dir / "hires"
    hires.mkdir(exist_ok=True)
    rgb = canvas.convert("RGB")
    rgb.save(out_dir / out_name, "PNG", optimize=True)
    rgb.resize((HIRES_W, HIRES_H), Image.Resampling.LANCZOS).save(
        hires / out_name.replace(".png", "-2160x3240.png"), "PNG", optimize=True
    )
    print("wrote", variant, out_name)


def feature_graphic(out_dir: Path, variant: str):
    w, h = 1024, 500
    bg = make_background(w, h, variant).convert("RGBA")
    draw = ImageDraw.Draw(bg)
    icon = Image.open(ICON).convert("RGBA").resize((168, 168), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    shadow.putalpha(icon.split()[-1].point(lambda a: min(90, a)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    iy = (h - 168) // 2
    bg.alpha_composite(shadow, (52, iy + 8))
    bg.alpha_composite(icon, (44, iy))
    title = WHITE + (255,) if variant == "slate" else (36, 40, 48, 255)
    sub = (210, 214, 220, 245) if variant == "slate" else (92, 98, 108, 255)
    f_title, f_sub = font(46, True), font(22, False)
    draw.text((240, 155), "TradeLog Pro", font=f_title, fill=title)
    draw.text((240, 222), "Trading journal  ·  P&L  ·  calculators", font=f_sub, fill=sub)
    draw.text((240, 262), "Offline-first. Built for serious traders.", font=f_sub, fill=sub)
    path = out_dir / "feature-graphic-1024x500.png"
    bg.convert("RGB").save(path, "PNG", optimize=True)
    print("wrote", variant, path.name)


SCREENS = [
    ("01-dashboard-kpis.png", "store-01-dashboard.png",
     "See your edge at a glance",
     "Balance, net P&L, win rate, and R:R — one dashboard.",
     ("+$5,676.21", "Net P&L  ·  +24.45% of capital")),
    ("02-dashboard-charts.png", "store-02-equity-curve.png",
     "Watch your equity grow",
     "Charts that show the story of every session.",
     ("Equity Curve", "Growth you can actually see")),
    ("03-trade-log.png", "store-03-trade-log.png",
     "Log every trade clearly",
     "Filter wins, losses, and open positions in seconds.",
     ("+$814.15", "FLNC  ·  +81.40% closed")),
    ("07-calendar.png", "store-04-calendar.png",
     "See P&L by day",
     "Green days, red days — your month at a glance.",
     ("April 2026", "Daily profit and loss")),
    ("04-analytics.png", "store-05-analytics.png",
     "Pro-grade trading analytics",
     "Win rate, profit factor, streaks, and best trades.",
     ("94.7%", "Win rate  ·  18 wins, 1 loss")),
    ("05-pnl-calc.png", "store-06-calculators.png",
     "Trading calculators built in",
     "P&L, position size, compound growth, stock average.",
     ("+$350.00", "P&L  ·  +35% on the trade")),
    ("06-accounts.png", "store-07-accounts.png",
     "Accounts, backup & export",
     "Multi-account tracking with Excel and PDF reports.",
     ("XTB 1", "+$446.12  ·  100% win rate")),
]


def main():
    cal = RAW / "07-calendar.png"
    if not cal.exists():
        raise SystemExit("Missing calendar raw screenshot")

    for variant, folder in (("white", ROOT / "v3-white"), ("slate", ROOT / "v3-slate")):
        for raw, out, h, s, c in SCREENS:
            compose(RAW / raw, h, s, c, folder, out, variant)
        feature_graphic(folder, variant)
        if ICON.exists():
            Image.open(ICON).save(folder / "app-icon-512.png", "PNG")
    print("done")


if __name__ == "__main__":
    main()
