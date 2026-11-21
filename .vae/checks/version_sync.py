"""Release metadata agrees with package.json: README title, CHANGELOG head, README dependency pins, the site's
agent reference and its install instructions, which name the npm package (human decision 2026-11-20: no tarball
downloads on the site). Exits 1 and prints each mismatch with its fix."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
pkg = json.loads((root / "package.json").read_text())
version, deps = pkg["version"], pkg.get("dependencies", {})
problems = []


def first(path, pattern):
    m = re.search(pattern, (root / path).read_text(), re.M)
    return m.group(1) if m else None


if (v := first("README.md", r"\A# defuss-db (\S+)")) != version:
    problems.append(f"README.md:1 title says {v}; write '# defuss-db {version}'")
if (v := first("CHANGELOG.md", r"^## (\d+\.\d+\.\d+)")) != version:
    problems.append(f"CHANGELOG.md newest entry is {v}; add '## {version}' at the top")
for line_no, line in enumerate((root / "README.md").read_text().splitlines(), 1):
    for name, pinned in re.findall(r"\*\*(defuss-[a-z]+) (\d+\.\d+\.\d+)\*\*", line):
        if name in deps and deps[name] != pinned:
            problems.append(f"README.md:{line_no} names {name} {pinned}; package.json pins {deps[name]}")
if (v := first("docs/llms.txt", r"\A# defuss-db (\S+)")) != version:
    problems.append(f"docs/llms.txt says {v}; run `make site`")
install = (root / "website/examples/install.sh").read_text()
if f"bun add {pkg['name']}" not in install or f"npm install {pkg['name']}" not in install:
    problems.append(f"website/examples/install.sh must install '{pkg['name']}' from npm with bun and npm")
if "downloads/" in (root / "docs/index.html").read_text():
    problems.append("docs/index.html links a downloaded tarball; install instructions use npm; run `make site`")
for p in problems:
    print("FAIL", p)
sys.exit(1 if problems else 0)
