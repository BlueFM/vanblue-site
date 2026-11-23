"""Refresh the vendored CCF deadline data from ccfddl/ccf-deadlines.

Usage:  python tools/sync-ccf.py

Writes:
  static/data/ccf-deadlines.json   every deadline, for /deadlines/
  static/data/ccf-upcoming.json    the next few, for the sidebar card
  static/data/CCFDDL-LICENSE.txt   the upstream MIT notice

The upstream project is https://github.com/ccfddl/ccf-deadlines (MIT). The YAML
files are read from the jsDelivr mirror of its main branch, so no clone and no
GitHub token are needed. Re-run this after upstream updates; the site itself
does not fetch anything at build time.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

CURL = shutil.which("curl")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "static" / "data"
CDN = "https://cdn.jsdelivr.net/gh/ccfddl/ccf-deadlines@main"
API = "https://api.github.com/repos/ccfddl/ccf-deadlines/contents"

# CCF's AI category already holds the ML/CV/NLP venues; these data-mining ones
# live under DB upstream but belong in a deep-learning reading list.
EXTRA_DB = ["sigkdd", "wsdm", "cikm", "icdm"]

LICENSE = """CCF deadline data
=================

Source: https://github.com/ccfddl/ccf-deadlines
Fetched: {stamp}

MIT License

Copyright (c) 2021 CCFDDL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""


def get(url: str) -> bytes:
    """curl when available: Python's TLS stack stalls against some CDNs here."""
    if CURL:
        out = subprocess.run(
            [CURL, "-sS", "--max-time", "40", "-A", "vanblue-site/ccf-sync", url],
            capture_output=True,
        )
        if out.returncode != 0 or not out.stdout:
            raise RuntimeError(f"curl failed for {url}: {out.stderr.decode(errors='replace')[:200]}")
        return out.stdout
    req = urllib.request.Request(url, headers={"User-Agent": "vanblue-site/ccf-sync"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def list_dir(sub: str) -> list[str]:
    payload = json.loads(get(f"{API}/conference/{sub}"))
    return [item["name"] for item in payload if item["name"].endswith(".yml")]


def parse_deadline(value: str, tz: str) -> datetime | None:
    """Local wall-clock string plus upstream timezone -> aware datetime."""
    if not value or value == "TBD":
        return None
    naive = datetime.strptime(value.strip(), "%Y-%m-%d %H:%M:%S")
    if tz == "PT":
        return naive.replace(tzinfo=ZoneInfo("America/Los_Angeles"))
    if tz in ("AoE", "UTC-12"):
        offset = -12
    elif tz.startswith("UTC"):
        offset = int(tz[3:]) if len(tz) > 3 else 0
    else:
        offset = 0
    return naive.replace(tzinfo=timezone(timedelta(hours=offset)))


def load_venue(path: str) -> list[dict]:
    raw = yaml.safe_load(get(f"{CDN}/conference/{path}"))
    return raw if isinstance(raw, list) else []


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)

    files = [f"AI/{name}" for name in list_dir("AI")]
    files += [f"DB/{name}.yml" for name in EXTRA_DB]

    entries: list[dict] = []
    failures: list[str] = []

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda p: (p, load_venue(p)), files))

    for path, venues in results:
        if not venues:
            failures.append(path)
            continue
        for venue in venues:
            for conf in venue.get("confs") or []:
                tz = conf.get("timezone", "AoE")
                for slot in conf.get("timeline") or []:
                    when = parse_deadline(str(slot.get("deadline", "")), tz)
                    if when is None:
                        continue
                    abstract = parse_deadline(str(slot.get("abstract_deadline", "")), tz)
                    entries.append({
                        "venue": venue.get("title", ""),
                        "desc": venue.get("description", ""),
                        "rank": (venue.get("rank") or {}).get("ccf", ""),
                        "sub": venue.get("sub", ""),
                        "dblp": venue.get("dblp", ""),
                        "year": conf.get("year"),
                        "id": conf.get("id", ""),
                        "link": conf.get("link", ""),
                        "place": conf.get("place", ""),
                        "date": conf.get("date", ""),
                        "talk": slot.get("comment", ""),
                        "deadline": slot.get("deadline", ""),
                        "tz": tz,
                        "ts": int(when.timestamp()),
                        "date_short": f"{when:%b} {when.day}",
                        "abstract": slot.get("abstract_deadline", ""),
                        "abstract_ts": int(abstract.timestamp()) if abstract else None,
                    })

    entries.sort(key=lambda e: e["ts"])

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y-%m-%d")
    payload = {
        "updated": stamp,
        "source": "https://github.com/ccfddl/ccf-deadlines",
        "license": "MIT",
        "count": len(entries),
        "venues": len({e["venue"] for e in entries}),
        "entries": entries,
    }
    (DATA / "ccf-deadlines.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    upcoming = [e for e in entries if e["ts"] >= int((now - timedelta(days=1)).timestamp())][:12]
    (DATA / "ccf-upcoming.json").write_text(
        json.dumps(
            {"updated": stamp, "total": len(entries), "entries": upcoming},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    (DATA / "CCFDDL-LICENSE.txt").write_text(LICENSE.format(stamp=stamp), encoding="utf-8")

    print(f"venues read: {len(files) - len(failures)}/{len(files)}")
    if failures:
        print("failed:", ", ".join(failures))
    print(f"deadlines: {len(entries)}  next: {len(upcoming)}")
    if upcoming:
        first = upcoming[0]
        print("next up:", first["venue"], first["year"], first["deadline"], first["tz"])


if __name__ == "__main__":
    main()
