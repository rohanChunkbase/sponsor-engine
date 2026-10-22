#!/usr/bin/env python3
"""SAMPLE / FICTIONAL data generator for the hackathon demo.
Every community, person, company and number here is invented. Deterministic (seed 42)."""
import csv, json, random, os, datetime as dt
from pathlib import Path

random.seed(42)
ROOT = Path(__file__).resolve().parent.parent
CSV, JSN, CHAT = ROOT / "csv", ROOT / "json", ROOT / "chat_exports"
for p in (CSV, JSN, CHAT): p.mkdir(parents=True, exist_ok=True)
S = "SAMPLE"  # marker on every record
TODAY = dt.date(2026, 10, 22)

def write(name, rows):
    with open(CSV / f"{name}.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows:
            w.writerow({k: (";".join(map(str, v)) if isinstance(v, list) else v) for k, v in r.items()})
    with open(JSN / f"{name}.json", "w") as f:
        json.dump({"_notice": "SAMPLE / FICTIONAL data for a hackathon demo. Not real people, companies or events.", "records": rows}, f, indent=2)

FIRST = ["Ada","Bram","Cleo","Dev","Esme","Farid","Gwen","Hiro","Isla","Jonah","Kemi","Luca","Mira","Nico","Orla","Pax","Quinn","Rhea","Sol","Tobi","Uma","Vik","Wren","Xan","Yara","Zed","Ines","Omar","Leah","Ravi","Tess","Kai","Noor","Elio","Saffi","Arlo","Juno","Milo","Priya","Theo"]
LAST = ["Fernwood","Ashgrove","Marlow","Quillon","Brackley","Tennant","Halloway","Ostrander","Pemberly","Vance","Rookwood","Calder","Whitlow","Sallis","Darrow","Kestrel","Linnell","Morrow","Nettle","Arkwright"]
def person(): return f"{random.choice(FIRST)} {random.choice(LAST)}"

AREAS = {  # area: (lat, lon) approx centroids, for map demos
 "Shoreditch": (51.5245,-0.0795), "King's Cross": (51.5308,-0.1238), "Old Street": (51.5256,-0.0876),
 "Canary Wharf": (51.5054,-0.0235), "Southwark": (51.5035,-0.0919), "Farringdon": (51.5203,-0.1053),
 "Camden": (51.5390,-0.1426), "Hackney": (51.5450,-0.0553), "Soho": (51.5136,-0.1365),
 "Stratford": (51.5413,-0.0036), "Brixton": (51.4613,-0.1156), "White City": (51.5120,-0.2240),
 "Liverpool Street": (51.5178,-0.0823), "Bermondsey": (51.4980,-0.0640), "Islington": (51.5362,-0.1033)}

COMM_DEF = [
 ("Thames Agent Builders","AI agents",900,"Shoreditch"),("Lambeth LLM Lab","LLMs & RAG",650,"Brixton"),
 ("Docklands DevRel Circle","Developer relations",400,"Canary Wharf"),("Kings Cross Rust Night","Rust",520,"King's Cross"),
 ("Hackney Hardware Club","IoT & hardware",380,"Hackney"),("Southbank Data Folk","Data science",1100,"Southwark"),
 ("Camden Creative Coders","Creative coding",300,"Camden"),("Soho Product Guild","Product management",750,"Soho"),
 ("Stratford Startup Breakfast","Founders",600,"Stratford"),("Farringdon Fintech Tinkerers","Fintech",480,"Farringdon"),
 ("White City Women in ML","ML, women in tech",820,"White City"),("Bermondsey Open Source Pub","Open source",350,"Bermondsey"),
 ("Islington Indie Hackers","Indie hacking",560,"Islington"),("Old Street Security Social","Security",430,"Old Street"),
 ("Liverpool St Design Engineers","Design engineering",290,"Liverpool Street")]
CHANNELS = ["WhatsApp","Luma","LinkedIn","X","Slack","Discord"]
communities = []
for i,(n,f,size,area) in enumerate(COMM_DEF,1):
    handle = "@" + "".join(w[0] for w in n.split()).lower() + "_sample"
    ch = ["WhatsApp","Luma"] + random.sample([c for c in CHANNELS if c not in ("WhatsApp","Luma")], 2)
    communities.append({"community_id": f"C{i:02d}", "name": f"{n} (SAMPLE)", "focus": f, "members_estimate": size,
        "area": area, "lat": AREAS[area][0], "lon": AREAS[area][1], "organiser_name": person() + " (fictional)",
        "organiser_handle": handle, "channels": ch, "free_events": True, "is_sample": S})

# Sponsors: fictional names only
SP_DEF = {
 "food": ["Crustwise Pizza Collective","Dumpling Dynamo Kitchen","Leaf & Ladle Catering","Bao Down Street Food","Falafel Foundry","Tiny Taco Syndicate","Pasta Parlour Labs","Curry Compiler Co.","Snackstack Vending"],
 "drinks": ["Fizzbyte Soda Works","Hopscotch Brew Collective","Kombucha Kernel","Cold Brew Cartel"],
 "devtool": ["Stacklark","Querypine","Deployhaven","Logwhistle","Vectorcove","Promptmill","Testkettle","Gitgarden","Schemawell","Tracefern","Cachefinch","Agentloom"],
 "cloud_credits": ["Nimbusforge Cloud","Cumulo Compute","Driftwood GPU"],
 "venue": ["The Loom Workspace","Hollow Oak Studios","Canal Lock Coworking","Brickline Hub","Lantern House Offices"],
 "recruiter": ["Talentwharf","Hirewillow Partners","Benchmark & Bloom Recruiting"],
 "community_platform": ["Gatherwisp","Meetmoss","Circlewren"],
 "media": ["The Byte Courier"]}
ASKS = {"food":(250,400),"drinks":(100,200),"devtool":(300,600),"cloud_credits":(500,1500),"venue":(0,0),"recruiter":(400,800),"community_platform":(200,400),"media":(0,0)}
sponsors = []
for cat, names in SP_DEF.items():
    for n in names:
        lo,hi = ASKS[cat]
        sponsors.append({"sponsor_id": f"S{len(sponsors)+1:02d}", "company": f"{n} (fictional)", "category": cat,
            "typical_ask_gbp": int(round(random.randint(lo,hi)/10)*10) if hi else 0,
            "in_kind": {"venue":"room for 40-120","media":"newsletter feature","cloud_credits":"credits for attendees"}.get(cat, ""),
            "audiences_sponsored": random.sample([c["focus"] for c in communities], random.randint(1,4)),
            "contact_role": random.choice(["Community & Events team","Developer Relations lead","Partnerships manager","Marketing coordinator","Office manager"]),
            "contact_channel": "company contact form / generic events inbox (fictional)",
            "website": f"https://{n.split()[0].lower().replace('&','and')}.example", "is_sample": S})
assert len(sponsors) == 40, len(sponsors)
food_payers = [s for s in sponsors if s["category"] in ("food","devtool","recruiter","community_platform")]
venues = [s for s in sponsors if s["category"] == "venue"]

# Events: 60 past events, 4 per community
events, deals = [], []
TOPICS = ["demo night","hack night","talks + pizza","workshop","panel","lightning talks","build day"]
for c in communities:
    n_ev = 10 if c["community_id"] == "C01" else random.choice([3, 4, 4])
    for k in range(n_ev):
        d = TODAY - dt.timedelta(days=(k * 33 + random.randint(14, 30)) if c["community_id"] == "C01" else random.randint(14, 360))
        reg = random.randint(max(30, c["members_estimate"]//20), max(60, c["members_estimate"]//7))
        rate = random.uniform(0.58, 0.68) if c["community_id"] == "C01" else random.uniform(0.50, 0.75)
        chk = round(reg * rate)
        per_head = random.uniform(5.0, 6.0)
        food = int(round(chk * per_head / 5) * 5)
        sp = random.choice(food_payers)
        ven = random.choice(venues)
        cohosts = random.sample([x["community_id"] for x in communities if x["community_id"] != c["community_id"]], random.choice([0,0,1,1,2]))
        eid = f"E{len(events)+1:03d}"
        area = random.choice([c["area"]] + list(AREAS.keys())[:5])
        events.append({"event_id": eid, "community_id": c["community_id"], "title": f"{c['name'].replace(' (SAMPLE)','')} {random.choice(TOPICS)} #{k+1} (SAMPLE)",
            "date": d.isoformat(), "weekday": d.strftime("%a"), "venue_sponsor_id": ven["sponsor_id"], "venue_area": area,
            "lat": AREAS[area][0], "lon": AREAS[area][1], "registrations": reg, "check_ins": chk,
            "show_up_rate": round(chk/reg, 3), "food_cost_gbp": food, "food_per_head_gbp": round(food/chk, 2),
            "food_sponsor_id": sp["sponsor_id"], "co_host_ids": cohosts, "ticket": "free", "is_sample": S})
        # deal history: 2-4 asks per event, exactly one yes (the food sponsor)
        others = random.sample([s for s in food_payers if s["sponsor_id"] != sp["sponsor_id"]], random.randint(1,3))
        asked = d - dt.timedelta(days=random.randint(14, 35))
        for s in others:
            replied = random.random() < 0.55
            deals.append({"deal_id": f"D{len(deals)+1:03d}", "event_id": eid, "sponsor_id": s["sponsor_id"], "asked_on": asked.isoformat(),
                "ask_gbp": food, "replied": replied, "outcome": "no" if replied else "no_reply", "amount_gbp": 0,
                "notes": random.choice(["budget spent this quarter","audience not a fit","maybe next time","",""]) if replied else "", "is_sample": S})
        deals.append({"deal_id": f"D{len(deals)+1:03d}", "event_id": eid, "sponsor_id": sp["sponsor_id"], "asked_on": asked.isoformat(),
            "ask_gbp": food, "replied": True, "outcome": "yes", "amount_gbp": food,
            "notes": random.choice(["logo on Luma page + 2-min slot","logo + thank-you post","paid supplier invoice directly","sent pizzas on the night"]), "is_sample": S})
events.sort(key=lambda e: e["date"])

# Members: 200 with interests + attendance history (subset of each event's check-ins)
INTERESTS = ["AI agents","RAG","Rust","IoT","data viz","product","fintech","security","open source","design systems","ML ops","founders","devrel","creative coding","LLM evals"]
members = []
for i in range(1, 201):
    home = random.choice(communities)
    members.append({"member_id": f"M{i:03d}", "name": person() + " (fictional)", "email": f"member{i:03d}@example.com",
        "home_community_id": home["community_id"], "interests": random.sample(INTERESTS, random.randint(2,4)),
        "joined": (TODAY - dt.timedelta(days=random.randint(30, 900))).isoformat(), "is_sample": S})
attendance = []
for e in events:
    pool = [m for m in members if m["home_community_id"] == e["community_id"]]
    extra = random.sample(members, 6)
    regs = {m["member_id"] for m in random.sample(pool, min(len(pool), random.randint(5, 12)))} | {m["member_id"] for m in extra}
    for mid in sorted(regs):
        attendance.append({"member_id": mid, "event_id": e["event_id"], "registered": True,
            "checked_in": random.random() < e["show_up_rate"], "is_sample": S})
by_m = {}
for a in attendance:
    d = by_m.setdefault(a["member_id"], [0,0,[]]); d[0]+=1; d[1]+=a["checked_in"]
    if a["checked_in"]: d[2].append(a["event_id"])
for m in members:
    r,c,ev = by_m.get(m["member_id"], [0,0,[]])
    m.update({"events_registered": r, "events_attended": c, "attended_event_ids": ev,
              "personal_show_up_rate": round(c/r,2) if r else None})

# One organiser's private network (organiser of C01)
org = communities[0]
contacts = []
REL = ["met at their event","co-hosted with us","sponsored us before","ex-colleague","speaker at our event","LinkedIn connection only"]
for i in range(1, 61):
    sp = random.choice(sponsors) if random.random() < 0.5 else None
    rel = random.choice(REL)
    if sp and any(d["sponsor_id"]==sp["sponsor_id"] and d["outcome"]=="yes" and next(e for e in events if e["event_id"]==d["event_id"])["community_id"]=="C01" for d in deals):
        rel = "sponsored us before"
    contacts.append({"contact_id": f"K{i:02d}", "owner_community_id": "C01", "name": person() + " (fictional)",
        "role": random.choice(["Head of Community","DevRel","Founder","Partnerships","Engineer","Office manager","Recruiter"]),
        "company": sp["company"] if sp else random.choice(["Independent","Fictional Startup Ltd","Another Meetup (SAMPLE)"]),
        "sponsor_id": sp["sponsor_id"] if sp else "", "relationship": rel,
        "warmth_1to5": {"sponsored us before":5,"co-hosted with us":4,"ex-colleague":4,"speaker at our event":3,"met at their event":3,"LinkedIn connection only":1}[rel],
        "last_contact": (TODAY - dt.timedelta(days=random.randint(5, 400))).isoformat(),
        "linkedin_connection": random.random() < 0.7, "met_at_event_id": random.choice([e["event_id"] for e in events if e["community_id"]=="C01"]) if rel in ("met at their event","speaker at our event") else "", "email": f"contact{i:02d}@example.org", "source": "organiser's own contacts export (SAMPLE)", "is_sample": S})

# Upcoming event + Luma-style registration export
up = {"event_id": "E900", "community_id": "C01", "title": "Thames Agent Builders hack night #5 (SAMPLE)", "date": "2026-11-19",
      "weekday": "Thu", "venue_sponsor_id": venues[0]["sponsor_id"], "venue_area": "Shoreditch", "lat": AREAS["Shoreditch"][0], "lon": AREAS["Shoreditch"][1],
      "registrations": 80, "check_ins": "", "show_up_rate": "", "food_cost_gbp": "", "food_per_head_gbp": "", "food_sponsor_id": "", "co_host_ids": ["C02"], "ticket": "free", "is_sample": S}
luma = []
regs = random.sample(members, 80)
for i, m in enumerate(regs, 1):
    t = dt.datetime(2026, 10, 1, 9) + dt.timedelta(hours=random.randint(0, 20*24))
    luma.append({"api_id": f"gst-SAMPLE{i:04d}", "name": m["name"], "email": m["email"], "created_at": t.isoformat()+"Z",
        "approval_status": random.choices(["approved","waitlist"],[0.9,0.1])[0], "ticket_name": "Free", "checked_in_at": "",
        "what_are_you_building": random.choice(["agent for ops","RAG over docs","voice bot","nothing yet, curious","evals harness"]),
        "dietary": random.choice(["none","none","vegetarian","vegan","halal","gluten-free"]),
        "member_id": m["member_id"], "past_show_up_rate": m["personal_show_up_rate"], "is_sample": S})


# Speakers (fictional) -> used for "shared speakers" edges
speakers, talks = [], []
for i in range(1, 51):
    speakers.append({"speaker_id": f"P{i:02d}", "name": person() + " (fictional)", "topic": random.choice(INTERESTS), "is_sample": S})
for e in events:
    for sp_ in random.sample(speakers, random.randint(1, 3)):
        talks.append({"speaker_id": sp_["speaker_id"], "event_id": e["event_id"], "is_sample": S})

# Community-community edges with weights
from itertools import combinations
ev_comm = {e["event_id"]: e["community_id"] for e in events}
mem_comms = {}
for a in attendance:
    if a["checked_in"]: mem_comms.setdefault(a["member_id"], set()).add(ev_comm[a["event_id"]])
spk_comms = {}
for t in talks: spk_comms.setdefault(t["speaker_id"], set()).add(ev_comm[t["event_id"]])
spons_comms = {}
for e in events: spons_comms.setdefault(e["food_sponsor_id"], set()).add(e["community_id"])
edges = []
for a, b in combinations([c["community_id"] for c in communities], 2):
    sm = sum(1 for cs in mem_comms.values() if a in cs and b in cs)
    ch = sum(1 for e in events if (e["community_id"] == a and b in e["co_host_ids"]) or (e["community_id"] == b and a in e["co_host_ids"]))
    ss = sum(1 for cs in spons_comms.values() if a in cs and b in cs)
    sk = sum(1 for cs in spk_comms.values() if a in cs and b in cs)
    w = sm * 1 + ch * 5 + ss * 2 + sk * 3
    if w > 0:
        edges.append({"source": a, "target": b, "shared_members": sm, "co_hosted_events": ch, "shared_sponsors": ss,
                      "shared_speakers": sk, "weight": w, "is_sample": S})
edges.sort(key=lambda r: -r["weight"])

# ---------- Luma-shaped exports (field names follow Luma's public API / OpenAPI: events/get, events/guests/list,
# calendars/get, calendars/contacts/list, events/ticket-types/list, events/coupons/list). IDs are fake. ----------
L = ROOT / "luma"; L.mkdir(exist_ok=True)
NOTICE = "SAMPLE / FICTIONAL. Shaped like Luma API responses (field names from public-api.luma.com/openapi.json). Not real Luma data; ids are fake; the _notice key is not part of real responses."
def lj(name, obj):
    obj = {"_notice": NOTICE, **obj}
    (L / f"{name}.json").write_text(json.dumps(obj, indent=2))
CAL_ID = "cal-SAMPLEthames01"
TT_FREE = "evtticktyp-SAMPLEfree01"
QS = [{"id": "q-SAMPLE-build", "label": "What are you building?", "required": False, "question_type": "text"},
      {"id": "q-SAMPLE-diet", "label": "Dietary requirements", "required": False, "question_type": "dropdown"},
      {"id": "q-SAMPLE-company", "label": "Company", "required": False, "question_type": "company", "collect_job_title": True, "job_title_label": "Job title"},
      {"id": "q-SAMPLE-terms", "label": "I agree to the code of conduct", "required": True, "question_type": "agree-check"}]
def iso(d, h=18, m=30): return dt.datetime(d.year, d.month, d.day, h, m).isoformat() + ":00.000Z"
def luma_event(e, counts):
    d = dt.date.fromisoformat(e["date"])
    return {"platform": "luma", "id": "evt-SAMPLE" + e["event_id"], "user_id": "usr-SAMPLEorganiser01", "calendar_id": CAL_ID,
        "start_at": iso(d), "duration_interval": "PT3H", "end_at": iso(d, 21, 30), "created_at": iso(d - dt.timedelta(days=30), 10, 0),
        "timezone": "Europe/London", "name": e["title"],
        "geo_address_json": {"address": f"{e['venue_area']} (fictional venue)", "city": "London", "region": "England", "country": "United Kingdom",
            "city_state": "London, England", "full_address": f"{e['venue_area']}, London (SAMPLE)", "google_maps_place_id": None, "apple_maps_place_id": None, "description": None},
        "coordinate": {"longitude": e["lon"], "latitude": e["lat"]}, "meeting_url": None, "location_type": "offline", "location_visibility": "guests-only",
        "cover_url": "https://example.com/cover-sample.png", "registration_questions": QS, "url": "https://luma.com/sample-" + e["event_id"].lower(),
        "visibility": "public", "waitlist_status": "enabled", "registration_open": e["event_id"] == "E900", "require_approval": False,
        "max_capacity": 80, "can_register_for_multiple_tickets": False, "spots_remaining": None,
        "display_price": None, "feedback_email": None, "access": "manage", "description": "SAMPLE event", "description_md": "SAMPLE event",
        "hosts": [{"id": "usr-SAMPLEorganiser01", "name": org["organiser_name"], "avatar_url": None}],
        "guest_counts": counts}
def luma_guest(m, e, status, checked_in, idx):
    d = dt.date.fromisoformat(e["date"])
    reg = dt.datetime(d.year, d.month, d.day, 9) - dt.timedelta(hours=random.randint(24, 24*25))
    first, last = m["name"].replace(" (fictional)", "").split(" ", 1)
    ans = [{"label": "What are you building?", "question_id": "q-SAMPLE-build", "value": random.choice(["agent for ops","RAG over docs","voice bot","nothing yet, curious","evals harness"]), "question_type": "text"},
           {"label": "Dietary requirements", "question_id": "q-SAMPLE-diet", "value": random.choice(["None","None","Vegetarian","Vegan","Halal","Gluten-free"]), "question_type": "dropdown"},
           {"label": "Company", "question_id": "q-SAMPLE-company", "value": {"company": random.choice(["Fictional Startup Ltd","Independent","Another Co (SAMPLE)"]), "job_title": random.choice(["Engineer","Founder","PM","Student"])}, "question_type": "company"},
           {"label": "I agree to the code of conduct", "question_id": "q-SAMPLE-terms", "value": True, "question_type": "agree-check"}]
    tickets = [] if status in ("invited", "declined") else [{"id": f"evttick-SAMPLE{e['event_id']}{idx:03d}", "amount": 0, "amount_discount": 0, "amount_tax": 0,
        "currency": None, "checked_in_at": (dt.datetime(d.year, d.month, d.day, 18, 30) + dt.timedelta(minutes=random.randint(0, 75))).isoformat() + ".000Z" if checked_in else None,
        "event_ticket_type_id": TT_FREE, "is_captured": True, "name": "Free"}]
    return {"id": f"gst-SAMPLE{e['event_id']}{idx:03d}", "user_id": "usr-SAMPLE" + m["member_id"], "user_email": m["email"],
        "user_name": f"{first} {last}", "user_first_name": first, "user_last_name": last, "approval_status": status,
        "check_in_qr_code": f"SAMPLE-QR-{e['event_id']}-{idx:03d}", "eth_address": None, "invited_at": None, "joined_at": None,
        "phone_number": None, "registered_at": reg.isoformat() + ".000Z", "registration_answers": ans, "solana_address": None,
        "utm_source": random.choice([None, None, "linkedin", "whatsapp", "x"]), "attribution_params": {}, "event_tickets": tickets}

flat_rows = []
def flatten(g, eid):
    t = g["event_tickets"][0] if g["event_tickets"] else {}
    a = {x["question_id"]: x["value"] for x in g["registration_answers"]}
    flat_rows.append({"event_id": eid, "id": g["id"], "user_id": g["user_id"], "user_email": g["user_email"], "user_name": g["user_name"],
        "user_first_name": g["user_first_name"], "user_last_name": g["user_last_name"], "approval_status": g["approval_status"],
        "registered_at": g["registered_at"], "checked_in_at": t.get("checked_in_at") or "", "ticket_name": t.get("name", ""),
        "event_ticket_type_id": t.get("event_ticket_type_id", ""), "utm_source": g["utm_source"] or "",
        "answer_what_are_you_building": a.get("q-SAMPLE-build", ""), "answer_dietary": a.get("q-SAMPLE-diet", ""),
        "answer_company": a.get("q-SAMPLE-company", {}).get("company", ""), "answer_job_title": a.get("q-SAMPLE-company", {}).get("job_title", ""),
        "is_sample": S})

# Past C01 events: full guest lists (registrations = check-ins + no-shows); counts match events.csv
c01_events = [e for e in events if e["community_id"] == "C01"]
for e in c01_events:
    # sample members keep exactly their attendance.csv status; the rest are extra fictional registrants
    mrows = [a for a in attendance if a["event_id"] == e["event_id"]]
    mbyid = {m["member_id"]: m for m in members}
    guests = [luma_guest(mbyid[a["member_id"]], e, "approved", a["checked_in"], i) for i, a in enumerate(mrows)]
    n_extra = e["registrations"] - len(mrows)
    extra_chk = e["check_ins"] - sum(a["checked_in"] for a in mrows)
    assert 0 <= extra_chk <= n_extra, (e["event_id"], extra_chk, n_extra)
    for k in range(n_extra):
        fake = {"member_id": f"X{e['event_id']}{k:03d}", "name": person() + " (fictional)", "email": f"guest.{e['event_id'].lower()}.{k:03d}@example.com"}
        guests.append(luma_guest(fake, e, "approved", k < extra_chk, len(mrows) + k))
    lj(f"events_get_{e['event_id']}", luma_event(e, {"approved": {"guests": e["registrations"], "tickets": e["registrations"]},
        "pending_approval": {"guests": 0, "tickets": 0}, "waitlist": {"guests": 0, "tickets": 0}, "invited": {"guests": 0, "tickets": 0}, "declined": {"guests": 0, "tickets": 0}}))
    lj(f"events_guests_list_{e['event_id']}", {"entries": guests, "has_more": False, "next_cursor": None})
    for g in guests: flatten(g, e["event_id"])

# Upcoming E900: 80 approved + 8 waitlist, nobody checked in yet
up_pool = random.sample(members, 88)
up_guests = [luma_guest(m, up, "approved" if i < 80 else "waitlist", False, i) for i, m in enumerate(up_pool)]
lj("events_get_E900", luma_event(up, {"approved": {"guests": 80, "tickets": 80}, "pending_approval": {"guests": 0, "tickets": 0},
    "waitlist": {"guests": 8, "tickets": 8}, "invited": {"guests": 0, "tickets": 0}, "declined": {"guests": 0, "tickets": 0}}))
lj("events_guests_list_E900", {"entries": up_guests, "has_more": False, "next_cursor": None})
for g in up_guests: flatten(g, "E900")
write("luma_guests_flat", flat_rows)

lj("calendars_get", {"id": CAL_ID, "launch_status": "launched", "tint_color": "#3355ff", "name": org["name"], "slug": "thames-agent-builders-sample",
    "avatar_url": None, "url": "https://luma.com/thames-agent-builders-sample", "description": "SAMPLE calendar", "social_image_url": None, "cover_image_url": None,
    "is_personal": False, "location": {"city": "London", "region": "England", "country": "United Kingdom", "country_code": "GB", "timezone": "Europe/London"},
    "coordinate": {"longitude": org["lon"], "latitude": org["lat"]}, "instagram_handle": None, "twitter_handle": org["organiser_handle"].lstrip("@"),
    "youtube_handle": None, "tiktok_handle": None, "linkedin_handle": None, "website": "https://thames-agent-builders.example",
    "event_defaults": {"visibility": "public", "show_guest_list": True, "feedback_email": {"enabled": True}}})
contacts_entries = []
for m in members:
    if m["events_registered"] == 0 and random.random() < 0.6: continue
    first, last = m["name"].replace(" (fictional)", "").split(" ", 1)
    contacts_entries.append({"id": "cnt-SAMPLE" + m["member_id"], "user_id": "usr-SAMPLE" + m["member_id"], "created_at": m["joined"] + "T12:00:00.000Z",
        "event_approved_count": m["events_registered"], "event_checked_in_count": m["events_attended"], "revenue_usd_cents": 0,
        "tags": [{"id": "tag-SAMPLE-" + t.replace(" ", "-").lower(), "name": t} for t in m["interests"][:2]],
        "membership": None, "name": f"{first} {last}", "avatar_url": None, "email": m["email"], "first_name": first, "last_name": last})
lj("calendars_contacts_list", {"entries": contacts_entries, "has_more": False, "next_cursor": None})
lj("events_ticket_types_list_E900", {"entries": [{"name": "Free", "require_approval": False, "is_hidden": False, "description": "SAMPLE free ticket",
    "valid_start_at": None, "valid_end_at": None, "max_capacity": 80, "type": "free", "cents": 0, "currency": None, "is_flexible": False, "min_cents": 0, "id": TT_FREE}]})
lj("events_coupons_list_E900", {"entries": [], "has_more": False, "next_cursor": None})

# Organiser history docs (persona = organiser of C01; Rohan has no history of his own)
H = ROOT / "organiser_history"; H.mkdir(exist_ok=True)
c01_deals = [d for d in deals if any(e["event_id"] == d["event_id"] for e in c01_events)]
sp_by = {x["sponsor_id"]: x for x in sponsors}
lines = ["# SAMPLE / FICTIONAL organiser history: " + org["name"], "", f"Organiser persona: {org['organiser_name']} ({org['organiser_handle']}). Invented for the demo.", "",
         "| Event | Date | Registered | Checked in | Show-up | Food £ | Food sponsor |", "|---|---|---|---|---|---|---|"]
tr = tc = 0
for e in c01_events:
    tr += e["registrations"]; tc += e["check_ins"]
    lines.append(f"| {e['title']} | {e['date']} | {e['registrations']} | {e['check_ins']} | {e['show_up_rate']:.0%} | {e['food_cost_gbp']} | {sp_by[e['food_sponsor_id']]['company']} |")
lines += ["", f"Overall show-up rate across {len(c01_events)} events: {tc/tr:.1%} ({tc}/{tr}).", "",
          "## What worked (SAMPLE notes)", "- Thursday events beat Tuesdays for turnout.", "- Cold food (wraps, falafel) wasted less than pizza when people arrived late.",
          "- Sponsors said yes faster when the ask named a number and a headcount.", "- A reminder 3 hours before doors cut no-shows (anecdotal, SAMPLE)."]
(H / "past_events_summary_SAMPLE.md").write_text("\n".join(lines) + "\n")
(H / "run_of_show_template_SAMPLE.md").write_text("""# SAMPLE run of show: Thames Agent Builders hack night (fictional)
- 18:00 doors, check-in at the front (Luma QR)
- 18:30 welcome + sponsor thank-you (2 min slot)
- 18:40 three 10-minute talks
- 19:30 food + networking
- 20:30 demos (3 min each)
- 21:30 close, recap post + sponsor thank-you within 24h
""")
mails = []
for d in c01_deals:
    s_ = sp_by[d["sponsor_id"]]
    mails.append(f"--- SAMPLE email thread (fictional) | deal {d['deal_id']} | {s_['company']} | asked {d['asked_on']} | outcome: {d['outcome']} ---\n"
                 f"To: {s_['contact_role']}, {s_['company']}\nSubject: Food for ~{next(e for e in c01_events if e['event_id']==d['event_id'])['check_ins']} London agent builders?\n\n"
                 f"Hi there, we run {org['name']}. Would you cover £{d['ask_gbp']} of food for our next hack night? You'd get a logo on the Luma page and a 2-minute slot.\n"
                 + ("Reply: Happy to! Send the invoice. (SAMPLE)\n" if d["outcome"] == "yes" else ("Reply: Not this time, " + (d["notes"] or "thanks") + ". (SAMPLE)\n" if d["replied"] else "(no reply)\n")))
(H / "sponsor_email_threads_SAMPLE.txt").write_text("\n".join(mails))

# GeoJSON for the map demo
def gj(name, feats):
    (ROOT / "geo").mkdir(exist_ok=True)
    (ROOT / "geo" / f"{name}.geojson").write_text(json.dumps({"type": "FeatureCollection", "name": name + " (SAMPLE)", "features": feats}, indent=1))
gj("communities", [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [c["lon"], c["lat"]]}, "properties": {k: c[k] for k in ("community_id","name","focus","members_estimate","area")}} for c in communities])
gj("events", [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [e["lon"], e["lat"]]}, "properties": {k: e[k] for k in ("event_id","community_id","title","date","registrations","check_ins")}} for e in events + [up]])
cc = {c["community_id"]: c for c in communities}
gj("community_edges", [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[cc[x["source"]]["lon"], cc[x["source"]]["lat"]], [cc[x["target"]]["lon"], cc[x["target"]]["lat"]]]}, "properties": x} for x in edges])

# Network graph JSON: {nodes, links} works as-is with react-force-graph; sigma/graphology can import it too
(ROOT / "graph").mkdir(exist_ok=True)
(ROOT / "graph" / "community_graph.json").write_text(json.dumps({"_notice": "SAMPLE / FICTIONAL community network",
    "nodes": [{"id": c["community_id"], "name": c["name"], "focus": c["focus"], "val": c["members_estimate"], "lat": c["lat"], "lon": c["lon"]} for c in communities],
    "links": [{"source": x["source"], "target": x["target"], "value": x["weight"], "shared_members": x["shared_members"], "co_hosted_events": x["co_hosted_events"],
               "shared_sponsors": x["shared_sponsors"], "shared_speakers": x["shared_speakers"]} for x in edges]}, indent=1))

write("communities", communities); write("sponsors", sponsors); write("events", events + [up])
write("speakers", speakers); write("talks", talks); write("edges", edges)
write("sponsor_deals", deals); write("members", members); write("attendance", attendance); write("organiser_contacts_C01", contacts)
print("C01 show-up:", round(tc/tr, 3), "edges:", len(edges))

# Chat snippets
wa = """[SAMPLE / FICTIONAL WhatsApp export - Thames Agent Builders (SAMPLE)]
14/10/2026, 19:02 - Ada Fernwood (fictional): anyone up for a RAG night in November? feels like everyone is building retrieval stuff
14/10/2026, 19:04 - Kemi Marlow (fictional): yes!! but last time pizza ran out at 7:30 lol
14/10/2026, 19:05 - Jonah Calder (fictional): Lambeth LLM Lab did one in Sept, maybe co-host with them?
14/10/2026, 19:07 - Ada Fernwood (fictional): good shout. who sponsored their food?
14/10/2026, 19:08 - Jonah Calder (fictional): think it was Crustwise Pizza Collective (fictional) again
14/10/2026, 19:10 - Orla Vance (fictional): can we avoid the 19th? Southbank Data Folk have their big one that night
14/10/2026, 19:12 - Ada Fernwood (fictional): ok so Thu 19 Nov is out... 26th?
14/10/2026, 19:15 - Ravi Kestrel (fictional): I can give a 10 min talk on evals
14/10/2026, 19:16 - Ada Fernwood (fictional): amazing. 80 people cap again? we only got ~50 last time
"""
(CHAT / "whatsapp_thames_agent_builders_SAMPLE.txt").write_text(wa)
slack = {"_notice": "SAMPLE / FICTIONAL Slack export", "channel": "#organisers (SAMPLE)", "messages": [
 {"ts": "2026-10-15T10:01:00Z", "user": "Orla Vance (fictional)", "text": "Querypine (fictional) said no this quarter, budget spent"},
 {"ts": "2026-10-15T10:03:00Z", "user": "Ada Fernwood (fictional)", "text": "Stacklark (fictional) sponsored Docklands DevRel Circle last month, worth asking?"},
 {"ts": "2026-10-15T10:05:00Z", "user": "Ravi Kestrel (fictional)", "text": "I know their DevRel lead from a talk, can intro"},
 {"ts": "2026-10-15T10:09:00Z", "user": "Orla Vance (fictional)", "text": "venue: The Loom Workspace (fictional) can do 80, but only Tuesdays/Thursdays"}]}
(CHAT / "slack_organisers_SAMPLE.json").write_text(json.dumps(slack, indent=2))
print(len(communities), len(events)+1, len(sponsors), len(deals), len(members), len(attendance), len(contacts), len(luma))
