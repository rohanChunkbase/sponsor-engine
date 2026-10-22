# New London food & venue sponsors (extension pass, 22 Oct 2026, about 17:16–17:25 BST)

This adds to `../` (the original real-data pack), which is **unchanged**. Everything here is public, company-level data. There are no personal emails, phones or attendee lists. Raw Luma HTML (it contains guest names) was fetched to a temp folder and deleted. `raw/luma_events.json` keeps only the public fields that `fetch_luma.py` extracts.

## Files
| File | What |
|---|---|
| `sponsor_claims_new.csv/.json` | 127 claims (event × company × role), same columns as `../csv/sponsor_claims.csv`, plus `is_new_company` |
| `sponsors_new.csv/.json` | 81 companies (56 new, 25 already in `sponsors.csv` with new evidence): website, category, roles, london_events_found, food/venue counts, evidence_urls, notes |
| `events_new.csv/.json` | 49 events not in `../csv/events.csv` (Oct 2025 – Dec 2026) |
| `communities_new.csv/.json` | 34 communities not in `../csv/communities.csv` |
| `excluded_out_of_window_new.csv` | 4 leads dropped: out of window, not in London, or cancelled |
| `stats_new.json` | Counts |
| `scripts/claims_new.py`, `scripts/meta_new.py`, `scripts/build_new.py` | Hand-curated claims with quotes, categories and metadata, and the builder (`python3 scripts/build_new.py`) |
| `scripts/fetch_luma.py` | Copy of the original fetcher, rerouted to a temp folder so `../raw` is not touched |

## Headline counts
- 79 food/drinks/venue claims (58 `stated`): 42 food/drinks and 37 venue.
- 22 food/drinks claims are `stated`, meaning the page names the payer. The rest are `inferred`: the page says food is served, and the host or sole sponsor is our guess at who paid.
- 1 restaurant/caterer was named: Young Nola (Shoreditch, Louisiana Creole). It was credited on X by an attendee of Cantor8's London hackathon. 1 new drinks brand: Origin Coffee (cold brew at Encode Vibe Coding).

## Method
1. X public post search (`x` connector, about 12 reads): queries like "hosting us at their London office", "at our London HQ", "pizza/food … thanks to / courtesy of". Full post text and links were expanded with get_posts_by_ids, and linked Luma pages were followed.
2. Built-in web search for Luma, Meetup, guild.host, eventslist and LinkedIn pages using the phrases "food and drinks provided by", "pizza sponsored by" and "food partner".
3. Public Luma pages were fetched with `fetch_luma.py` (1 request every 2 s, 11 pages). Meetup, guild.host, eventslist and LinkedIn pages were read with WebFetch.
4. Each claim carries a short verbatim quote. Text in brackets inside a quote is our note, not page text.
5. Dedupe: an exact duplicate (same source_url + company + role) is dropped. Two event-level duplicates (London.js at VEED Oct 2026, and Microsoft at UK AI Agents Lab) were removed by hand. `is_new_company` is checked case-insensitively against `../csv/sponsors.csv`.

## Caveats
- **Exa was rate-limited again** (free MCP limit, HTTP 429, on every one of 4 tries). It contributed nothing.
- **X claims (41) are often from attendees or employees, not organisers.** Examples: Graphcore "our London office" (from a Graphcore director), SurrealDB "our London HQ" (co-founder), and Young Nola (an attendee). Treat them as weaker than an event page.
- Approximate dates: some X/LinkedIn-sourced events only have a post date or a "next week" phrase (`event_date` says so). LinkedIn post dates were decoded from activity IDs.
- AWS is used for "Amazon London" (Harness Engineering, Luma 758nubw3) so it matches the existing `AWS` row.
- "AI Native Dev → Tessl" and "Rust London → Zed" are `inferred` co-host links.
- HAProxy (Cloud Native London Jun/Sep 2026) is a stated sponsor. That it pays for pizza is inferred.
- Upcoming events are included because their pages already name sponsors: Elastic London UG tonight (22 Oct) at Tessl, Night Shift Mubit (23 Oct), JSMonthly #211 at AG Grid (29 Oct), Cloud Native London Nov/Dec, and Experimentation London #13 (25 Nov).
- Websites are well-known domains and were not re-checked today.
- Not done: Eventbrite returned nothing useful in search. Meetup was searched by phrase, not crawled group by group. No logged-in data.
