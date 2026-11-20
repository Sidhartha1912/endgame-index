#!/usr/bin/env python3
"""Validate Endgame Index data before publishing. Exits 1 on any error.

Checks: event files follow the rubric enums, have sources, and respect daily limits;
every computed day has a summary; displayed scores respect the speed limit and bounds.
Usage: python3 scripts/validate.py
"""
import json, os, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = json.load(open(os.path.join(ROOT, "scoring", "rules.json")))
E = R["event_rating"]
errors, warnings = [], []
REQ = ["id", "title", "summary", "category", "factors", "tier", "credibility", "novelty", "scope", "track", "reason", "sources"]

for path in sorted(glob.glob(os.path.join(ROOT, "data", "events", "*.json"))):
    day = os.path.basename(path)[:10]
    try:
        evs = json.load(open(path, encoding="utf-8"))
    except Exception as ex:
        errors.append(f"{day}: invalid JSON ({ex})"); continue
    if not isinstance(evs, list):
        errors.append(f"{day}: events file must be a list"); continue
    if len(evs) > E["max_events_per_day"]:
        errors.append(f"{day}: {len(evs)} events > max {E['max_events_per_day']}")
    for e in evs:
        t = e.get("title", "?")[:50]
        for k in REQ:
            if k not in e:
                errors.append(f"{day} '{t}': missing {k}")
        if e.get("tier") not in E["impact_points"]: errors.append(f"{day} '{t}': bad tier {e.get('tier')}")
        if e.get("credibility") not in E["credibility"]: errors.append(f"{day} '{t}': bad credibility")
        if e.get("credibility") == "E": warnings.append(f"{day} '{t}': grade E events score zero; consider removing")
        if e.get("novelty") not in E["novelty"]: errors.append(f"{day} '{t}': bad novelty")
        if e.get("scope") not in E["scope"]: errors.append(f"{day} '{t}': bad scope")
        if e.get("track") not in ("structural", "signal"): errors.append(f"{day} '{t}': bad track")
        if e.get("category") not in R["event_categories"]: errors.append(f"{day} '{t}': bad category")
        fx = e.get("factors") or []
        if not 1 <= len(fx) <= E["max_factors_per_event"]: errors.append(f"{day} '{t}': needs 1-2 factors")
        for f in fx:
            if f.get("id") not in R["factors"] or f.get("dir") not in (1, -1):
                errors.append(f"{day} '{t}': bad factor {f}")
        if not any(str(u).startswith("http") for u in e.get("sources", [])):
            errors.append(f"{day} '{t}': no source URL")

H_path = os.path.join(ROOT, "data", "history.json")
if os.path.exists(H_path):
    H = json.load(open(H_path))
    cap = R["dynamics"]["scenario_daily_cap"] + 1e-6
    lo, hi = R["dynamics"]["scenario_bounds"]
    for s, v in H["scores"].items():
        for i in range(1, len(v)):
            if abs(v[i] - v[i - 1]) > cap + 0.01:
                errors.append(f"{H['dates'][i]}: {s} moved more than the daily cap")
        if min(v) < lo or max(v) > hi:
            errors.append(f"{s}: score out of bounds")
    for d in H["dates"]:
        if not os.path.exists(os.path.join(ROOT, "data", "summaries", d + ".json")):
            errors.append(f"{d}: missing summary")
else:
    errors.append("data/history.json missing - run scripts/compute.py")

# pre-rendered pages and crawl files (scripts/build_pages.py)
if os.path.exists(H_path):
    import re as _re
    H = json.load(open(H_path))
    for rel in ["index.html", "day/index.html", "endings/index.html", "history/index.html", "scoring/index.html", "about/index.html",
                "404.html", "sitemap.xml", "robots.txt", "llms.txt", "data/endgame-index-daily.csv"]:
        if not os.path.exists(os.path.join(ROOT, rel)):
            errors.append(f"missing {rel} - run scripts/build_pages.py")
    for d in H["dates"]:
        if not os.path.exists(os.path.join(ROOT, "day", d, "index.html")):
            errors.append(f"{d}: missing day page - run scripts/build_pages.py")
    for k in R["scenarios"]:
        if not os.path.exists(os.path.join(ROOT, "endings", k.replace("_", "-"), "index.html")):
            errors.append(f"missing ending page for {k}")
    home = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read() if os.path.exists(os.path.join(ROOT, "index.html")) else ""
    if home and H["end"] not in home:
        errors.append("index.html does not show the latest day - run scripts/build_pages.py")
    for rel in ["index.html", os.path.join("day", H["end"], "index.html")]:
        f = os.path.join(ROOT, rel)
        if os.path.exists(f):
            t = open(f, encoding="utf-8").read()
            if t.count("<h1") != 1:
                errors.append(f"{rel}: expected exactly one <h1>")
            for blk in _re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, _re.S):
                try:
                    json.loads(blk)
                except Exception as ex:
                    errors.append(f"{rel}: invalid JSON-LD ({ex})")
    if not os.path.exists(os.path.join(ROOT, "og", H["end"] + ".png")):
        warnings.append(f"og/{H['end']}.png missing (share image; needs Pillow)")

for w in warnings:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print(f"validate: {len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
