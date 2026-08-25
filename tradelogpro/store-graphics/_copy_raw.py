from pathlib import Path
import shutil

dst = Path(r"c:\Users\DELL\Documents\GitHub\smartappsflow\tradelogpro\store-graphics\_raw")
dst.mkdir(parents=True, exist_ok=True)

wanted = {
    "01-dashboard-kpis": "20260813_213127",
    "02-dashboard-charts": "20260813_213153",
    "03-trade-log": "20260813_213213",
    "04-analytics": "20260813_213320",
    "05-pnl-calc": "20260813_213241",
    "06-accounts": "20260813_213326",
}

roots = [
    Path(r"C:\Users\DELL\.cursor\projects\c-Users-DELL-Documents-GitHub-smartappsflow-tradelogpro\assets"),
    Path(r"C:\Users\DELL\AppData\Roaming\Cursor\User\workspaceStorage\a88e1b4365e58c8027ddc15e2370fbb5\images"),
]

found = {k: [] for k in wanted}
for root in roots:
    if not root.exists():
        print("missing", root)
        continue
    for p in root.rglob("*.png"):
        name = p.name
        for key, marker in wanted.items():
            if marker in name and "TradeLog" in name:
                try:
                    size = p.stat().st_size
                except OSError:
                    continue
                found[key].append((size, p))

for key, items in found.items():
    if not items:
        print("MISSING", key)
        continue
    items.sort(reverse=True)
    size, p = items[0]
    out = dst / f"{key}.png"
    shutil.copy2(p, out)
    print(f"OK {key} {size} bytes from {p}")

print("dst contents:")
from PIL import Image

for p in sorted(dst.glob("*.png")):
    im = Image.open(p)
    print(p.name, im.size, p.stat().st_size)
