#!/usr/bin/env python3
"""Build static news JSON files from a CSV source.

The script is designed for GitHub Pages scale-out:
- Google Sheet or CSV remains the editorial source.
- The website reads compact static JSON files.
- Article detail data is split into individual files by year and month.

Source priority:
1. NEWS_CSV_URL environment variable
2. data/source/news.csv if present
3. Current public Google Sheet CSV export URL
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sys
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

ROOT = Path(__file__).resolve().parents[1]
SOURCE_CSV = ROOT / "data" / "source" / "news.csv"
PUBLIC_DIR = ROOT / "data" / "public"
DEFAULT_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E/"
    "export?format=csv&gid=748239675"
)

LATEST_LIMIT = int(os.getenv("NEWS_LATEST_LIMIT", "300"))
INDEX_LIMIT = int(os.getenv("NEWS_INDEX_LIMIT", "50000"))


def main() -> int:
    rows = read_source_rows()
    if not rows:
        print("No rows found; nothing to build.", file=sys.stderr)
        return 1

    stories_ko = [normalise(row, i, "ko") for i, row in enumerate(rows)]
    stories_en = [normalise(row, i, "en") for i, row in enumerate(rows)]
    stories_ko = sort_stories([item for item in stories_ko if item.get("title")])
    stories_en = sort_stories([item for item in stories_en if item.get("title")])

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    write_json(PUBLIC_DIR / "latest-ko.json", {"items": stories_ko[:LATEST_LIMIT], "generatedAt": now_iso(), "count": len(stories_ko)})
    write_json(PUBLIC_DIR / "latest-en.json", {"items": stories_en[:LATEST_LIMIT], "generatedAt": now_iso(), "count": len(stories_en)})
    write_json(PUBLIC_DIR / "index-ko.json", {"items": [compact(item) for item in stories_ko[:INDEX_LIMIT]], "generatedAt": now_iso(), "count": len(stories_ko)})
    write_json(PUBLIC_DIR / "index-en.json", {"items": [compact(item) for item in stories_en[:INDEX_LIMIT]], "generatedAt": now_iso(), "count": len(stories_en)})
    write_json(PUBLIC_DIR / "digest-ko.json", build_digest(stories_ko))
    write_json(PUBLIC_DIR / "digest-en.json", build_digest(stories_en))

    write_article_files(stories_ko, "ko")
    write_article_files(stories_en, "en")

    print(f"Built {len(stories_ko)} Korean stories and {len(stories_en)} English stories.")
    return 0


def read_source_rows() -> List[Dict[str, str]]:
    url = os.getenv("NEWS_CSV_URL")
    if url:
        print("Reading CSV from NEWS_CSV_URL")
        text = fetch_text(url)
    elif SOURCE_CSV.exists():
        print(f"Reading CSV from {SOURCE_CSV}")
        text = SOURCE_CSV.read_text(encoding="utf-8-sig")
    else:
        print("Reading CSV from default Google Sheet export URL")
        text = fetch_text(DEFAULT_CSV_URL)

    sample = text[:4096]
    dialect = csv.Sniffer().sniff(sample) if sample else csv.excel
    reader = csv.DictReader(text.splitlines(), dialect=dialect)
    return [{clean_key(k): clean(v) for k, v in row.items()} for row in reader]


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "icak-news-builder/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8-sig")


def normalise(row: Dict[str, str], index: int, lang: str) -> Dict[str, object]:
    article_id = row.get("기사 고유값") or make_id(row, index)
    date = normalise_date(row.get("원문게재일"))
    title_ko = first(row, "제목(한글)", "title_ko", "Title Korean")
    title_en = first(row, "제목(영문)", "Title(English)", "title_en", "제목(원문)")
    body_ko = first(row, "내용(한글)", "내용", "summary_ko")
    body_en = first(row, "내용(영문)", "Summary(English)", "summary_en", "내용")

    return {
        "id": article_id,
        "title": title_en if lang == "en" else title_ko or title_en,
        "originalTitle": row.get("제목(원문)", ""),
        "summary": body_en if lang == "en" else body_ko or body_en,
        "date": date,
        "collectedDate": normalise_date(row.get("기사수집일")),
        "region": row.get("지역", ""),
        "country": row.get("국가", ""),
        "sector": row.get("섹터", ""),
        "topic": row.get("주제", ""),
        "infoClass": row.get("정보 분류", ""),
        "project": row.get("프로젝트명", ""),
        "stage": row.get("관련 단계", ""),
        "importance": row.get("중요도", ""),
        "sourceLanguage": row.get("출처언어", ""),
        "sourceUrl": row.get("출처링크", ""),
        "score": importance_score(row.get("중요도", "")),
    }


def compact(item: Dict[str, object]) -> Dict[str, object]:
    return {
        "id": item["id"],
        "title": item["title"],
        "date": item["date"],
        "region": item["region"],
        "country": item["country"],
        "sector": item["sector"],
        "topic": item["topic"],
        "infoClass": item["infoClass"],
        "score": item["score"],
    }


def write_article_files(stories: Iterable[Dict[str, object]], lang: str) -> None:
    for story in stories:
        date = str(story.get("date") or "undated")
        year, month = year_month(date)
        target_dir = PUBLIC_DIR / "articles" / year / month
        target_dir.mkdir(parents=True, exist_ok=True)
        write_json(target_dir / f"{story['id']}-{lang}.json", story)


def build_digest(stories: List[Dict[str, object]]) -> Dict[str, object]:
    return {
        "generatedAt": now_iso(),
        "count": len(stories),
        "regions": Counter(str(item.get("region")) for item in stories if item.get("region")).most_common(20),
        "countries": Counter(str(item.get("country")) for item in stories if item.get("country")).most_common(50),
        "sectors": Counter(str(item.get("sector")) for item in stories if item.get("sector")).most_common(30),
        "infoClasses": Counter(str(item.get("infoClass")) for item in stories if item.get("infoClass")).most_common(20),
    }


def sort_stories(stories: List[Dict[str, object]]) -> List[Dict[str, object]]:
    return sorted(stories, key=lambda item: (int(item.get("score") or 0), date_sort_key(str(item.get("date") or ""))), reverse=True)


def importance_score(value: str) -> int:
    text = clean(value).lower()
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if match:
        return int(float(match.group(0)))
    if re.search(r"상|높|high|important|priority", text):
        return 90
    if re.search(r"중|medium|moderate", text):
        return 50
    if re.search(r"하|low", text):
        return 10
    return 0


def normalise_date(value: str | None) -> str:
    text = clean(value)
    if not text:
        return ""
    date_ctor = re.match(r"Date\((\d+),(\d+),(\d+)", text)
    if date_ctor:
        return f"{int(date_ctor.group(1)):04d}-{int(date_ctor.group(2)) + 1:02d}-{int(date_ctor.group(3)):02d}"
    iso = re.search(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})", text)
    if iso:
        return f"{iso.group(1)}-{int(iso.group(2)):02d}-{int(iso.group(3)):02d}"
    return text


def date_sort_key(value: str) -> int:
    try:
        return int(datetime.strptime(value, "%Y-%m-%d").strftime("%Y%m%d"))
    except ValueError:
        return 0


def year_month(value: str) -> tuple[str, str]:
    iso = re.match(r"(\d{4})-(\d{2})-", value or "")
    if iso:
        return iso.group(1), iso.group(2)
    return "undated", "00"


def first(row: Dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(clean_key(key), "") or row.get(key, "")
        if value:
            return value
    return ""


def make_id(row: Dict[str, str], index: int) -> str:
    seed = "|".join([
        row.get("원문게재일", ""),
        row.get("제목(한글)", ""),
        row.get("제목(원문)", ""),
        row.get("국가", ""),
        str(index),
    ])
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]
    return f"news-{digest}"


def clean(value: object | None) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_key(value: object | None) -> str:
    return clean(value).replace("\ufeff", "")


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


if __name__ == "__main__":
    raise SystemExit(main())
