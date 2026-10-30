"""Replace play-listing assets with latest Edgeory ChatGPT exports from Downloads."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

DOWNLOADS = Path.home() / "Downloads"
PLAY = Path(__file__).resolve().parent / "play-listing"
SOURCE = PLAY / "source"

# Final approved set (last 9 in Downloads)
MAP = [
    ("ChatGPT Image Aug 26, 2026, 04_39_54 AM (9).png", "00-icon-source.png", "icon"),
    ("ChatGPT Image Aug 26, 2026, 04_39_51 AM (1).png", "01-dashboard-overview.png", "phone"),
    ("ChatGPT Image Aug 26, 2026, 04_39_51 AM (2).png", "02-dashboard-charts.png", "phone"),
    ("ChatGPT Image Aug 26, 2026, 05_19_10 AM (1).png", "03-trade-log.png", "phone"),
    ("ChatGPT Image Aug 26, 2026, 04_39_52 AM (5).png", "04-calendar.png", "phone"),
    ("ChatGPT Image Aug 26, 2026, 04_39_51 AM (3).png", "05-analytics.png", "phone"),
    ("ChatGPT Image Aug 26, 2026, 04_39_53 AM (6).png", "06-calculators.png", "phone"),
    ("ChatGPT Image Aug 26, 2026, 05_19_10 AM (2).png", "07-accounts-backup.png", "phone"),
    ("ChatGPT Image Aug 26, 2026, 05_19_10 AM (3).png", "08-daily-journal.png", "phone"),
]


def clear_old() -> None:
    PLAY.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    for p in list(SOURCE.glob("*.png")) + list(PLAY.glob("0*.png")):
        p.unlink()
        print("deleted", p.name)
    for name in ("icon-512.png",):
        p = PLAY / name
        if p.exists():
            p.unlink()
            print("deleted", name)


def move_sources() -> None:
    for src_name, dest_name, _kind in MAP:
        src = DOWNLOADS / src_name
        if not src.exists():
            raise FileNotFoundError(src_name)
        dest = SOURCE / dest_name
        shutil.move(str(src), str(dest))
        print("moved", src_name, "->", dest_name)


def crop_icon_content(im: Image.Image) -> Image.Image:
    """Remove solid black letterbox around the squircle if present."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    # find non-near-black bounds
    def is_bg(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        return r < 18 and g < 18 and b < 18

    top = 0
    while top < h and all(is_bg(x, top) for x in range(0, w, 4)):
        top += 1
    bot = h - 1
    while bot > top and all(is_bg(x, bot) for x in range(0, w, 4)):
        bot -= 1
    left = 0
    while left < w and all(is_bg(left, y) for y in range(top, bot + 1, 4)):
        left += 1
    right = w - 1
    while right > left and all(is_bg(right, y) for y in range(top, bot + 1, 4)):
        right -= 1
    if right - left < w * 0.5 or bot - top < h * 0.5:
        return rgb
    return rgb.crop((left, top, right + 1, bot + 1))


def export_assets() -> None:
    for path in sorted(SOURCE.glob("*.png")):
        im = Image.open(path)
        if path.name.startswith("00-icon"):
            cropped = crop_icon_content(im)
            # pad to square then 512
            side = max(cropped.size)
            square = Image.new("RGB", (side, side), (0, 0, 0))
            ox = (side - cropped.size[0]) // 2
            oy = (side - cropped.size[1]) // 2
            square.paste(cropped, (ox, oy))
            out = square.resize((512, 512), Image.Resampling.LANCZOS)
            out_path = PLAY / "icon-512.png"
            out.save(out_path, format="PNG", optimize=True)
            print(f"ICON {out_path.name}: {out.size} from {im.size} crop={cropped.size} {out_path.stat().st_size/1024:.0f}KB")
            # also refresh in-app icons
            app = Path(__file__).resolve().parents[1]
            out.save(app / "icon-512.png", format="PNG", optimize=True)
            out.resize((192, 192), Image.Resampling.LANCZOS).save(
                app / "icon-192.png", format="PNG", optimize=True
            )
            print("updated app icon-512.png / icon-192.png")
        else:
            rgb = im.convert("RGB")
            out_path = PLAY / path.name
            rgb.save(out_path, format="PNG", optimize=True)
            w, h = rgb.size
            ratio = max(w, h) / min(w, h)
            ok = 320 <= w <= 3840 and 320 <= h <= 3840 and ratio <= 2.0 and out_path.stat().st_size <= 8 * 1024 * 1024
            print(f"{'PASS' if ok else 'FAIL'} {out_path.name}: {w}x{h} {out_path.stat().st_size/1024:.0f}KB ratio={ratio:.3f}")


def main() -> None:
    clear_old()
    move_sources()
    export_assets()
    print("DONE")


if __name__ == "__main__":
    main()
