import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { after, test } from "node:test";
import {
  acceptInbound,
  discordPingReply,
  parseDiscordPayload,
  startDiscordBot,
  verifyDiscordRequest,
} from "../src/index.ts";
import { fixture, tempDb } from "./helpers.ts";

const db = tempDb();

after(() => {
  db.close();
});

test("discord fixture keeps the sender, the channel, and the time", () => {
  const [message] = parseDiscordPayload(JSON.parse(fixture("discord.json")));
  assert.deepEqual(message, {
    channel: "discord",
    from: "Ada Fernwood",
    text: "Hi, this is Ada Fernwood from Thames Agent Builders (SAMPLE). Can we book the room on 26 November for 80 people? We are a community and we need food.",
    receivedAt: "2026-10-22T18:10:00.000Z",
    threadId: "555",
  });
});

test("discord skips bots, empty text, and a url check", () => {
  assert.deepEqual(parseDiscordPayload({ type: 1 }), []);
  assert.deepEqual(parseDiscordPayload({ content: "hello", author: { username: "bot", bot: true } }), []);
  assert.deepEqual(parseDiscordPayload({ content: "   ", author: { username: "ada" } }), []);
  assert.deepEqual(discordPingReply({ type: 1 }), { type: 1 });
  assert.equal(discordPingReply({ type: 2 }), null);
});

test("discord reads a library message shape", () => {
  const [message] = parseDiscordPayload({
    content: "40 people on 19 November",
    channelId: "777",
    createdAt: new Date("2026-10-22T19:00:00.000Z"),
    author: { id: "9", username: "priya", globalName: "Priya Shah", bot: false },
  });
  assert.equal(message.from, "Priya Shah");
  assert.equal(message.threadId, "777");
  assert.equal(message.receivedAt, "2026-10-22T19:00:00.000Z");
});

test("discord signature is optional and a wrong signature fails closed", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const hex = Buffer.from(der).subarray(-32).toString("hex");
  const rawBody = fixture("discord.json");
  const timestamp = "1761156600";
  const signature = sign(null, Buffer.from(timestamp + rawBody), privateKey).toString("hex");
  assert.equal(verifyDiscordRequest({ rawBody, signature, timestamp, publicKeyHex: hex }), true);
  assert.equal(verifyDiscordRequest({ rawBody, signature: `${signature}00`, timestamp, publicKeyHex: hex }), false);
  assert.equal(verifyDiscordRequest({ rawBody, publicKeyHex: "" }), true);
  assert.equal(verifyDiscordRequest({ rawBody, publicKeyHex: "zz" }), false);
});

test("discord bot does not start when the token is missing", async () => {
  const result = await startDiscordBot({ ...process.env, DISCORD_BOT_TOKEN: "" });
  assert.equal(result.started, false);
  assert.match(result.reason, /DISCORD_BOT_TOKEN/);
});

test("a discord booking waits in the outbox and is not sent", async () => {
  const [inbound] = parseDiscordPayload(JSON.parse(fixture("discord.json")));
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
});
