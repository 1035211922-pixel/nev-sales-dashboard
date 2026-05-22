#!/usr/bin/env python3
"""Collect model-level sales for selected Chinese NEV brands from Gasgoo pages."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
CACHE_DIR = DATA_DIR / "gasgoo_cache"
OUTPUT_PATH = DATA_DIR / "auto_sales_history.json"

START_YEAR = 2024
START_MONTH = 1

MODEL_SOURCES = [
    # 赛力斯 / 问界
    {"brand": "赛力斯", "id": 1991, "model": "问界M5"},
    {"brand": "赛力斯", "id": 2066, "model": "问界M5"},
    {"brand": "赛力斯", "id": 2051, "model": "问界M7"},
    {"brand": "赛力斯", "id": 2324, "model": "问界M9"},
    {"brand": "赛力斯", "id": 2325, "model": "问界M9"},
    {"brand": "赛力斯", "id": 2500, "model": "问界M8"},
    {"brand": "赛力斯", "id": 2546, "model": "问界M8"},
    # 理想
    {"brand": "理想", "id": 2116, "model": "理想L9"},
    {"brand": "理想", "id": 2135, "model": "理想L8"},
    {"brand": "理想", "id": 2187, "model": "理想L7"},
    {"brand": "理想", "id": 2322, "model": "理想MEGA"},
    {"brand": "理想", "id": 2341, "model": "理想L6"},
    {"brand": "理想", "id": 2545, "model": "理想i8"},
    # 小鹏
    {"brand": "小鹏", "id": 1499, "model": "小鹏G3/G3i"},
    {"brand": "小鹏", "id": 1956, "model": "小鹏P5"},
    {"brand": "小鹏", "id": 1811, "model": "小鹏P7"},
    {"brand": "小鹏", "id": 2222, "model": "小鹏G6"},
    {"brand": "小鹏", "id": 2313, "model": "小鹏X9"},
    {"brand": "小鹏", "id": 2402, "model": "小鹏MONA M03"},
    {"brand": "小鹏", "id": 2433, "model": "小鹏P7+"},
    {"brand": "小鹏", "id": 2511, "model": "小鹏G7"},
    # 蔚来集团，包含蔚来、乐道、firefly 萤火虫
    {"brand": "蔚来", "id": 1614, "model": "蔚来ES8"},
    {"brand": "蔚来", "id": 1699, "model": "蔚来ES6"},
    {"brand": "蔚来", "id": 1859, "model": "蔚来EC6"},
    {"brand": "蔚来", "id": 2077, "model": "蔚来ES7"},
    {"brand": "蔚来", "id": 2186, "model": "蔚来EC7"},
    {"brand": "蔚来", "id": 2115, "model": "蔚来ET5"},
    {"brand": "蔚来", "id": 2221, "model": "蔚来ET5T"},
    {"brand": "蔚来", "id": 2416, "model": "乐道L60"},
    {"brand": "蔚来", "id": 2499, "model": "蔚来ET9"},
    {"brand": "蔚来", "id": 2503, "model": "萤火虫"},
    {"brand": "蔚来", "id": 2544, "model": "乐道L90"},
    # 零跑
    {"brand": "零跑", "id": 1825, "model": "零跑T03"},
    {"brand": "零跑", "id": 1957, "model": "零跑C11"},
    {"brand": "零跑", "id": 2225, "model": "零跑C11"},
    {"brand": "零跑", "id": 2117, "model": "零跑C01"},
    {"brand": "零跑", "id": 2241, "model": "零跑C01"},
    {"brand": "零跑", "id": 2314, "model": "零跑C10"},
    {"brand": "零跑", "id": 2315, "model": "零跑C10"},
    {"brand": "零跑", "id": 2379, "model": "零跑C16"},
    {"brand": "零跑", "id": 2392, "model": "零跑C16"},
    {"brand": "零跑", "id": 2481, "model": "零跑B10"},
    {"brand": "零跑", "id": 2524, "model": "零跑B01"},
]

PRICE_MIDPOINT_WAN = {
    "问界M5": 23.99,
    "问界M7": 28.49,
    "问界M8": 40.49,
    "问界M9": 51.49,
    "理想L6": 26.49,
    "理想L7": 33.49,
    "理想L8": 37.49,
    "理想L9": 42.98,
    "理想MEGA": 52.98,
    "理想i8": 35.98,
    "小鹏G3/G3i": 16.89,
    "小鹏G6": 20.49,
    "小鹏G7": 22.00,
    "小鹏MONA M03": 13.48,
    "小鹏P5": 17.59,
    "小鹏P7": 24.49,
    "小鹏P7+": 20.48,
    "小鹏X9": 39.98,
    "乐道L60": 23.49,
    "乐道L90": 31.00,
    "萤火虫": 12.48,
    "蔚来EC6": 39.60,
    "蔚来EC7": 45.80,
    "蔚来ES6": 36.80,
    "蔚来ES7": 43.80,
    "蔚来ES8": 54.80,
    "蔚来ET5": 32.80,
    "蔚来ET5T": 32.80,
    "蔚来ET9": 80.00,
    "零跑B01": 11.50,
    "零跑B10": 12.98,
    "零跑C01": 16.50,
    "零跑C10": 14.98,
    "零跑C11": 16.49,
    "零跑C16": 17.98,
    "零跑T03": 5.99,
}


def months_between(start_year: int, start_month: int, end_year: int, end_month: int) -> List[str]:
    periods = []
    year, month = start_year, start_month
    while (year, month) <= (end_year, end_month):
        periods.append(f"{year}-{month:02d}")
        month += 1
        if month == 13:
            year += 1
            month = 1
    return periods


def fetch_months(end_year: int, end_month: int) -> List[Tuple[int, int]]:
    months = []
    for period in months_between(START_YEAR, START_MONTH, end_year, end_month):
        year, month = map(int, period.split("-"))
        if month in (3, 6, 9, 12) or (year, month) == (end_year, end_month):
            months.append((year, month))
    return months


def fetch_text(url: str, cache_path: Path, offline: bool = False) -> Optional[str]:
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")
    if offline:
        return None
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/124 Safari/537.36",
        },
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        text = response.read().decode("utf-8", errors="ignore")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    time.sleep(0.08)
    return text


def clean_cell(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def normalized_model_name(value: str) -> str:
    value = re.sub(r"\s+", "", value)
    value = value.replace("BEV", "").replace("REEV", "").replace("EV", "")
    return value.strip()


def page_matches_model(page_model: str, expected_model: str) -> bool:
    page = normalized_model_name(page_model)
    expected = normalized_model_name(expected_model)
    if page == expected:
        return True
    # Some pages include a suffix such as version type, but should still start
    # with the same base model name.
    return page.startswith(expected) or expected.startswith(page)


def parse_volume_table(markup: str) -> Optional[Dict[str, Any]]:
    table_match = re.search(r'<table[^>]+class="volumeData"[\s\S]*?</table>', markup)
    if not table_match:
        return None
    rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", table_match.group(0))
    if len(rows) < 2:
        return None
    parsed_rows: List[List[str]] = []
    for row in rows:
        cells = [clean_cell(cell) for cell in re.findall(r"<td[^>]*>([\s\S]*?)</td>", row)]
        if cells:
            parsed_rows.append(cells)
    if len(parsed_rows) < 2:
        return None

    headers = parsed_rows[0][1:]
    model_row = parsed_rows[1]
    brand_row = parsed_rows[2] if len(parsed_rows) > 2 else None
    model_name = model_row[0]
    model_values = {}
    brand_values = {}
    for index, header in enumerate(headers, start=1):
        if not re.fullmatch(r"\d{4}-\d{1,2}", header):
            continue
        value = int(model_row[index]) if index < len(model_row) and model_row[index].isdigit() else 0
        model_values[f"{header[:4]}-{int(header[5:]):02d}"] = value
        if brand_row and index < len(brand_row) and brand_row[index].isdigit():
            brand_values[f"{header[:4]}-{int(header[5:]):02d}"] = int(brand_row[index])

    return {
        "page_model": model_name,
        "model_values": model_values,
        "brand_values": brand_values,
        "brand_row_label": brand_row[0] if brand_row else None,
    }


def default_end_period(today: Optional[dt.date] = None) -> Tuple[int, int]:
    today = today or dt.date.today()
    year = today.year
    month = today.month - 1
    if month == 0:
        year -= 1
        month = 12
    return year, month


def parse_period(value: str) -> Tuple[int, int]:
    match = re.fullmatch(r"(\d{4})-(\d{1,2})", value)
    if not match:
        raise argparse.ArgumentTypeError("period must look like YYYY-MM")
    year = int(match.group(1))
    month = int(match.group(2))
    if month < 1 or month > 12:
        raise argparse.ArgumentTypeError("month must be 1-12")
    return year, month


def collect(offline: bool = False, end_period: Optional[Tuple[int, int]] = None) -> Dict[str, Any]:
    end_year, end_month = end_period or default_end_period()
    periods = months_between(START_YEAR, START_MONTH, end_year, end_month)
    by_period: Dict[str, Dict[str, Any]] = {
        period: {"period": period, "brands": {}} for period in periods
    }
    brand_totals: Dict[str, Dict[str, int]] = {}
    source_urls: List[str] = []
    warnings: List[str] = []

    for source in MODEL_SOURCES:
        brand = source["brand"]
        model = source["model"]
        model_id = source["id"]
        for year, month in fetch_months(end_year, end_month):
            url = f"https://m.gasgoo.com/qcxl/cxxl/{year}/{month}/{model_id}"
            cache_path = CACHE_DIR / f"{year}-{month:02d}-{model_id}.html"
            try:
                markup = fetch_text(url, cache_path, offline=offline)
                if not markup:
                    continue
                parsed = parse_volume_table(markup)
                if not parsed:
                    continue
                if not page_matches_model(parsed["page_model"], model):
                    continue
                source_urls.append(url)
                for period, value in parsed["model_values"].items():
                    if period not in by_period:
                        continue
                    brand_entry = by_period[period]["brands"].setdefault(
                        brand,
                        {"models": {}, "brand_total": None, "estimated_asp_wan": None},
                    )
                    brand_entry["models"][model] = brand_entry["models"].get(model, 0) + value
                for period, value in parsed["brand_values"].items():
                    if period in by_period:
                        brand_totals.setdefault(period, {})[brand] = value
            except Exception as exc:
                warnings.append(f"{brand} {model} {year}-{month:02d} 抓取失败: {exc}")

    for period, brand_map in brand_totals.items():
        for brand, total in brand_map.items():
            by_period[period]["brands"].setdefault(brand, {"models": {}, "brand_total": None})
            by_period[period]["brands"][brand]["brand_total"] = total

    for period_entry in by_period.values():
        for brand, brand_entry in period_entry["brands"].items():
            weighted_price = 0.0
            weighted_units = 0
            for model, units in brand_entry.get("models", {}).items():
                midpoint = PRICE_MIDPOINT_WAN.get(model)
                if midpoint is None or units <= 0:
                    continue
                weighted_price += midpoint * units
                weighted_units += units
            brand_entry["estimated_asp_wan"] = round(weighted_price / weighted_units, 2) if weighted_units else None

    brands = sorted({item["brand"] for item in MODEL_SOURCES}, key=["赛力斯", "理想", "小鹏", "蔚来", "零跑"].index)
    models_by_brand = {
        brand: sorted({item["model"] for item in MODEL_SOURCES if item["brand"] == brand})
        for brand in brands
    }

    return {
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source_note": "盖世汽车单车型销量页；同一基础车型的 EV/BEV/REEV 版本按车型聚合。品牌总量取页面中的厂商品牌行，车型合计与品牌总量可能因统计范围不同而不完全一致。",
        "range": {"start": f"{START_YEAR}-{START_MONTH:02d}", "end": f"{end_year}-{end_month:02d}"},
        "brands": brands,
        "models_by_brand": models_by_brand,
        "price_midpoint_wan": PRICE_MIDPOINT_WAN,
        "periods": [by_period[period] for period in periods],
        "sources": sorted(set(source_urls))[:80],
        "warnings": warnings[:80],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="only use cached pages")
    parser.add_argument("--end", type=parse_period, help="last month to collect, formatted as YYYY-MM")
    args = parser.parse_args()
    DATA_DIR.mkdir(exist_ok=True)
    result = collect(offline=args.offline, end_period=args.end)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT_PATH}")
    print(f"periods: {len(result['periods'])}, brands: {', '.join(result['brands'])}")
    if result.get("warnings"):
        print(f"warnings: {len(result['warnings'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
