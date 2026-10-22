"""Build the REAL London events + sponsors dataset from raw/luma_events.json + scripts/annotations.py.
Writes csv/, json/, README stats. Company-level data only; no personal emails/phones."""
import json, csv, sys, re, pathlib, itertools, collections
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/"scripts")); import annotations as A
TODAY="2026-10-22"; CUTOFF="2025-10-01"
raw=json.load(open(ROOT/"raw/luma_events.json"))
events=[]; claims=[]; excluded=[]
def add_event(e, cl):
    events.append(e)
    for (co,role,conf,quote,src) in cl:
        claims.append(dict(event_id=e["event_id"],event_name=e["name"],event_date=e["date"],community=e["community"],company=co,role=role,confidence=conf,evidence_quote=quote,source_url=src or e["url"]))
for slug,ann in A.LUMA.items():
    r=raw[A.L+slug]; d=r["start_at"][:10]
    shown = r.get("address_mode")=="shown"
    e=dict(event_id="L-"+slug,name=r["name"],url=A.L+slug,date=d,status=ann.get("status","upcoming" if d>TODAY else "past"),
           community=ann["community"],luma_calendar=r.get("calendar_name"),venue=r.get("venue"),area=r.get("area"),
           lat=r.get("lat") if shown else None,lon=r.get("lon") if shown else None,
           approx_size=r.get("guest_count") or None,size_note="Luma guest count shown on page" if r.get("guest_count") else "not shown",
           platform="luma.com",sponsors_listed=len(ann["claims"])>0,source_url=A.L+slug,read_on=TODAY)
    if d<CUTOFF: excluded.append((e["name"],d,e["url"])); continue
    add_event(e,ann["claims"])
for o in A.OTHER:
    d=o["date"]
    e=dict(event_id="O-"+o["slug"],name=o["name"],url=o["url"],date=d,status=o.get("status","upcoming" if d[:10]>TODAY else "past"),
           community=o["community"],luma_calendar=None,venue=o["venue"],area=o["area"],lat=None,lon=None,
           approx_size=o["size"],size_note="attendee/RSVP count shown on page" if o["size"] else "not shown",
           platform=o["platform"],sponsors_listed=len(o["claims"])>0,source_url=o["url"],read_on=TODAY)
    add_event(e,o["claims"])
# Excluded older Luma pages that were fetched but fall outside the window
for u,r in raw.items():
    s=u.split("/")[-1]
    if s not in A.LUMA and "start_at" in r and r["start_at"] and r["start_at"][:10]<CUTOFF: excluded.append((r["name"],r["start_at"][:10],u))
# Sponsors table
by=collections.defaultdict(list)
for c in claims: by[c["company"]].append(c)
evtype=lambda n: "hackathon" if re.search(r"hack|sprint",n,re.I) else ("demo night" if re.search(r"demo",n,re.I) else "meetup / talk night")
sponsors=[]
for co,cl in by.items():
    cat,web=A.CO.get(co,(None,None))
    ev={c["event_id"] for c in cl}
    roles=collections.Counter(c["role"] for c in cl)
    sponsors.append(dict(company=co,website=web,website_note="well-known company domain, not re-checked today" if web else "",category=cat,
        london_events=len(ev),london_events_stated=len({c["event_id"] for c in cl if c["confidence"]=="stated"}),
        food_or_drinks_events=len({c["event_id"] for c in cl if c["role"] in("food","drinks")}),
        venue_events=len({c["event_id"] for c in cl if c["role"]=="venue"}),
        roles=";".join(f"{k}:{v}" for k,v in roles.most_common()),
        event_types=";".join(sorted({evtype(c["event_name"]) for c in cl})),
        communities=";".join(sorted({c["community"] for c in cl})),
        evidence_urls=" ".join(sorted({c["source_url"] for c in cl}))))
sponsors.sort(key=lambda s:(-s["london_events"],s["company"]))
# Communities
comm=collections.defaultdict(list)
for e in events: comm[e["community"]].append(e)
URLS={"Encode Club":"https://luma.com/encode-london-2026","AI Tinkerers London":"https://london.aitinkerers.org/","PyData London":"https://www.meetup.com/pydata-london-meetup/",
 "Django London":"https://www.meetup.com/djangolondon/","JavaScript London":"https://www.meetup.com/javascript-london/","London.js":"https://www.meetup.com/london-js/",
 "Cloud Native London":"https://www.meetup.com/cloud-native-london/","#WPLDN (London WordPress)":"https://www.meetup.com/london-wordpress/","UK AI Agents Lab":"https://luma.com/aiagentslab"}
FOCUS={"Encode Club":"AI + Web3 hackathons","Iterate":"AI x science","Surface":"frontier builders","Dwelly":"company-hosted hackathon","Ramen Space":"founder coworking","Create With":"AI + no-code",
 "LLM London":"LLM practitioners","AI Builders":"AI builders meetup","Claude Community Events":"Claude / Claude Code","OpenUK":"open source","AI for the rest of us":"AI literacy",
 "Ignite London":"AI & deep tech founders","Outpost (formerly AI Demo Nights)":"AI engineers / demo nights / hackathons","Networx London":"tech networking","Led by Community":"community tools",
 "Imperial AI Society x Imperial Blockchain Society":"student AI / Web3","Vercel Events":"vendor devrel","Postman Developer Events":"vendor devrel","AI Demo Days":"AI demos","SHIPYARD":"AI agent hackathons",
 "Unicorn Mafia":"elite dev hackathons","UK AI Agents Lab":"AI agents (student/Imperial)","Paid x Lawhive":"startup operators","Product Hackathons":"product hackathons","Claude Builder Club @ Imperial":"student Claude club",
 "{Tech: Europe}":"agentic AI hackathons","WilbeLABS":"AI x bio","SpaceXAI for London (Grok Bot / Cursor community)":"Grok Bot / Cursor builders","oscarama events":"AI agent hackathons","ODSC AI":"data science",
 "AI Engineer London":"AI engineering","Newspeak House":"civic tech","BlueDot Impact":"AI safety","AI Tinkerers London":"AI engineers","PyData London":"Python data science","Django London":"Python / Django",
 "JavaScript London":"JavaScript","London.js":"JavaScript","Cloud Native London":"cloud native / DevOps","Briefcase x Stripe":"AI fintech","#WPLDN (London WordPress)":"WordPress",
 "Encode: AI for Science Fellowship (Pillar VC x ARIA)":"AI for science"}
communities=[]
for i,(n,evs) in enumerate(sorted(comm.items(),key=lambda x:(-len(x[1]),x[0])),1):
    communities.append(dict(community_id=f"RC{i:02d}",name=n,url=URLS.get(n) or evs[0]["url"],url_note="community page" if n in URLS else "first event page found (no community page captured)",
        focus=FOCUS.get(n,""),events_found=len(evs),sponsor_companies=len({c["company"] for c in claims if c["community"]==n}),event_urls=" ".join(e["url"] for e in evs)))
cid={c["name"]:c["community_id"] for c in communities}
# Edges: shared sponsor companies (any role) + direct links where a sponsor/co-host IS another community in the set
ALIAS={"Encode Hub":"Encode Club","Ramen Space":"Ramen Space","Create With":"Create With","Newspeak House":"Newspeak House","Campaign Lab":None}
cos=collections.defaultdict(set)
for c in claims: cos[c["community"]].add(c["company"])
edges=[]
names=sorted(comm)
for a,b in itertools.combinations(names,2):
    shared=sorted(cos[a]&cos[b])
    direct=[]
    for c in claims:
        t=ALIAS.get(c["company"])
        if t and ((c["community"]==a and t==b) or (c["community"]==b and t==a)): direct.append(f'{c["company"]} {c["role"]} at {c["event_id"]}')
    if shared or direct:
        ev=sorted({c["source_url"] for c in claims if c["community"] in(a,b) and c["company"] in shared})[:6]
        edges.append(dict(source=cid[a],target=cid[b],source_name=a,target_name=b,shared_sponsors=len(shared),shared_sponsor_names=";".join(shared),
            direct_links=len(set(direct)),direct_link_detail=";".join(sorted(set(direct))),weight=len(shared)*2+len(set(direct))*5,evidence_urls=" ".join(ev)))
edges.sort(key=lambda x:-x["weight"])
def w(name,rows):
    (ROOT/"csv").mkdir(exist_ok=True);(ROOT/"json").mkdir(exist_ok=True)
    with open(ROOT/"csv"/f"{name}.csv","w",newline="") as f:
        wr=csv.DictWriter(f,fieldnames=list(rows[0].keys()));wr.writeheader();wr.writerows(rows)
    json.dump({"_notice":"REAL public data collected 22 Oct 2026 from public event pages. Company-level only. Check source_url before reuse.","records":rows},open(ROOT/"json"/f"{name}.json","w"),indent=1,ensure_ascii=False)
w("events",events);w("sponsor_claims",claims);w("sponsors",sponsors);w("communities",communities);w("edges",edges)
json.dump({"nodes":[dict(id=c["community_id"],name=c["name"],val=c["events_found"]) for c in communities],
           "links":[dict(source=e["source"],target=e["target"],value=e["weight"],shared=e["shared_sponsor_names"]) for e in edges]},open(ROOT/"json"/"community_graph.json","w"),indent=1,ensure_ascii=False)
with open(ROOT/"csv"/"excluded_out_of_window.csv","w",newline="") as f:
    wr=csv.writer(f);wr.writerow(["name","date","url","reason"]);[wr.writerow([n,d,u,"before 2025-10-01 window"]) for n,d,u in excluded]
st=dict(events=len(events),past=sum(e["status"]=="past" for e in events),upcoming=sum(e["status"]=="upcoming" for e in events),
        with_sponsors=sum(e["sponsors_listed"] for e in events),claims=len(claims),stated=sum(c["confidence"]=="stated" for c in claims),
        sponsors=len(sponsors),communities=len(communities),edges=len(edges),excluded=len(excluded))
json.dump(st,open(ROOT/"json"/"stats.json","w"),indent=1); print(st)
print("TOP overall:",[(s["company"],s["london_events"]) for s in sponsors[:12]])
print("TOP food/drinks:",[(s["company"],s["food_or_drinks_events"]) for s in sorted(sponsors,key=lambda s:-s["food_or_drinks_events"]) if s["food_or_drinks_events"]][:12])
print("TOP venue:",[(s["company"],s["venue_events"]) for s in sorted(sponsors,key=lambda s:-s["venue_events"]) if s["venue_events"]][:12])
print("TOP edges:",[(e["source_name"],e["target_name"],e["weight"],e["shared_sponsor_names"],e["direct_link_detail"]) for e in edges[:8]])
