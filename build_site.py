#!/usr/bin/env python3
"""Build a static deployable site into dist/."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

FILES = [
    "dashboard.html",
    "dashboard.css",
    "dashboard.js",
    "README.md",
]

DATA_FILES = [
    "data/auto_sales_history.json",
    "reports/data_validation.md",
]


def copy_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def main() -> int:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    for file_name in FILES:
        copy_file(ROOT / file_name, DIST / file_name)
    for file_name in DATA_FILES:
        source = ROOT / file_name
        if source.exists():
            copy_file(source, DIST / file_name)
    (DIST / "index.html").write_text(
        '<!doctype html><meta charset="utf-8">'
        '<meta http-equiv="refresh" content="0; url=dashboard.html">'
        '<title>新能源车企销量时间序列</title>'
        '<a href="dashboard.html">打开新能源车企销量时间序列</a>\n',
        encoding="utf-8",
    )
    print(f"built {DIST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
