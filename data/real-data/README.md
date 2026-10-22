# REAL London tech community events + sponsors (collected 22 Oct 2026)

Separate from the synthetic pack (`/workspace/hackathon/synthetic-data/`). **Everything here is real, public, company-level data** taken from public event pages on 22 Oct 2026, about 12:20–12:30 BST. There are no personal emails or phone numbers. The tables hold no attendee lists or personal contacts. `raw/luma_events.json` keeps each event description as published, which can name speakers or hosts; organiser emails on the pages were left out of the tables.

## Files
| File | What |
|---|---|
| `csv/events.csv` (+ `json/`) | 61 London tech/AI/dev events, 2 Oct 2025 – 10 Nov 2026 (54 past, 1 today = this hackathon, 6 upcoming; 60 list at least one sponsor): name, URL, date, community, Luma calendar, venue/area (only when the page shows it publicly), lat/lon (Luma public addresses only), approx size (Luma guest count or Meetup attendee count, only if shown), platform, source URL |
| `csv/sponsor_claims.csv` | 201 claims, one per event × company × role: role (food, drinks, venue, general, prize_partner, co_host, tech_partner), confidence (`stated` = the page says it; `inferred` = our reading), evidence quote, source URL |
| `csv/sponsors.csv` | 130 companies: website (well-known domain, not re-checked), category, count of London events, of which stated, food/drink events, venue events, roles, event types, communities, evidence URLs |
| `csv/communities.csv` | 42 communities: URL, focus, events found, sponsor companies, event URLs |
| `csv/edges.csv` | 61 community–community links. weight = shared sponsor companies × 2 + direct links × 5 (a community sponsoring, hosting or venue-hosting another's event, e.g. Ramen Space hosting Create With) |
| `json/community_graph.json` | `{nodes, links}` for react-force-graph / sigma.js |
| `csv/excluded_out_of_window.csv` | 8 pages fetched but dated before 1 Oct 2025, so excluded |
| `raw/` | Extracted public Luma fields (`luma_events.json`, host and guest names removed), the URL list and sponsor snippets. Raw HTML was deleted because it contained guest names; re-run `fetch_luma.py` to fetch it again |
| `scripts/fetch_luma.py` | Polite fetcher for public Luma pages (1 request / 2 s; robots.txt allows event pages) |
| `scripts/annotations.py` | Hand-curated sponsor claims with quotes; company categories |
| `scripts/build.py` | Rebuilds every table: `python3 scripts/build.py` |

## Method
1. Web search (Exa was rate-limited all session, so we used the built-in web search) for London Luma, Meetup and hackathon pages naming sponsors.
2. Fetched each public Luma page and read the page's own data (name, `start_at`, calendar, `geo_address_info` when public, `guest_count`, description).
3. Read the sponsor lines by hand into `annotations.py`, with a quote for every claim.
4. Meetup, AI Tinkerers, hackalendar, Neo News and LinkedIn pages were read with a fetch, and their quotes were copied in.

## Caveats
- Window is about 12 months (from 1 Oct 2025). 6 events are upcoming and 1 is today; they are included because the pages already name sponsors.
- "Encode Hub" and other venue counts include communities hosting their own events (Encode Club at Encode Hub).
- London.js April and July sponsors are inferred from event titles ("London.js with incident.io"). The Cloud Native London sponsor (TechShack) is listed at series level, not per event.
- Food payers are rarely named. Most "food" rows are a tech company paying ("food and drink, thanks to Anthropic"). Only one caterer (Swift Food) and two coffee/oat-milk brands (Square Mile, Minor Figures, inferred from a workshop) appear. No pizza brand was found.
- Luma `guest_count` is what the page shows (often "N went"), not check-ins.
- Not covered: X posts (the X connector was not used), Eventbrite, and logged-in data.
