"""The pinned toolchain agrees with itself: mise.toml pins the Bun that package.json's packageManager names,
and both pinned runtimes satisfy package.json engines. A drift lets recipes run an unsupported global Bun."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
pkg = json.loads((root / "package.json").read_text())
tools = dict(re.findall(r'^(\w+)\s*=\s*"([^"]+)"', (root / "mise.toml").read_text(), re.M))
ver = lambda s: tuple(int(x) for x in re.findall(r"\d+", s)[:3])
problems = []
if pkg.get("packageManager") != f"bun@{tools.get('bun')}":
    problems.append(f"package.json packageManager={pkg.get('packageManager')} but mise.toml bun={tools.get('bun')}")
for tool in ("node", "bun"):
    floor = pkg.get("engines", {}).get(tool, "")
    if tool not in tools:
        problems.append(f"mise.toml pins no {tool}")
    elif not floor.startswith(">="):
        problems.append(f"package.json engines.{tool}={floor!r}; expected '>=<version>'")
    elif ver(tools[tool])[: len(ver(floor))] < ver(floor):
        problems.append(f"mise.toml {tool}={tools[tool]} is below engines.{tool} {floor}")
for p in problems:
    print("FAIL", p)
sys.exit(1 if problems else 0)
