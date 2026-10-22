# SAMPLE / FICTIONAL London community data pack

Built for Rohan's Grok Bot Community Engineering hackathon demo (22 Oct 2026). **Every community, person, company, email and number here is invented.**
Company names carry "(fictional)", communities "(SAMPLE)", people "(fictional)", every row has `is_sample=SAMPLE`, emails use the reserved `example.com` / `example.org` domains. Do not present any of it as real.

## What's inside
| Path | What |
|---|---|
| `csv/` and `json/` (same data) | `communities` (15), `events` (62 past + 1 upcoming E900), `sponsors` (40), `sponsor_deals` (asked / replied / yes-no / £), `members` (200, interests + attendance history), `attendance` (member × event), `speakers` + `talks`, `edges` (community–community weights), `organiser_contacts_C01` (60-person personal network), `luma_guests_flat` (Luma guest lists flattened) |
| `luma/` | Responses shaped like Luma's API (field names from `public-api.luma.com/openapi.json`): `events_get_*`, `events_guests_list_*` (10 past C01 events + upcoming E900), `calendars_get`, `calendars_contacts_list`, `events_ticket_types_list_E900`, `events_coupons_list_E900`. IDs are fake; `_notice` is not a real Luma field. |
| `organiser_history/` | The organiser persona's history (Rohan has none of his own): past-event summary (10 events, 62.1% show-up), sponsor email threads, run-of-show template, what-worked notes |
| `chat_exports/` | WhatsApp-style text export and Slack-style JSON snippets (organiser chatter: co-host idea, date clash, sponsor intro) |
| `geo/` | GeoJSON for the map: communities, events, community edges as lines |
| `graph/community_graph.json` | `{nodes, links}` for react-force-graph / sigma.js |
| `sql/schema.sql`, `sql/seed.sql` | Postgres / Supabase schema + inserts |
| `sample.db` | SQLite (Tier 0), built by the loader |

## Coherence rules
- Show-up rate per event 50–75%; the organiser persona (C01, "Thames Agent Builders") averages 62.1% over 10 events.
- Food cost = check-ins × £5–6. Each past event has exactly one "yes" food sponsor at that amount, plus 1–3 earlier no / no-reply asks.
- Luma guest lists for C01 match `events.csv` exactly (registrations and check-ins); sample members keep the same status as `attendance.csv`, other registrants are extra fictional guests.
- Edge weight = shared_members×1 + co_hosted_events×5 + shared_sponsors×2 + shared_speakers×3.

## Load it
```bash
python3 scripts/generate.py        # regenerate (deterministic, seed 42)
python3 scripts/build_sql.py       # -> sql/schema.sql, sql/seed.sql
python3 scripts/load_sqlite.py     # -> sample.db (Tier 0)
python3 scripts/verify.py          # parse + coherence checks
# Supabase / Postgres (Tier 1):
psql "$DATABASE_URL" -f sql/schema.sql -f sql/seed.sql
```
SQLite load is tested. Both SQL files parse with the Postgres parser (pglast); not yet run against a live Supabase instance.
