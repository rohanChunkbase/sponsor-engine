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
check(not (ROOT / "csv" / "members.csv").exists(), "no members table export")
check(not (ROOT / "csv" / "attendance.csv").exists(), "no attendance export")
check(not (ROOT / "csv" / "luma_guests_flat.csv").exists(), "no flattened guest list")
check(not list((ROOT / "luma").glob("events_guests_list_*.json")), "no Luma guest-list payloads")
check(not (ROOT / "luma" / "calendars_contacts_list.json").exists(), "no Luma calendar contact list")
counts = json.load(open(ROOT / "luma" / "event_counts.json"))
check(counts.get("label") == "luma-aggregates", "event_counts.json is labelled luma-aggregates")
by_id = {row["event_id"]: row for row in counts["events"]}
for e in c01:
    row = by_id[e["event_id"]]
    check(row["registered"] == int(e["registrations"]) and row["checked_in"] == int(e["check_ins"]), f"Luma counts {e['event_id']} match events.csv")
    check("email" not in row and "user_name" not in row, f"Luma counts {e['event_id']} have no person fields")
con = sqlite3.connect(ROOT / "sample.db")
check(con.execute("select count(*) from events").fetchone()[0] == len(list(csv.DictReader(open(ROOT / "csv" / "events.csv")))), "sample.db loaded and matches events.csv")
print("OK" if ok else "SOME CHECKS FAILED"); raise SystemExit(0 if ok else 1)
