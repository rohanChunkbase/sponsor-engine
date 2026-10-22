---
title: Tech stack and integrations
description: Built-in defaults, optional providers, env vars, and how each piece was tested.
---

Each table is one layer. A row names the piece, the built-in default, the optional provider, the env var, and the status.

Status words:

- **live-tested** means `packages/integrations/scripts/smoke-datakit.ts` or `smoke-live.ts` got a real response in this check.
- **mock-tested** means a unit test passed a fake HTTP response or a fixture file. The test did not call the public service.
- **unit-tested** means the tests ran the local code. The test called no external service.
- **stub** means the code does not call the network.
- **no test** means the code is present and no test runs it.

Do not read the word `live` inside a unit test as live-tested. Those tests pass a `fetchImpl` fake.

## App

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Next.js dashboard | `apps/web` | none | none | no test |
| Tailwind CSS | `apps/web/app/globals.css` | none | none | no test |
| shadcn/ui | `apps/web/components/ui` | none | none | no test |
| Watermelon UI | none in this checkout | one shimmer button on the site branch | none | no test |

The dashboard uses Next.js, Tailwind, and shadcn components (`button`, `card`, `input`, `textarea`, `badge`, `alert`, `separator`). No test renders a page.

The site branch file `apps/site/components/ui/shimmer-button.tsx` copies a Watermelon UI block. No test renders it.

## MCP

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| stdio server | `npm run mcp` | none | `DRY_RUN` | unit-tested |
| streamable HTTP | `npm run mcp:http` and `/api/mcp` | bearer check | `PORT`, `MCP_TOKEN` | unit-tested |

`packages/mcp/test/tools.test.ts` checks the tool list on the server object. `packages/mcp/test/http.test.ts` calls the HTTP handler in process. The test does not open a public port. There is no approve tool.

The channels branch also has a streamable HTTP check in `packages/channels/test/mcp-http.test.ts`. That test starts the handler with a fake token. It does not call a public host.

## Database

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| SQLite | `data/sponsor-engine.db` | another file path | `SPONSOR_ENGINE_DB` | unit-tested |
| Supabase Postgres | unused | `pg` driver and `schema.postgres.sql` | `DATABASE_URL` | unit-tested |

Core tests and MCP tests open a real SQLite file. `packages/db/test/sql.test.ts` only checks that `?` becomes `$1`. No test connects to Postgres. This row is not live-tested.

Seed Postgres with `npm run seed:postgres` after you set `DATABASE_URL`. Use the direct URL on port 5432.

## Memory

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Keyword search | bundled organiser notes | none | none | unit-tested |
| Cognee | off | `add`, `cognify`, `search` | `COGNEE_API_KEY`, `COGNEE_URL` | mock-tested |
| Mem0 | off | none | `MEM0_API_KEY` | stub |

`smoke-memory.ts` recalled eight built-in notes. Cognee was not connected. The Cognee unit test uses a fake `fetch`. Mem0 stores through the built-in memory and does not call Mem0.

## CRM

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Local file | `crm_export.json` | none | none | unit-tested |
| Zero | off | companies, contacts, deals, draft notes | `ZERO_API_KEY`, `ZERO_WORKSPACE_ID` | mock-tested |
| Twenty | off | none | `TWENTY_API_URL`, `TWENTY_API_KEY` | stub |
| HubSpot | off | none | `HUBSPOT_ACCESS_TOKEN` | stub |
| Notion | off | none | `NOTION_API_KEY`, `NOTION_SPONSORS_DATABASE_ID` | stub |
| Google Sheets | off | none | `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_API_KEY` | stub |

`smoke-crm.ts` wrote one built-in lead and one built-in deal. `emailSent` was false. Zero was missing `ZERO_API_KEY` and `ZERO_WORKSPACE_ID`, so the smoke did not call Zero. `packages/integrations/test/crm.test.ts` posts to a fake Zero server.

A stub stays inactive even when its key is set. Calls go to the built-in CRM.

## Models

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Rule-based triage | on | none | none | unit-tested |
| OpenAI-compatible chat | off | OpenAI, OpenRouter, or Ollama | `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | mock-tested |

The model adapter is on the channels branch, in `packages/channels/src/llm.ts`. An empty `LLM_BASE_URL` or an empty `LLM_MODEL` keeps the rule-based reply. The key can be empty. A thrown fetch keeps the rule-based reply. The test uses `fetchImpl`. No test called Ollama or OpenAI on the network.

## Pricing model

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Gradient boosted trees | fit on the SAMPLE history | none | none | unit-tested |
| Nearest bookings | same SAMPLE history | none | none | unit-tested |

`packages/pricing/test/quote.test.ts` fits both models and scores the last 20 percent of rows by date. The rows are fictional. The label is SAMPLE. This is not a live venue.

## Channels

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| JSON webhook | `POST /api/inbound` | none | none | mock-tested |
| WhatsApp export | a `.txt` file | none | none | mock-tested |
| WhatsApp Cloud API | off until a token is set | inbound only | `WHATSAPP_TOKEN` | mock-tested |
| Discord | JSON route | discord.js when a token is set | `DISCORD_BOT_TOKEN` | mock-tested |
| Telegram | parse a webhook update | bot setup | `TELEGRAM_BOT_TOKEN` | mock-tested |
| Slack | URL challenge | Bolt when both tokens are set | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | mock-tested |
| Email | `.eml` or pasted text | none | none | mock-tested |

The package is `packages/channels` on the channels branch. Tests read files in `packages/channels/fixtures`. A missing token does not throw. The bot start tests assert that Discord and Slack do not start with an empty token. No test reached WhatsApp, Discord, Telegram, or Slack on the network.

## Data sources

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Bundled seed | used when a live call fails, or when `SPONSOR_ENGINE_OFFLINE=1` | none | `SPONSOR_ENGINE_OFFLINE`, `SEED_DATA_DIR` | unit-tested |
| Luma event | public event page | none | none | live-tested |
| Luma discover | London discover feed | none | none | live-tested |
| Luma calendar (ICS) | calendar feed from discover | none | none | live-tested |
| Meetup | London tech events | none | none | live-tested |
| Eventbrite | public listing | none | none | live-tested |
| BuilderBase | public discovery rows | none | none | live-tested |
| MLH | public season events | none | none | live-tested |
| Devpost hackathons | London hackathon search | none | none | live-tested |
| Devpost projects | public project search | none | none | live-tested |
| GitHub | public profile API | higher limit | `GITHUB_TOKEN` | mock-tested |
| Hacker News | public item API | none | none | live-tested |
| Companies House | public company page | official API | `COMPANIES_HOUSE_API_KEY` | live-tested |
| SMS spam model | committed naive Bayes file | none | none | unit-tested |

This check ran the two smoke scripts with no API keys.

Live results from that run:

- Luma discover returned 50 events. The ICS calendar returned 4 events. One Luma event page returned 6 hosts.
- Meetup returned 27 events. Eventbrite returned 19 events.
- BuilderBase returned 29 organiser rows. MLH returned 93 season rows.
- Devpost hackathon search returned 11 rows. Devpost project search for `octocat` returned 6 projects.
- Hacker News returned 3 stories for `octocat`.
- Companies House public page matched CLOUDFLARE LIMITED. The smoke did not use the official API. The API path is mock-tested in `packages/integrations/test/data.test.ts`.
- GitHub returned HTTP 403. `verifyRequester` still scored the Devpost and Hacker News results. GitHub stays mock-tested.

The SMS model ran on two local sentences. A prize claim scored spam. A meetup note scored ham. The model does not use the network.

## Hosting

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Vercel | `apps/web/vercel.json` | Supabase Postgres | `DATABASE_URL`, `DEMO_MODE`, `NEXT_PUBLIC_APP_URL`, `DRY_RUN`, `MCP_TOKEN` | no test |

`vercel.json` sets the install command and the build command. No test in this repository deploys the app.

## Docs

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| Mintlify | this file | none | none | stub |
| Next.js MDX | none in this checkout | `apps/site` on the site branch | none | no test |

This file has Mintlify frontmatter. The repository has no `mint.json` and no Mintlify config. The site branch renders MDX with Next.js. No test builds that site.

## Cards

| What | Default | Optional | Env var | Status |
| --- | --- | --- | --- | --- |
| `@vercel/og` | none | none | none | stub |

No source file imports `@vercel/og`. There is no OG image route.
