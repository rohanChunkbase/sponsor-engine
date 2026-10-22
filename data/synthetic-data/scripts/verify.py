#!/usr/bin/env python3
"""Checks every file parses, every record is marked SAMPLE, and the numbers are coherent."""
import csv, json, sqlite3
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
ok = True
def check(cond, msg):
    global ok
    print(("PASS " if cond else "FAIL ") + msg); ok &= bool(cond)
for f in sorted((ROOT / "csv").glob("*.csv")):
    rows = list(csv.DictReader(open(f)))
    check(rows and all(r.get("is_sample") == "SAMPLE" for r in rows), f"{f.name}: {len(rows)} rows, all SAMPLE")
for f in sorted(list((ROOT / "json").glob("*.json")) + list((ROOT / "luma").glob("*.json")) + list((ROOT / "geo").glob("*.geojson")) + [ROOT / "chat_exports" / "slack_organisers_SAMPLE.json", ROOT / "graph" / "community_graph.json"]):
    d = json.load(open(f)); check("SAMPLE" in json.dumps(d)[:400], f"{f.relative_to(ROOT)} parses, marked SAMPLE")
ev = [e for e in csv.DictReader(open(ROOT / "csv" / "events.csv")) if e["check_ins"]]
rates = [int(e["check_ins"]) / int(e["registrations"]) for e in ev]
check(all(0.5 <= r <= 0.75 for r in rates), f"show-up rates within 50-75% (min {min(rates):.2f}, max {max(rates):.2f})")
ph = [float(e["food_per_head_gbp"]) for e in ev]
check(all(4.8 <= p <= 6.2 for p in ph), f"food per head ~£5-6 (min {min(ph):.2f}, max {max(ph):.2f})")
c01 = [e for e in ev if e["community_id"] == "C01"]
r = sum(int(e["check_ins"]) for e in c01) / sum(int(e["registrations"]) for e in c01)
check(abs(r - 0.62) < 0.01, f"C01 organiser history: {len(c01)} events, show-up {r:.1%}")
for e in c01:
    g = json.load(open(ROOT / "luma" / f"events_guests_list_{e['event_id']}.json"))["entries"]
    chk = sum(1 for x in g if x["event_tickets"] and x["event_tickets"][0]["checked_in_at"])
    check(len(g) == int(e["registrations"]) and chk == int(e["check_ins"]), f"Luma guest list {e['event_id']} matches events.csv ({len(g)} reg, {chk} checked in)")
con = sqlite3.connect(ROOT / "sample.db")
check(con.execute("select count(*) from events").fetchone()[0] == len(list(csv.DictReader(open(ROOT / "csv" / "events.csv")))), "sample.db loaded and matches events.csv")
print("OK" if ok else "SOME CHECKS FAILED"); raise SystemExit(0 if ok else 1)
