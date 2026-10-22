import csv, json, pathlib, collections, re
HERE = pathlib.Path(__file__).resolve().parent.parent
ORIG = HERE.parent / "csv"
exec(open(HERE/"scripts"/"claims_new.py").read())
exec(open(HERE/"scripts"/"meta_new.py").read())  # CAT, SITE, EVENTS, COMMUNITIES
orig_sp = {r["company"].strip().lower(): r for r in csv.DictReader(open(ORIG/"sponsors.csv"))}
orig_claims = {(r["source_url"], r["company"].lower(), r["role"]) for r in csv.DictReader(open(ORIG/"sponsor_claims.csv"))}
orig_ev_urls = {r["url"] for r in csv.DictReader(open(ORIG/"events.csv"))} | {r["source_url"] for r in csv.DictReader(open(ORIG/"events.csv"))}
orig_comm = {r["name"].strip().lower() for r in csv.DictReader(open(ORIG/"communities.csv"))}
cols = ["event_id","event_name","event_date","community","company","role","confidence","evidence_quote","source_url","is_new_company"]
rows, seen = [], set()
for c in C:
    k = (c[0], c[4], c[5])
    if k in seen: continue
    seen.add(k)
    if (c[8], c[4].lower(), c[5]) in orig_claims: continue  # exact dup of an existing claim
    r = dict(zip(cols[:-1], c)); r["is_new_company"] = str(c[4].lower() not in orig_sp).lower()
    rows.append(r)
def w(name, cols, rows):
    with open(HERE/f"{name}.csv","w",newline="") as f:
        wr = csv.DictWriter(f, fieldnames=cols); wr.writeheader(); wr.writerows(rows)
    (HERE/f"{name}.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
w("sponsor_claims_new", cols, rows)
by = collections.defaultdict(list)
for r in rows: by[r["company"]].append(r)
sp = []
for co, rs in sorted(by.items(), key=lambda kv: (-len({x["event_id"] for x in kv[1]}), kv[0])):
    roles = collections.Counter(x["role"] for x in rs)
    new = co.lower() not in orig_sp
    sp.append({"company": co, "website": SITE.get(co, orig_sp.get(co.lower(), {}).get("website", "")),
        "category": CAT.get(co, orig_sp.get(co.lower(), {}).get("category", "")),
        "roles": ";".join(f"{k}:{v}" for k, v in roles.most_common()),
        "london_events_found": len({x["event_id"] for x in rs}),
        "food_or_drinks_events": len({x["event_id"] for x in rs if x["role"] in ("food","drinks")}),
        "venue_events": len({x["event_id"] for x in rs if x["role"]=="venue"}),
        "stated_claims": sum(x["confidence"]=="stated" for x in rs),
        "is_new_company": str(new).lower(),
        "evidence_urls": " ".join(sorted({x["source_url"] for x in rs})),
        "notes": ("new company" if new else f"NEW EVIDENCE for existing company (already in sponsors.csv with {orig_sp[co.lower()]['london_events']} events)") + (("; " + NOTES[co]) if co in NOTES else "")})
w("sponsors_new", list(sp[0].keys()), sp)
# events
ev = {}
for r in rows:
    e = ev.setdefault(r["event_id"], {"event_id": r["event_id"], "name": r["event_name"], "date": r["event_date"], "community": r["community"], "sponsors_listed": set(), "source_urls": set()})
    e["sponsors_listed"].add(r["company"]); e["source_urls"].add(r["source_url"])
evrows = []
for eid, e in ev.items():
    m = EVENTS.get(eid, {})
    url = m.get("url", sorted(e["source_urls"])[0])
    evrows.append({"event_id": eid, "name": e["name"], "url": url, "date": e["date"],
        "status": "upcoming" if e["date"][:10] > "2026-10-22" else ("today" if e["date"][:10]=="2026-10-22" else "past"),
        "community": e["community"], "venue": m.get("venue",""), "area": m.get("area",""), "approx_size": m.get("size",""), "size_note": m.get("size_note","not shown"),
        "platform": re.sub(r"^https?://(www\.)?([^/]+).*", r"\2", url), "sponsors_listed": ";".join(sorted(e["sponsors_listed"])),
        "already_in_events_csv": str(url in orig_ev_urls).lower(), "source_urls": " ".join(sorted(e["source_urls"])), "read_on": "2026-10-22"})
evrows.sort(key=lambda x: x["date"], reverse=True)
w("events_new", list(evrows[0].keys()), evrows)
# communities
cm = collections.defaultdict(lambda: {"events": set(), "cos": set()})
for r in rows: cm[r["community"]]["events"].add(r["event_id"]); cm[r["community"]]["cos"].add(r["company"])
crow = []
for i, (n, v) in enumerate(sorted(cm.items()), 1):
    if n.lower() in orig_comm: continue
    crow.append({"community_id": f"NC{i:02d}", "name": n, "url": COMMUNITIES.get(n, {}).get("url",""), "focus": COMMUNITIES.get(n, {}).get("focus",""),
        "events_found": len(v["events"]), "sponsor_companies": ";".join(sorted(v["cos"])),
        "event_urls": " ".join(sorted({x["url"] for x in evrows if x["community"]==n}))})
w("communities_new", list(crow[0].keys()), crow)
stats = {"claims": len(rows), "food_drink_claims": sum(r["role"] in ("food","drinks") for r in rows), "venue_claims": sum(r["role"]=="venue" for r in rows),
 "food_venue_claims": sum(r["role"] in ("food","drinks","venue") for r in rows), "stated": sum(r["confidence"]=="stated" for r in rows),
 "companies": len(sp), "new_companies": sum(s["is_new_company"]=="true" for s in sp), "events": len(evrows), "new_events": sum(e["already_in_events_csv"]=="false" for e in evrows), "new_communities": len(crow)}
(HERE/"stats_new.json").write_text(json.dumps(stats, indent=1)); print(stats)
