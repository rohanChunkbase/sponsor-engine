# Sponsor Engine integrations

This package connects sponsor tools to Sponsor Engine.
Bring your own tool.
Or use the built-in tool.
The program continues when no key is set.

## Word list

| Word | Meaning |
| --- | --- |
| Provider | One tool behind a small interface. |
| Registry | The list of providers, plus the active provider. |
| Env var | A named value in the process environment. |
| Key | A secret token in an env var. |
| Built-in provider | The local tool. It runs when no key is set. |
| Stub | A provider with the interface and no network call. |
| Fallback | The built-in result after a live call fails. |
| Draft | Text stored on a record. A draft is not an email. |
| MCP | Model Context Protocol. A client uses MCP to call a server. |

## Providers

The package has three interfaces.

| Interface | Built-in provider | Live provider | Stub |
| --- | --- | --- | --- |
| CrmProvider | Built-in CRM (`crm_export.json`) | Zero | Twenty, HubSpot, Notion, Google Sheets |
| MemoryProvider | Built-in memory (keyword search) | Cognee | Mem0 |
| DataSource | Bundled data in `seed/` | Luma, Meetup, Eventbrite, BuilderBase, MLH, Devpost, GitHub, Hacker News, Companies House | None |

The registry selects the provider.
If the key is set, the registry uses that provider.
If the key is not set, the registry uses the built-in provider.
`getStatus()` returns one row for each provider.
Each row has the name, `connected` (yes or no), and `missing` (the env vars).

Zero creates companies, contacts, deals, and notes.
Cognee stores documents and answers a query.
Luma reads the London discover feed and one calendar feed.
Meetup and Eventbrite add London tech events.
BuilderBase and MLH list hackathon organisers.
Devpost reads hackathons and project search.
GitHub and Hacker News feed the builder check.
Companies House reads the public search page.
Set `COMPANIES_HOUSE_API_KEY` to use the official Companies House API.
Set `GITHUB_TOKEN` to raise the GitHub rate limit.
The public GitHub limit is 60 requests per hour.
The spam check uses a local model.
The model does not call the network.

WARNING: Do not send email from these adapters. Create a record or a draft note only.

## Env vars

| Env var | Provider | Required | Effect |
| --- | --- | --- | --- |
| `ZERO_API_KEY` | Zero | Yes for Zero | Bearer token. `ZERO_API_TOKEN` is the same key. |
| `ZERO_WORKSPACE_ID` | Zero | Yes for Zero | Workspace id on each record. |
| `ZERO_API_BASE` | Zero | No | Default `https://api.zero.inc`. |
| `COGNEE_API_KEY` | Cognee | Yes for Cognee | API key. This is the only required Cognee env var. |
| `COGNEE_URL` | Cognee | No | Server URL. `COGNEE_BASE_URL` is the same URL. A missing URL uses Cognee Cloud. |
| `COGNEE_TENANT_ID` | Cognee | No | Sends the header `X-Tenant-Id` when set. |
| `COMPANIES_HOUSE_API_KEY` | Companies House | No | Official API. The public page works with no key. |
| `GITHUB_TOKEN` | GitHub | No | Bearer token. The public profile works with no key. |
| `TWENTY_API_URL` | Twenty | Stub | Not called. |
| `TWENTY_API_KEY` | Twenty | Stub | Not called. |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot | Stub | Not called. |
| `NOTION_API_KEY` | Notion | Stub | Not called. |
| `NOTION_SPONSORS_DATABASE_ID` | Notion | Stub | Not called. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Google Sheets | Stub | Not called. |
| `GOOGLE_SHEETS_API_KEY` | Google Sheets | Stub | Not called. |
| `MEM0_API_KEY` | Mem0 | Stub | Not called. |
| `SPONSOR_ENGINE_DATA_DIR` | Built-in | No | Folder for `crm_export.json`, memory, and cache. |
| `SEED_DATA_DIR` | Built-in | No | Folder for the bundled data. |
| `SPONSOR_ENGINE_OFFLINE` | Built-in | No | Set to `1` to skip live data calls. |

An empty string is the same as a missing env var.
Make a key in Zero at Settings, Connections, API keys.
Copy the workspace id from the same page.
Zero MCP at `https://api.zero.inc/mcp` uses OAuth.
The REST adapter uses `ZERO_API_KEY` as the bearer token.
Cognee Cloud uses the header `X-Api-Key`.
A self-hosted Cognee URL uses a bearer token.
Cognee Cloud is live-tested.
Set `COGNEE_API_KEY` to connect Cognee Cloud.
Leave `COGNEE_URL` empty for Cognee Cloud.
Set `COGNEE_URL` when you run your own Cognee server.

## How to wire it in

Do these steps from the repository root.

1. Install the package.

```bash
npm install --prefix packages/integrations
```

2. Build the package.

```bash
npm run build --prefix packages/integrations
```

3. Point the core app at this folder.

```json
{
  "dependencies": {
    "@sponsor-engine/integrations": "file:../integrations"
  }
}
```

Use that path from `packages/dashboard` or from `packages/mcp`.
Change `../integrations` if your app lives in another folder.

4. Import the registry.

```ts
import { createRegistry } from "@sponsor-engine/integrations";

const integrations = createRegistry();
const connections = integrations.getStatus();
```

5. Show `connections` on the Connections screen.
Read `name`, `connected`, and `missing` for each row.
`active` is true for the provider that receives calls.

6. Call the functions.

```ts
await integrations.crm.pushSponsorLead(
  "Anthropic",
  { name: "Ada", email: "ada@example.com" },
  "Draft note for the lead.",
  ["https://luma.com/encode-london-2026"],
);

await integrations.crm.pushDeal("Anthropic", "Encode London Hackathon", 1500, "intro");

await integrations.memory.remember("C01", [
  { title: "Past events", text: "Food sponsors from last year.", kind: "event" },
]);

const memory = await integrations.memory.recall("C01", "which sponsors backed my food before");
const hosts = await integrations.data.lumaEventHosts("evt-Yz7RR89Zlv56tya");
const hackathons = await integrations.data.devpostLondonHackathons();
const company = await integrations.data.companySize("Cloudflare");
const london = await integrations.data.londonEventsIndex();
const sponsors = await integrations.data.findSponsors("L-encode-london-2026");
const leads = await integrations.data.organiserLeads();
const requester = await integrations.data.verifyRequester("octocat");
```

The package exports the same functions by name.
Import `pushSponsorLead`, `pushDeal`, `remember`, and `recall`.
Import `lumaEventHosts`, `devpostLondonHackathons`, `companySize`, and `getStatus`.
Import `londonEventsIndex`, `findSponsors`, and `find_sponsors`.
Import `organiserLeads`, `devpostProjects`, `githubProfile`, and `hackerNewsStories`.
Import `verifyRequester`, `isLikelySpam`, `triageInbound`, and `triage_inbound`.
Import `sponsorMatchEval` and `sponsorMatchReport`.
Those functions read the process env on each call.

`londonEventsIndex()` returns events, venues, and calendars.
Use `venues` on the map.
Use `calendars` for who hosts what.
`findSponsors(eventId)` ranks sponsors of similar events.
The function leaves out the queried event.
`isLikelySpam(text)` returns `{ spam, score, reasons }`.
`triageInbound({ text, handle })` returns lane `spam` or lane `task`.
Lane `spam` does not create a task.
`sponsorMatchReport()` returns precision@3 and recall@5.

7. Read the local CRM when Zero is not connected.

```ts
import { readLocalCrm } from "@sponsor-engine/integrations";

const crm = readLocalCrm();
```

The file is `crm_export.json` in the data folder.

8. Copy the MCP example.
Open `packages/integrations/mcp-config.example.json`.
Copy the Cursor `mcpServers` object into `~/.cursor/mcp.json`.
Copy the Grok Bot `mcpServers` object into the Grok Bot MCP settings.
The file lists Sponsor Engine, Zero, and Cognee in one `mcpServers` object.
Run the three servers at the same time.
The Sponsor Engine command is the core MCP server.
That server imports this package.
Zero MCP asks you to sign in on the first connection.
Cognee MCP runs with `uvx` and reads `COGNEE_BASE_URL` plus `COGNEE_API_KEY`.

## How to add your tool

1. Implement `CrmProvider`, `MemoryProvider`, or `DataSource`.
The interfaces are in `src/crm/types.ts`, `src/memory/types.ts`, and `src/data/types.ts`.
2. Create records or memory only.
Do not send email.
3. Register the provider in `src/crm/select.ts` or `src/memory/select.ts`.
4. Add the env var to `missingEnv`.
Add the same env var to the env var table.
5. Keep the built-in provider as the fallback.
A failed call must return a built-in result.
A failed call must not throw because a key is missing.

The stub files `src/crm/stubs.ts` and `src/memory/mem0.ts` show the shape.
Twenty must create a company and a deal.
HubSpot must create a company, a contact, and a deal.
Notion must add a page in the sponsors database.
Google Sheets must append one row.
Mem0 must store one memory per organiser.

## Commands

Run the unit tests. The tests mock Zero, Cognee, and Companies House.

```bash
npm test --prefix packages/integrations
```

Run the smoke scripts.

```bash
npm run smoke:crm --prefix packages/integrations
npm run smoke:memory --prefix packages/integrations
npm run smoke:live --prefix packages/integrations
npm run smoke:datakit --prefix packages/integrations
npm run smoke:cognee --prefix packages/integrations
npm run eval:sponsors --prefix packages/integrations
```

`smoke:crm` and `smoke:memory` use the built-in providers.
`smoke:live` calls Luma, Devpost, and the Companies House page.
`smoke:datakit` calls the London event sources, organiser leads, and the builder check.
`smoke:cognee` runs only when `COGNEE_API_KEY` is set.
That script writes only to the dataset `sponsor-engine-test`.
`eval:sponsors` prints precision@3 and recall@5.
The same numbers are in `src/eval/sponsor-match-report.json`.
Each live call has a short timeout.
The result uses the bundled data when a call fails.
Live GET calls wait between requests and cache the response for 12 hours.

## Bundled data

`seed/real-data` holds public company data from London event pages.
`seed/synthetic-data` holds fictional sample data.
A fictional name ends with `(fictional)` or `(SAMPLE)`.
Do not show a fictional row as a real company.
The built-in memory searches this data with keywords.
It does not call an embedding model.
Organiser `C01` is the fictional Thames Agent Builders history.

## Zero record shape

The adapter sends these REST calls only.

| Call | Body |
| --- | --- |
| `POST /api/companies` | `workspaceId`, `name`, `domain`, `source`, `externalId` |
| `POST /api/contacts` | `workspaceId`, `companyId`, `name`, `email`, `title`, `linkedin`, `source` |
| `POST /api/deals` | `workspaceId`, `companyId`, `name`, `value`, `stage`, `source` |
| `POST /api/notes` | `workspaceId`, company or deal id, Tiptap `content`, `source` |

The note starts with `Draft only. Do not send this text as email.`
The adapter refuses `/api/sequences` and other send paths.
Auth is `Authorization: Bearer <ZERO_API_KEY>`.

## Cognee record shape

| Call | Body |
| --- | --- |
| `GET /api/v1/tenants/current/service-url` | No body. Header `X-Api-Key`. Used when `COGNEE_URL` is empty. |
| `POST /api/v1/add` | Form field `datasetName` and form field `raw_data` |
| `POST /api/v1/cognify` | `{ "datasets": ["sponsor-engine-<organiserId>"] }` |
| `GET /api/v1/datasets/status?dataset=<id>` | No body. Poll until `DATASET_PROCESSING_COMPLETED`. |
| `POST /api/v1/search` | `{ "query", "datasets", "search_type": "GRAPH_COMPLETION" }` |

The dataset name is `sponsor-engine-` plus the organiser id.
`add` and `search` wait 30 seconds.
The status call and the service URL call use a short timeout.
Built-in memory keeps a copy of each `remember` call.
`recall` uses that copy when Cognee returns no rows.
A missing dataset returns `No Cognee memory yet.`
Cognify starts a run. The adapter polls the dataset status.
The Connections row says `Live-tested` for Cognee.
