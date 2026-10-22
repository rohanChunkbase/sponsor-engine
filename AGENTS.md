# Sponsor Engine

Open-source front desk and sponsor engine for communities. A chat request comes in. The service qualifies it, prices it, matches sponsors, and writes a draft. A human approves every send.

This file is the short list. Detail lives in the guides. Start with [README.md](README.md).

## Never compromise

1. **A human approves every outbound message.** `DRY_RUN` defaults to true. Do not spam sponsors. There is no MCP approve tool. Approval is a dashboard action. See [SECURITY.md](SECURITY.md).
2. **Bring your own tool, or use ours.** A missing key must not crash the process. Fall back to the built-in provider. See [packages/integrations/README.md](packages/integrations/README.md).
3. **Open, and runnable by any community next week.** No required secrets. SQLite works with no hosted database.
4. **One service function, two thin transports.** A person can reach a capability from the dashboard and from an MCP tool. Put the logic in one service function. The page and the MCP handler only call it.

## Glossary

- **you** — the agent reading this file.
- **community** — a group that books often, brings leads, and can pay nothing for the room.
- **request** — one inbound message after triage. It has a sender, a date, a headcount, and a kind.
- **quote** — a GBP room price, a range, and a plain-language explanation.
- **sponsor** — a company that might pay. A match has a reason and a source URL.
- **ask** — the amount in the sponsor draft. It matches the food cost. It is not the room price.
- **outbox** — the queue of drafts. A new draft waits at `awaiting_approval`.
- **provider** — a swappable CRM, memory store, model, channel, or data source.
- **bot profile** — the MCP config for one agent: command, args, and env. It is not a database row.
- **workspace** — one visitor's rows. The header is `x-workspace-id`. Shared reference data stays global.

## Ways to hurt yourself

1. **Sending real email.** Leave `DRY_RUN` true. A row is marked sent only after a person approves it, `DRY_RUN` is false, and the address is on `ALLOWLIST`. Do not add a mailer that skips the outbox.
2. **Writing to Luma events other than the test event.** Tests call Luma with `evt-TEST`. Do not create or edit guests on a real event.
3. **Committing secrets or personal data.** No `.env`, tokens, guest lists, or private chats. Public claims need a source URL. Fictional rows stay labelled SAMPLE.
4. **Adding an MCP approve tool.** An agent must not approve its own draft.
5. **Guessing emails.** Do not invent `partnerships@domain`. Use a published contact, or leave the row at `needs_contact`.

## Hit every surface

Say which lines applied before you finish:

- **Dashboard.** Inbox, quote, sponsors, outbox, connections, map, and the MCP page.
- **MCP.** `npm run mcp` (stdio) and `npm run mcp:http` (HTTP). Same tools.
- **Channels.** JSON, WhatsApp, Discord, Telegram, Slack, and email. A missing token still starts. See [docs/connect](docs/connect/README.md).
- **DEMO_MODE.** A public site stays in test mode. It cannot mark a row sent.
- **Database.** SQLite with no `DATABASE_URL`, and Postgres when `DATABASE_URL` is set. Seed Postgres with `npm run seed:postgres`.
- **Docs.** Update the guide when behaviour changes. Do not paste a feature list into this file.

## Where code lives

- `apps/web` — Next.js dashboard.
- `packages/core` — service functions.
- `packages/db` — SQLite and Postgres.
- `packages/pricing` — `quotePrice` and the SAMPLE history. See [packages/pricing/README.md](packages/pricing/README.md).
- `packages/integrations` — providers. A missing key falls back.
- `packages/mcp` — stdio and HTTP. Thin.
- `packages/channels` — channel adapters, when that package is in the tree. Thin.
- `docs/` — guides. [docs/DESIGN.md](docs/DESIGN.md) is the visual rules. [docs/connect](docs/connect/README.md) connects an agent. [docs/stack.md](docs/stack.md) is the tested stack. Do not mark a provider live-tested unless a smoke script or a test called the real service.
- `data/` — public records and SAMPLE files.

## Verify

Run these from the repository root. You need Node.js 20 or later.

```bash
npm test
npm run typecheck
```

`npm test` builds `@sponsor-engine/pricing`, typechecks `packages/db`, `packages/core`, and `packages/mcp`, then runs the pricing, integrations, db, core, and MCP tests.

There is no lint script. Do not document `npm run lint` until a script exists.

`npm run demo` runs one SAMPLE path in the terminal. It does not send.

## Commits and pull requests

- Conventional commits, plain language: `fix(outbox): keep an unapproved draft unsent`.
- Small logical commits. One reason per commit.
- Open pull requests against `cursor/sponsor-engine-1c06` unless the task names another base.
- Do not commit secrets, `.env`, or personal data.
- Application code and files under `docs/` belong to the people who own those trees. A root-doc task does not edit them.
- Read [CONTRIBUTING.md](CONTRIBUTING.md).
