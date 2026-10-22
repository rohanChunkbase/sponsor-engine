# Security

Sponsor Engine does not send a message by itself.

`DRY_RUN` defaults to `true`. A hosted demo with `DEMO_MODE=true` stays in test mode.

A row reaches `sent` only when all of these are true:

- A person approved it on the dashboard.
- `DRY_RUN` is `false`.
- The recipient is on `ALLOWLIST`.

There is no MCP tool that approves a draft. Do not add one.

The write limit is 40 requests per IP per minute. A spam message goes to the spam lane. It does not create a task.

Do not commit secrets, `.env` files, tokens, guest lists, or private chats. Public sponsor claims need a source URL. Fictional rows stay labelled `SAMPLE`.

Do not invent an email address. A missing public contact stays `needs_contact`.

To report a security problem, open a GitHub issue. Do not paste secrets, tokens, or personal data in the issue.
