from pathlib import Path
import shutil

dst = Path(r"c:\Users\DELL\Documents\GitHub\smartappsflow\tradelogpro\store-graphics\_raw")
marker = "20260814_060017"
roots = [
    Path(r"C:\Users\DELL\.cursor\projects\c-Users-DELL-Documents-GitHub-smartappsflow-tradelogpro\assets"),
    Path(r"C:\Users\DELL\AppData\Roaming\Cursor\User\workspaceStorage\a88e1b4365e58c8027ddc15e2370fbb5\images"),
]
found = []
for root in roots:
    if not root.exists():
        continue
    for p in root.rglob("*.png"):
        if marker in p.name and "TradeLog" in p.name:
            found.append((p.stat().st_size, p))
if not found:
    raise SystemExit("calendar screenshot not found")
found.sort(reverse=True)
src = found[0][1]
out = dst / "07-calendar.png"
shutil.copy2(src, out)
print("copied", src, "->", out, found[0][0])
