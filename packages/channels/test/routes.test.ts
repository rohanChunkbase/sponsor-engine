import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { resetSingleton } from "@sponsor-engine/db";
import { fixture } from "./helpers.ts";

const root = mkdtempSync(path.join(tmpdir(), "inbound-routes-"));
process.env.SPONSOR_ENGINE_DB = path.join(root, "test.db");
process.env.DRY_RUN = "true";
delete process.env.WHATSAPP_TOKEN;
delete process.env.SLACK_SIGNING_SECRET;
delete process.env.DISCORD_PUBLIC_KEY;
delete process.env.TELEGRAM_WEBHOOK_SECRET;
delete process.env.LLM_BASE_URL;
delete process.env.LLM_MODEL;
resetSingleton();

type Route = { POST: (request: Request) => Promise<Response>; GET?: (request: Request) => Promise<Response> };
const routes: Record<string, Route> = {};

before(async () => {
  routes.inbound = await import("../../../apps/web/app/api/inbound/route.ts");
  routes.whatsapp = await import("../../../apps/web/app/api/inbound/whatsapp/route.ts");
  routes.slack = await import("../../../apps/web/app/api/inbound/slack/route.ts");
  routes.telegram = await import("../../../apps/web/app/api/inbound/telegram/route.ts");
  routes.email = await import("../../../apps/web/app/api/inbound/email/route.ts");
  routes.discord = await import("../../../apps/web/app/api/inbound/discord/route.ts");
});

after(() => {
  resetSingleton();
});

test("POST /api/inbound stores a json message and does not send it", async () => {
  const response = await routes.inbound.POST(jsonRequest("http://127.0.0.1/api/inbound", fixture("webhook.json")));
  assert.equal(response.status, 200);
  const body = await response.json() as { sent: boolean; count: number; results: Array<{ outbox: { status: string } | null }> };
  assert.equal(body.sent, false);
  assert.equal(body.count, 1);
  assert.equal(body.results[0].outbox?.status, "awaiting_approval");
});

test("WhatsApp cloud check fails closed without a token and passes with one", async () => {
  const url = "http://127.0.0.1/api/inbound/whatsapp?hub.mode=subscribe&hub.verify_token=cloud-token&hub.challenge=99";
  const blocked = await routes.whatsapp.GET!(new Request(url));
  assert.equal(blocked.status, 403);
  process.env.WHATSAPP_TOKEN = "cloud-token";
  const allowed = await routes.whatsapp.GET!(new Request(url));
  delete process.env.WHATSAPP_TOKEN;
  assert.equal(allowed.status, 200);
  assert.equal(await allowed.text(), "99");
});

test("POST /api/inbound/whatsapp reads a Cloud API payload and does not send", async () => {
  const response = await routes.whatsapp.POST(jsonRequest("http://127.0.0.1/api/inbound/whatsapp", fixture("whatsapp-cloud.json")));
  const body = await response.json() as { sent: boolean; count: number };
  assert.equal(response.status, 200);
  assert.equal(body.sent, false);
  assert.equal(body.count, 1);
});

test("Slack url check returns the challenge and does not send", async () => {
  const response = await routes.slack.POST(jsonRequest("http://127.0.0.1/api/inbound/slack", JSON.stringify({
    type: "url_verification",
    challenge: "slack-check",
  })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { challenge: "slack-check" });
});

test("Telegram and Discord ignore empty events when no token is set", async () => {
  const telegram = await routes.telegram.POST(jsonRequest("http://127.0.0.1/api/inbound/telegram", JSON.stringify({ update_id: 1 })));
  assert.equal(telegram.status, 200);
  assert.equal((await telegram.json() as { sent: boolean; count: number }).count, 0);
  const discord = await routes.discord.POST(jsonRequest("http://127.0.0.1/api/inbound/discord", JSON.stringify({ type: 1 })));
  assert.equal(discord.status, 200);
  assert.deepEqual(await discord.json(), { type: 1 });
});

test("POST /api/inbound/email reads a pasted email and does not send", async () => {
  const response = await routes.email.POST(new Request("http://127.0.0.1/api/inbound/email", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: fixture("email.txt"),
  }));
  const body = await response.json() as { sent: boolean; count: number; results: Array<{ outbox: { status: string } | null }> };
  assert.equal(response.status, 200);
  assert.equal(body.sent, false);
  assert.equal(body.count, 1);
  assert.equal(body.results[0].outbox?.status, "awaiting_approval");
});

function jsonRequest(url: string, body: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
