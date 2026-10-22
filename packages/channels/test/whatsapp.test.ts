import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { repoRoot } from "@sponsor-engine/db";
import { acceptInbound, parseWhatsAppExport } from "../src/index.ts";
import { fixture, tempDb } from "./helpers.ts";

const db = tempDb();

after(() => {
  db.close();
});

test("whatsapp fixture keeps senders, extra lines, and clock time", () => {
  const messages = parseWhatsAppExport(fixture("whatsapp.txt"));
  assert.equal(messages.length, 4);
  assert.equal(messages[0].channel, "whatsapp");
  assert.equal(messages[0].from, "Ada Fernwood");
  assert.equal(
    messages[0].text,
    "Can we book the room\non 26 November for 80 people? We are a community and we need food.",
  );
  assert.equal(messages[0].receivedAt, "2026-10-14T19:02:00.000Z");
  assert.equal(messages[1].from, "Priya Shah");
  assert.equal(messages[1].receivedAt, "2026-10-22T18:04:05.000Z");
  assert.equal(messages[1].text, "Thursday works.");
  assert.equal(messages[2].from, "Jonah Calder");
  assert.equal(messages[2].receivedAt, "2026-10-14T19:05:00.000Z");
  assert.equal(messages[3].from, "Orla Vance");
  assert.equal(messages[3].receivedAt, "2026-10-14T19:06:15.000Z");
  assert.equal(new Set(messages.map((message) => message.threadId)).size, 1);
  assert.match(messages[0].threadId, /^whatsapp-[a-f0-9]{12}$/);
  assert.equal(messages.some((message) => /encrypted/i.test(message.text)), false);
});

test("whatsapp sample export has many senders", () => {
  const file = path.join(repoRoot(), "data/synthetic-data/chat_exports/whatsapp_thames_agent_builders_SAMPLE.txt");
  const messages = parseWhatsAppExport(readFileSync(file, "utf8"));
  assert.equal(messages.length, 9);
  assert.equal(messages[0].from, "Ada Fernwood (fictional)");
  assert.equal(messages[0].receivedAt, "2026-10-14T19:02:00.000Z");
  assert.match(messages[0].text, /RAG night/);
  assert.equal(messages[8].from, "Ada Fernwood (fictional)");
  assert.match(messages[8].text, /80 people/);
  assert.equal(new Set(messages.map((message) => message.from)).size, 5);
  assert.equal(new Set(messages.map((message) => message.threadId)).size, 1);
});

test("a hidden left-to-right mark does not hide the sender", () => {
  const messages = parseWhatsAppExport("\u200e14/10/2026, 19:08 - Kemi Marlow: yes, 40 people");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].from, "Kemi Marlow");
  assert.equal(messages[0].receivedAt, "2026-10-14T19:08:00.000Z");
});

test("a whatsapp booking waits in the outbox and is not sent", async () => {
  const [inbound] = parseWhatsAppExport(fixture("whatsapp.txt"));
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
});

test("an empty export returns no messages", () => {
  assert.deepEqual(parseWhatsAppExport(""), []);
  assert.deepEqual(parseWhatsAppExport("not a chat export"), []);
});
