"""Build Play feature graphic + restore phone screenshots from source (no upscale)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PLAY = Path(__file__).resolve().parent / "play-listing"
SOURCE = PLAY / "source"
PHONE = (1080, 1920)  # not used for stretch; sources already Play-valid


def restore_phone_from_source() -> None:
    """Copy native sources as upload assets — sharper than upscaled 1080x1920."""
    for src in sorted(SOURCE.glob("0[1-8]-*.png")):
        im = Image.open(src).convert("RGB")
        out = PLAY / src.name
        im.save(out, format="PNG", optimize=True)
        w, h = im.size
        ratio = max(w, h) / min(w, h)
        assert 320 <= w <= 3840 and 320 <= h <= 3840 and ratio <= 2.0
        assert out.stat().st_size <= 8 * 1024 * 1024
        print(f"PHONE {out.name}: {w}x{h} {out.stat().st_size/1024:.0f}KB (native, no upscale)")


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_candles(draw: ImageDraw.ImageDraw, W: int, H: int) -> None:
    """Faint candlestick watermark like store screenshots."""
    color = (180, 210, 235, 55)
    # Use RGB draw; approximate with light strokes
    ink = (200, 220, 240)
    xs = [40, 90, 140, 880, 930, 980]
    for x in xs:
        for i, base in enumerate(range(80, H - 60, 70)):
            h = 28 + (i * 11) % 40
            open_y = base
            close_y = base + h
            wick_top = open_y - 10
            wick_bot = close_y + 12
            draw.line([(x, wick_top), (x, wick_bot)], fill=ink, width=1)
            draw.rectangle([x - 5, open_y, x + 5, close_y], outline=ink, width=1)


def _rounded_icon(icon: Image.Image, size: int, radius: int) -> Image.Image:
    icon = icon.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(icon, (0, 0), mask)
    return out


def build_feature_graphic() -> Path:
    """1024x500 banner matching TradeMory store screenshot style."""
    W, H = 1024, 500
    # Soft light-blue vertical-ish gradient (matches listing mockups)
    base = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(base)
    for y in range(H):
        t = y / (H - 1)
        # top #E8F3FC -> bottom #F7FBFF
        r = int(232 + (247 - 232) * t)
        g = int(243 + (251 - 243) * t)
        b = int(252 + (255 - 252) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Soft wave / circle accents
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-120, -80, 280, 320), fill=(120, 180, 230, 28))
    od.ellipse((720, 200, 1180, 620), fill=(100, 170, 220, 22))
    od.ellipse((400, -100, 900, 200), fill=(255, 255, 255, 40))
    base = Image.alpha_composite(base.convert("RGBA"), overlay)

    d = ImageDraw.Draw(base)
    _draw_candles(d, W, H)

    # Icon from final asset
    icon_path = PLAY / "icon-512.png"
    if not icon_path.exists():
        icon_path = SOURCE / "00-icon-source.png"
    icon = _rounded_icon(Image.open(icon_path), 220, 48)

    # Soft shadow under icon
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((78, 148, 78 + 220, 148 + 220), radius=48, fill=(20, 60, 110, 35))
    base = Image.alpha_composite(base, shadow)
    base.paste(icon, (78, 140), icon)

    d = ImageDraw.Draw(base)
    title_font = _font(64, bold=True)
    tag_font = _font(28, bold=False)
    sub_font = _font(22, bold=False)

    # Brand + copy (left-aligned after icon)
    text_x = 340
    d.text((text_x, 145), "Edgeory", fill=(15, 40, 90), font=title_font)
    d.text((text_x, 230), "Your Trading Journal", fill=(50, 90, 140), font=tag_font)
    d.text(
        (text_x, 285),
        "Log trades · Track P&L · Sharpen your edge",
        fill=(90, 120, 155),
        font=sub_font,
    )

    # Accent bar (teal/green like growth arrow)
    d.rounded_rectangle((text_x, 340, text_x + 220, 348), radius=4, fill=(46, 180, 120))

    out = PLAY / "feature-graphic-1024x500.png"
    base.convert("RGB").save(out, format="PNG", optimize=True)
    assert Image.open(out).size == (1024, 500)
    print(f"FEATURE {out.name}: 1024x500 {out.stat().st_size/1024:.0f}KB")
    return out


def sharpness(path: Path) -> float:
    im = Image.open(path).convert("L")
    px = list(im.get_flattened_data())
    w, h = im.size
    s = 0
    n = 0
    for y in range(1, h - 1, 2):
        for x in range(1, w - 1, 2):
            i = y * w + x
            s += abs(2 * px[i] - px[i - 1] - px[i + 1]) + abs(
                2 * px[i] - px[i - w] - px[i + w]
            )
            n += 1
    return s / n if n else 0.0


def write_readme() -> None:
    lines = [
        "TradeMory - Google Play listing graphics (final)",
        "================================================",
        "",
        "Folder: tradelogpro/store-graphics/play-listing/",
        "",
        "Upload to Play Console",
        "----------------------",
        "1) App icon (High-res):     icon-512.png",
        "2) Feature graphic:         feature-graphic-1024x500.png",
        "3) Phone screenshots (01 to 08, native 941x1672 — sharper than upscaled):",
        "   01-dashboard-overview.png",
        "   02-dashboard-charts.png",
        "   03-trade-log.png",
        "   04-calendar.png",
        "   05-analytics.png",
        "   06-calculators.png",
        "   07-accounts-backup.png",
        "   08-daily-journal.png",
        "",
        "Quality note",
        "------------",
        "Earlier exports were upscaled to 1080x1920 and lost sharpness.",
        "Phone screenshots are restored from source/ at native 941x1672.",
        "That size fully meets Play rules (320-3840, 9:16, PNG, <8MB).",
        "",
        "source/ keeps the original ChatGPT files.",
    ]
    (PLAY / "README.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    restore_phone_from_source()
    build_feature_graphic()
    print("\nSHARPNESS check (higher = crisper):")
    for name in ["01-dashboard-overview.png", "05-analytics.png"]:
        src = SOURCE / name
        out = PLAY / name
        print(f"  {name}: source={sharpness(src):.2f}  upload={sharpness(out):.2f}")
    icon = PLAY / "icon-512.png"
    print(f"  icon-512.png: {Image.open(icon).size} OK")
    print(f"  feature: {Image.open(PLAY / 'feature-graphic-1024x500.png').size} OK")
    write_readme()
    print("DONE")


if __name__ == "__main__":
    main()
