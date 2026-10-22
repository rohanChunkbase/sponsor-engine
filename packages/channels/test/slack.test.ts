import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { acceptInbound, parseSlackEvent, slackSignatureOk, slackUrlChallenge, startSlackBot } from "../src/index.ts";
import { fixture, tempDb } from "./helpers.ts";

const db = tempDb();
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/adapters/slack.ts");

after(() => {
  db.close();
});

test("slack fixture keeps the sender, the channel, and the time", () => {
  const [message] = parseSlackEvent(JSON.parse(fixture("slack.json")));
  assert.deepEqual(message, {
    channel: "slack",
    from: "Ada Fernwood",
    text: "Hi, this is Ada Fernwood from Thames Agent Builders (SAMPLE). Can we book the room on 26 November for 80 people? We are a community and we need food.",
    receivedAt: new Date(1761156600.0001 * 1000).toISOString(),
    threadId: "C555",
  });
});

test("slack skips bots and reads a user id when no name is present", () => {
  assert.deepEqual(parseSlackEvent({
    type: "message",
    subtype: "bot_message",
    bot_id: "B1",
    text: "automated",
    channel: "C1",
    ts: "1761156600.1",
  }), []);
  const [message] = parseSlackEvent({
    type: "message",
    user: "U9",
    text: "40 people",
    channel: "C9",
    thread_ts: "1761156600.100000",
    ts: "1761156700.100000",
  });
  assert.equal(message.from, "U9");
  assert.equal(message.threadId, "1761156600.100000");
  assert.equal(slackUrlChallenge({ type: "url_verification", challenge: "check-me" }), "check-me");
  assert.equal(slackUrlChallenge({ type: "event_callback" }), null);
});

test("slack signature is optional and a wrong signature fails closed", () => {
  const rawBody = fixture("slack.json");
  const timestamp = "1761156600";
  const secret = "slack-secret";
  const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const nowMs = 1761156600 * 1000;
  assert.equal(slackSignatureOk({ rawBody, timestamp, signature, signingSecret: secret, nowMs }), true);
  assert.equal(slackSignatureOk({ rawBody, timestamp, signature: `${signature}00`, signingSecret: secret, nowMs }), false);
  assert.equal(slackSignatureOk({ rawBody, timestamp, signature, signingSecret: secret, nowMs: nowMs + 6 * 60 * 1000 }), false);
  assert.equal(slackSignatureOk({ rawBody, signingSecret: "" }), true);
});

test("slack bot does not start when a token is missing", async () => {
  const noToken = await startSlackBot({ SLACK_BOT_TOKEN: "", SLACK_SIGNING_SECRET: "secret" });
  assert.equal(noToken.started, false);
  assert.match(noToken.reason, /SLACK_BOT_TOKEN/);
  const noSecret = await startSlackBot({ SLACK_BOT_TOKEN: "xoxb-test", SLACK_SIGNING_SECRET: "" });
  assert.equal(noSecret.started, false);
});

test("slack code does not post a reply", () => {
  const source = readFileSync(src, "utf8");
  assert.doesNotMatch(source, /\bsay\(|postMessage|chat\.post/);
});

test("a slack booking waits in the outbox and is not sent", async () => {
  const [inbound] = parseSlackEvent(JSON.parse(fixture("slack.json")));
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
});
