import { createPublicKey, verify } from "node:crypto";
import { getReadyDb } from "@sponsor-engine/core";
import { acceptInbound } from "../accept.js";
import type { InboundMessage } from "../types.js";

const ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Read a Discord message, a gateway event, or a list of messages. Bot posts are skipped. */
export function parseDiscordPayload(body: unknown, now = new Date()): InboundMessage[] {
  if (Array.isArray(body)) return body.flatMap((item) => parseDiscordPayload(item, now));
  const record = asRecord(body);
  if (!record) return [];
  if (record.t === "MESSAGE_CREATE" && record.d) return parseDiscordPayload(record.d, now);
  if (record.type === 1) return [];
  const text = textOf(record.content);
  const author = asRecord(record.author);
  if (!text || !author || author.bot === true) return [];
  const from = textOf(author.global_name) || textOf(author.globalName) || textOf(author.username) || textOf(author.id) || "discord";
  const threadId = textOf(record.channel_id) || textOf(record.channelId) || "discord";
  return [{
    channel: "discord",
    from,
    text,
    receivedAt: timeOf(record.timestamp ?? record.createdAt, now),
    threadId,
  }];
}

/** Discord URL check. This is not a chat reply. */
export function discordPingReply(body: unknown): { type: 1 } | null {
  const record = asRecord(body);
  return record?.type === 1 ? { type: 1 } : null;
}

/**
 * Check a Discord signature when DISCORD_PUBLIC_KEY is set.
 * When the key is empty, the check passes. A bad signature does not throw.
 */
export function verifyDiscordRequest(input: {
  rawBody: string;
  signature?: string;
  timestamp?: string;
  publicKeyHex?: string;
}): boolean {
  const keyHex = input.publicKeyHex?.trim() ?? "";
  if (!keyHex) return true;
  const signature = input.signature?.trim() ?? "";
  const timestamp = input.timestamp?.trim() ?? "";
  if (!signature || !timestamp) return false;
  try {
    const rawKey = Buffer.from(keyHex, "hex");
    if (rawKey.length !== 32) return false;
    const key = createPublicKey({ key: Buffer.concat([ED25519_PREFIX, rawKey]), format: "der", type: "spki" });
    const signed = Buffer.from(signature, "hex");
    return verify(null, Buffer.from(timestamp + input.rawBody), key, signed);
  } catch {
    return false;
  }
}

export async function startDiscordBot(env: NodeJS.ProcessEnv = process.env): Promise<{ started: boolean; reason: string }> {
  const token = env.DISCORD_BOT_TOKEN?.trim() ?? "";
  if (!token) return { started: false, reason: "DISCORD_BOT_TOKEN is not set. The bot did not start." };

  let discord: DiscordModule;
  try {
    const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<DiscordModule>;
    discord = await load("discord.js");
  } catch {
    return { started: false, reason: "discord.js is not installed. The bot did not start." };
  }

  const bits = discord.GatewayIntentBits;
  const client = new discord.Client({
    intents: [bits.Guilds, bits.GuildMessages, bits.MessageContent, bits.DirectMessages].filter((value) => typeof value === "number"),
  });
  client.on(discord.Events.MessageCreate, (message) => {
    const [inbound] = parseDiscordPayload(message);
    if (!inbound) return;
    void acceptInbound(getReadyDb(), inbound).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : "unknown error";
      console.error(`Discord message was not saved. ${detail}`);
    });
  });
  try {
    await client.login(token);
  } catch (error) {
    client.destroy();
    const detail = error instanceof Error ? error.message : "Discord login failed.";
    return { started: false, reason: `${detail} The bot did not start.` };
  }
  return { started: true, reason: "The Discord bot is running. Replies wait in the outbox." };
}

type DiscordModule = {
  Client: new (options: { intents: number[] }) => {
    on(event: string, handler: (message: Record<string, unknown>) => void): void;
    login(token: string): Promise<unknown>;
    destroy(): void;
  };
  GatewayIntentBits: Record<string, number>;
  Events: { MessageCreate: string };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function timeOf(value: unknown, now: Date): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return now.toISOString();
}
