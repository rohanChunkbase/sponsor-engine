import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { acceptInbound, parseWhatsAppCloud, whatsAppChallenge } from "../src/index.ts";
import { fixture, tempDb } from "./helpers.ts";

const db = tempDb();
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/adapters/whatsapp-cloud.ts");

after(() => {
  db.close();
});

test("whatsapp cloud fixture keeps the name, the chat, and the time", () => {
  const [message] = parseWhatsAppCloud(JSON.parse(fixture("whatsapp-cloud.json")));
  assert.deepEqual(message, {
    channel: "whatsapp",
    from: "Ada Fernwood",
    text: "Hi, this is Ada Fernwood from Thames Agent Builders (SAMPLE). Can we book the room on 26 November for 80 people? We are a community and we need food.",
    receivedAt: new Date(1761156600 * 1000).toISOString(),
    threadId: "123456:447700900123",
  });
});

test("whatsapp cloud skips status notices and reads a caption", () => {
  assert.deepEqual(parseWhatsAppCloud({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: { statuses: [{ id: "wamid", status: "delivered" }] } }] }],
  }), []);
  const [caption] = parseWhatsAppCloud({
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: "999" },
          messages: [{ from: "447700900999", timestamp: "1761156700", type: "image", image: { caption: "40 people on 19 November" } }],
        },
      }],
    }],
  });
  assert.equal(caption.from, "447700900999");
  assert.equal(caption.text, "40 people on 19 November");
  assert.equal(caption.threadId, "999:447700900999");
});

test("whatsapp cloud check uses WHATSAPP_TOKEN and does not throw when it is empty", () => {
  const query = new URLSearchParams("hub.mode=subscribe&hub.verify_token=cloud-token&hub.challenge=12345");
  assert.equal(whatsAppChallenge(query, { WHATSAPP_TOKEN: "cloud-token" }), "12345");
  assert.equal(whatsAppChallenge(query, { WHATSAPP_TOKEN: "other" }), null);
  assert.equal(whatsAppChallenge(query, { WHATSAPP_TOKEN: "" }), null);
  assert.equal(whatsAppChallenge({ "hub.mode": "subscribe", "hub.verify_token": "cloud-token", "hub.challenge": "99" }, { WHATSAPP_TOKEN: "cloud-token" }), "99");
});

test("whatsapp cloud code does not call the send API", () => {
  const source = readFileSync(src, "utf8");
  assert.doesNotMatch(source, /graph\.facebook\.com|baileys|whatsapp-web/i);
});

test("a whatsapp cloud booking waits in the outbox and is not sent", async () => {
  const [inbound] = parseWhatsAppCloud(JSON.parse(fixture("whatsapp-cloud.json")));
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
});
