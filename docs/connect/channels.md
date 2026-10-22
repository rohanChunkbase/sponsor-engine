# Connect a channel

You keep WhatsApp, Discord, Telegram, Slack, or email. Sponsor Engine reads the message. It does not send a reply.

A reply is a draft in the outbox. The status is `awaiting_approval`. `DRY_RUN` is `true` unless you set it to `false`. A person approves the draft in the dashboard.

Start the dashboard from this project folder:

```bash
npm run dev
```

The routes below are on `http://127.0.0.1:3000`.

## JSON webhook

Send one message to `POST /api/inbound`.

```json
{
  "channel": "web",
  "from": "Ada Fernwood",
  "text": "Can we book the room on 26 November for 80 people?",
  "receivedAt": "2026-10-22T18:00:00.000Z",
  "threadId": "desk-1"
}
```

`receivedAt` and `threadId` are optional. A missing token does not block this route.

## WhatsApp Cloud API

Use the official Cloud API when you have a Meta app. This path is inbound only. Set the callback URL to `https://your-host/api/inbound/whatsapp`. Set the verify token to the same value as `WHATSAPP_TOKEN`.

`GET /api/inbound/whatsapp` answers the Meta URL check. `POST /api/inbound/whatsapp` reads inbound messages. The route does not call the send API.

Leave `WHATSAPP_TOKEN` empty and the process still runs. The URL check then fails closed. Message parsing still works.

## WhatsApp chat export

Use a `.txt` export when you have no key. Export the chat from WhatsApp. Send the file as `text/plain` to `POST /api/inbound/whatsapp`.

One file can hold many lines and many senders. Each line becomes one inbound message.

Baileys and whatsapp-web.js are unofficial clients. They are against the WhatsApp terms. This project does not include them. Do not add them.

## Discord

Set `DISCORD_BOT_TOKEN` and start the bot:

```bash
npx tsx packages/channels/src/discord-bot.ts
```

Turn on the Message Content intent in the Discord developer portal. The bot reads messages. It does not post a reply.

Leave the token empty and the process prints one line, then exits. It does not crash.

You can also `POST` a message JSON to `/api/inbound/discord`. Set `DISCORD_PUBLIC_KEY` when you want Discord signature checks. Leave it empty to accept the JSON.

## Telegram

Point the bot webhook at `https://your-host/api/inbound/telegram`. The route reads updates. It does not call Telegram.

Set `TELEGRAM_WEBHOOK_SECRET` to check the header `X-Telegram-Bot-Api-Secret-Token`. Leave it empty to accept the update.

`TELEGRAM_BOT_TOKEN` is for your own webhook setup. The route does not need it. A missing token does not crash the route.

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://your-host/api/inbound/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

## Slack

Slack uses Bolt for JavaScript. Set both tokens, then start the bot:

```bash
SLACK_BOT_TOKEN=xoxb-replace-me SLACK_SIGNING_SECRET=replace-me npx tsx packages/channels/src/slack-bot.ts
```

The bot listens on port `3001`. Set `SLACK_PORT` to change the port. The bot reads messages. It does not post a reply.

Leave either value empty and the process prints one line, then exits. It does not crash.

You can also `POST` a Slack event to `/api/inbound/slack`. The signing secret checks `X-Slack-Signature` when `SLACK_SIGNING_SECRET` is set.

## Email

Paste an `.eml` file or a short email as `text/plain` to `POST /api/inbound/email`. JSON `{ "eml": "..." }` also works. The route does not send mail.

## Your own model

Triage and drafts use rules when no model is set. Set these three values to call an OpenAI-compatible model. The key can be empty. That lets Ollama answer.

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-replace-me
LLM_MODEL=gpt-4o-mini
```

OpenRouter uses `https://openrouter.ai/api/v1`. Ollama uses `http://127.0.0.1:11434/v1` and a model name. Leave `LLM_API_KEY` empty for Ollama.

A failed model call keeps the rule-based draft. The draft still waits for a person.
