"""Move final TradeMory store images into play-listing and export Play-ready sizes."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

DOWNLOADS = Path.home() / "Downloads"
ROOT = Path(__file__).resolve().parent
PLAY = ROOT / "play-listing"
SOURCE = PLAY / "source"

PHONE_SIZE = (1080, 1920)
ICON_SIZE = (512, 512)

# Final approved set (last 9 in Downloads)
FILES = [
    ("ChatGPT Image Aug 21, 2026, 10_56_11 AM (9).png", "00-icon-source.png", "icon"),
    ("ChatGPT Image Aug 21, 2026, 11_18_55 AM (2).png", "01-dashboard-overview.png", "phone"),
    ("ChatGPT Image Aug 21, 2026, 10_56_07 AM (2).png", "02-dashboard-charts.png", "phone"),
    ("ChatGPT Image Aug 21, 2026, 10_56_08 AM (3).png", "03-trade-log.png", "phone"),
    ("ChatGPT Image Aug 21, 2026, 10_56_08 AM (4).png", "04-calendar.png", "phone"),
    ("ChatGPT Image Aug 21, 2026, 11_27_29 AM.png", "05-analytics.png", "phone"),
    ("ChatGPT Image Aug 21, 2026, 10_56_09 AM (6).png", "06-calculators.png", "phone"),
    ("ChatGPT Image Aug 21, 2026, 10_56_10 AM (7).png", "07-accounts-backup.png", "phone"),
    ("ChatGPT Image Aug 21, 2026, 10_56_11 AM (8).png", "08-daily-journal.png", "phone"),
]

# Old graphic trees / loose files to remove after play-listing is ready
DELETE_PATHS = [
    ROOT / "hires",
    ROOT / "icon-candidates",
    ROOT / "v4-teal-soft",
    ROOT / "v4-white",
    ROOT / "_raw",
    ROOT / "__pycache__",
    ROOT / "app-icon-512.png",
    ROOT / "feature-graphic-1024x500.png",
    ROOT / "store-01-dashboard.png",
    ROOT / "store-02-equity-curve.png",
    ROOT / "store-03-trade-log.png",
    ROOT / "store-04-analytics.png",
    ROOT / "store-05-calculators.png",
    ROOT / "store-06-accounts.png",
]


def move_sources() -> None:
    PLAY.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    for src_name, dest_name, _kind in FILES:
        src = DOWNLOADS / src_name
        if not src.exists():
            raise FileNotFoundError(f"Missing in Downloads: {src_name}")
        dest = SOURCE / dest_name
        if dest.exists():
            dest.unlink()
        shutil.move(str(src), str(dest))
        print(f"MOVED {src_name} -> source/{dest_name}")


def export_play_ready() -> list[str]:
    lines: list[str] = []
    for path in sorted(SOURCE.glob("*.png")):
        im = Image.open(path).convert("RGB")
        if path.name.startswith("00-icon"):
            out = im.resize(ICON_SIZE, Image.Resampling.LANCZOS)
            out_path = PLAY / "icon-512.png"
            out.save(out_path, format="PNG", optimize=True)
            lines.append(
                f"ICON {out_path.name}: {out.size[0]}x{out.size[1]} "
                f"(from {im.size[0]}x{im.size[1]}) {out_path.stat().st_size / 1024:.0f} KB"
            )
        else:
            out = im.resize(PHONE_SIZE, Image.Resampling.LANCZOS)
            out_path = PLAY / path.name
            out.save(out_path, format="PNG", optimize=True)
            ratio = max(out.size) / min(out.size)
            lines.append(
                f"PHONE {out_path.name}: {out.size[0]}x{out.size[1]} "
                f"(from {im.size[0]}x{im.size[1]}) {out_path.stat().st_size / 1024:.0f} KB "
                f"ratio={ratio:.3f}"
            )
    return lines


def validate() -> bool:
    ok = True
    icon = PLAY / "icon-512.png"
    im = Image.open(icon)
    icon_ok = im.size == ICON_SIZE and im.mode == "RGB"
    print(("PASS" if icon_ok else "FAIL"), f"icon-512.png {im.size} mode={im.mode}")
    ok = ok and icon_ok

    for path in sorted(PLAY.glob("0[1-8]-*.png")):
        im = Image.open(path)
        w, h = im.size
        ratio = max(w, h) / min(w, h)
        size_ok = 320 <= w <= 3840 and 320 <= h <= 3840 and ratio <= 2.0
        fmt_ok = im.mode in ("RGB", "L")
        mb_ok = path.stat().st_size <= 8 * 1024 * 1024
        phone_rec = (w, h) == PHONE_SIZE
        passed = size_ok and fmt_ok and mb_ok
        print(
            ("PASS" if passed else "FAIL"),
            path.name,
            f"{w}x{h}",
            f"mode={im.mode}",
            f"{path.stat().st_size / 1e6:.2f}MB",
            f"ratio={ratio:.3f}",
            ("recommended-1080x1920" if phone_rec else "not-recommended-size"),
        )
        ok = ok and passed
    return ok


def delete_old() -> None:
    for path in DELETE_PATHS:
        if not path.exists():
            continue
        if path.is_dir():
            shutil.rmtree(path)
            print(f"DELETED DIR {path.name}")
        else:
            path.unlink()
            print(f"DELETED FILE {path.name}")


def write_readme(export_lines: list[str], all_ok: bool) -> None:
    text = f"""TradeMory — Google Play listing graphics (final)
================================================

Folder: tradelogpro/store-graphics/play-listing/

Upload to Play Console
----------------------
1) App icon (High-res):  icon-512.png
2) Phone screenshots (order 01 → 08):
   01-dashboard-overview.png
   02-dashboard-charts.png
   03-trade-log.png
   04-calendar.png
   05-analytics.png
   06-calculators.png
   07-accounts-backup.png
   08-daily-journal.png

source/ keeps the original ChatGPT exports (native resolution).

Google Play checks (phone screenshots)
--------------------------------------
- Format: JPEG or 24-bit PNG (no alpha)  → RGB PNG
- Each side: 320–3840 px
- Long side ≤ 2× short side (9:16 OK)
- Max file size: 8 MB
- Recommended phone size: 1080 × 1920
- High-res icon: exactly 512 × 512

Export summary
--------------
{chr(10).join(export_lines)}

Validation: {"ALL PASSED" if all_ok else "FAILED — do not upload"}

Note
----
Feature graphic (1024 × 500) is still required by Play and is NOT in this set.
Create/upload it separately in Play Console.
"""
    (PLAY / "README.txt").write_text(text, encoding="utf-8")


def main() -> None:
    move_sources()
    lines = export_play_ready()
    print("\n".join(lines))
    print("\nVALIDATION:")
    all_ok = validate()
    write_readme(lines, all_ok)
    delete_old()
    print("\nDONE →", PLAY)
    print("ALL_OK" if all_ok else "HAS_FAILURES")


if __name__ == "__main__":
    main()
