import assert from "node:assert/strict";
import { after, test } from "node:test";
import { acceptInbound, parseTelegramUpdate, telegramSecretOk } from "../src/index.ts";
import { fixture, tempDb } from "./helpers.ts";

const db = tempDb();

after(() => {
  db.close();
});

test("telegram fixture keeps the sender, the chat, and the time", () => {
  const [message] = parseTelegramUpdate(JSON.parse(fixture("telegram.json")));
  assert.deepEqual(message, {
    channel: "telegram",
    from: "Ada Fernwood",
    text: "Hi, this is Ada Fernwood from Thames Agent Builders (SAMPLE). Can we book the room on 26 November for 80 people? We are a community and we need food.",
    receivedAt: new Date(1761156600 * 1000).toISOString(),
    threadId: "-100123",
  });
});

test("telegram skips bots and reads an edit or a caption", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  assert.deepEqual(parseTelegramUpdate({
    message: { date: 1761156600, text: "hello", from: { is_bot: true, first_name: "Bot" }, chat: { id: 1 } },
  }), []);
  const [edited] = parseTelegramUpdate({
    edited_message: { date: 1761156600, text: "new text", from: { username: "kemi" }, chat: { id: 9 } },
  });
  assert.equal(edited.from, "kemi");
  assert.equal(edited.text, "new text");
  assert.equal(edited.threadId, "9");
  const [caption] = parseTelegramUpdate({
    channel_post: { date: "1761156600", caption: "room photo", chat: { id: 3, title: "Venue" } },
  }, now);
  assert.equal(caption.from, "Venue");
  assert.equal(caption.text, "room photo");
  assert.deepEqual(parseTelegramUpdate({ update_id: 1 }, now), []);
});

test("telegram secret is optional and a wrong secret fails closed", () => {
  assert.equal(telegramSecretOk(undefined, { TELEGRAM_WEBHOOK_SECRET: "" }), true);
  assert.equal(telegramSecretOk("desk-secret", { TELEGRAM_WEBHOOK_SECRET: "desk-secret" }), true);
  assert.equal(telegramSecretOk("nope", { TELEGRAM_WEBHOOK_SECRET: "desk-secret" }), false);
  assert.equal(telegramSecretOk(undefined, { TELEGRAM_WEBHOOK_SECRET: "desk-secret" }), false);
});

test("a telegram booking waits in the outbox and is not sent", async () => {
  const [inbound] = parseTelegramUpdate(JSON.parse(fixture("telegram.json")));
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
});
