import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { acceptAll, acceptInbound, parseJsonInbound } from "../src/index.ts";
import { fixture, tempDb } from "./helpers.ts";

const db = tempDb();
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

after(() => {
  db.close();
});

test("json webhook fixture becomes one inbound message", () => {
  const messages = parseJsonInbound(JSON.parse(fixture("webhook.json")));
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0], {
    channel: "web",
    from: "Ada Fernwood",
    text: "Hi, this is Ada Fernwood from Thames Agent Builders (SAMPLE). Can we book Expedite on 26 November for 80 people? We are a community and we need food.",
    receivedAt: "2026-10-22T18:00:00.000Z",
    threadId: "desk-1",
  });
});

test("json webhook accepts aliases and a message list", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const messages = parseJsonInbound(
    {
      messages: [
        { sender: "Jonah", message: "About 40 people on 19 November.", thread_id: "room-2" },
        { body: "   " },
        "skip",
      ],
    },
    now,
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].channel, "web");
  assert.equal(messages[0].from, "Jonah");
  assert.equal(messages[0].text, "About 40 people on 19 November.");
  assert.equal(messages[0].threadId, "room-2");
  assert.equal(messages[0].receivedAt, now.toISOString());
});

test("bad json does not throw", () => {
  assert.deepEqual(parseJsonInbound(null), []);
  assert.deepEqual(parseJsonInbound("hello"), []);
  assert.deepEqual(parseJsonInbound({ from: "Ada" }), []);
});

test("a webhook message waits in the outbox and is not sent", async () => {
  const [inbound] = parseJsonInbound(JSON.parse(fixture("webhook.json")));
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
  assert.match(receipt.outbox?.body ?? "", /Thanks Ada/);
});

test("a short webhook message is still only a draft", async () => {
  const [inbound] = parseJsonInbound({
    channel: "web",
    from: "Sam",
    text: "hey can someone look later",
    threadId: "short-1",
  });
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, false);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
});

test("acceptAll stops at the limit and does not send", async () => {
  const messages = parseJsonInbound({
    messages: [
      { from: "A", text: "first note for the desk today", threadId: "a" },
      { from: "B", text: "second note for the desk today", threadId: "b" },
    ],
  });
  const batch = await acceptAll(db, messages, 1);
  assert.equal(batch.sent, false);
  assert.equal(batch.truncated, true);
  assert.equal(batch.results.length, 1);
});

test("channel source does not call a send function", () => {
  const files = walk(srcDir).filter((file) => file.endsWith(".ts"));
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /deliverOutbox|sendMessage|messages\.send|\.reply\(/);
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
