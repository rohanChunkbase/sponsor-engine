# Contributing

Sponsor Engine is open source. Another community can run it next week.

Read [AGENTS.md](AGENTS.md) before you change behaviour. Read [SECURITY.md](SECURITY.md) before you touch sending, keys, or stored messages.

## Run it

You need Node.js 20 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Press **Run demo**.

```bash
npm test
npm run typecheck
```

`npm test` is the full check. There is no lint script.

## Changes

Use a conventional commit. Keep the subject in plain language.

```text
feat(quote): show the London market sentence
fix(outbox): keep an unapproved draft unsent
docs: describe how an agent connects
```

Make small commits. One commit has one reason.

Do not commit secrets, `.env`, guest lists, or private chats.

A missing API key must keep the built-in tool. Do not make startup fail when a key is empty.

A new capability needs the dashboard and an MCP tool. Put the logic in one service function. Keep the page and the MCP handler thin.

Do not add an MCP tool that approves a draft.

## Pull requests

Open the pull request against `cursor/sponsor-engine-1c06` unless the task names another base.

Say what changed and how you checked it. Do not paste secrets in the description.
