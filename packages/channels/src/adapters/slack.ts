import { createHmac, timingSafeEqual } from "node:crypto";
import { getReadyDb } from "@sponsor-engine/core";
import { acceptInbound } from "../accept.js";
import type { InboundMessage } from "../types.js";

/** Read a Slack event. Bot posts are skipped. This function does not post a reply. */
export function parseSlackEvent(body: unknown, now = new Date()): InboundMessage[] {
  if (Array.isArray(body)) return body.flatMap((item) => parseSlackEvent(item, now));
  const record = asRecord(body);
  if (!record) return [];
  if (record.type === "url_verification") return [];
  if (record.type === "event_callback" && record.event) return parseSlackEvent(record.event, now);
  const eventType = textOf(record.type);
  if (eventType && eventType !== "message" && eventType !== "app_mention") return [];
  if (record.subtype === "bot_message" || record.bot_id || record.bot_profile) return [];
  const text = textOf(record.text);
  if (!text) return [];
  const from = textOf(record.username) || textOf(record.user) || "slack";
  const threadId = textOf(record.thread_ts) || textOf(record.channel) || "slack";
  return [{
    channel: "slack",
    from,
    text,
    receivedAt: slackTime(record.ts ?? record.event_ts, now),
    threadId,
  }];
}

/** Slack URL check. This is not a chat reply. */
export function slackUrlChallenge(body: unknown): string | null {
  const record = asRecord(body);
  if (record?.type !== "url_verification") return null;
  const challenge = textOf(record.challenge);
  return challenge || null;
}

/**
 * Check a Slack signature when a signing secret is set.
 * When the secret is empty, the check passes. A bad signature does not throw.
 */
export function slackSignatureOk(input: {
  rawBody: string;
  timestamp?: string;
  signature?: string;
  signingSecret?: string;
  nowMs?: number;
}): boolean {
  const secret = input.signingSecret?.trim() ?? "";
  if (!secret) return true;
  const timestamp = input.timestamp?.trim() ?? "";
  const signature = input.signature?.trim() ?? "";
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const now = input.nowMs ?? Date.now();
  const age = Math.abs(now / 1000 - Number(timestamp));
  if (age > 60 * 5) return false;
  const digest = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${input.rawBody}`).digest("hex")}`;
  const left = Buffer.from(digest);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function startSlackBot(env: NodeJS.ProcessEnv = process.env): Promise<{ started: boolean; reason: string }> {
  const token = env.SLACK_BOT_TOKEN?.trim() ?? "";
  const secret = env.SLACK_SIGNING_SECRET?.trim() ?? "";
  if (!token || !secret) {
    return {
      started: false,
      reason: "SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET are not both set. The Slack bot did not start.",
    };
  }
  let bolt: SlackModule;
  try {
    const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<SlackModule>;
    bolt = await load("@slack/bolt");
  } catch {
    return { started: false, reason: "@slack/bolt is not installed. The Slack bot did not start." };
  }
  const app = new bolt.App({ token, signingSecret: secret });
  app.event("message", async ({ event }) => {
    try {
      const [inbound] = parseSlackEvent(event);
      if (!inbound) return;
      await acceptInbound(getReadyDb(), inbound);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      console.error(`Slack message was not saved. ${detail}`);
    }
  });
  const port = Number(env.SLACK_PORT || 3001);
  try {
    await app.start(port);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Slack did not start.";
    return { started: false, reason: `${detail} The Slack bot did not start.` };
  }
  return { started: true, reason: "The Slack bot is running. Replies wait in the outbox." };
}

type SlackModule = {
  App: new (options: { token: string; signingSecret: string }) => {
    event(name: string, handler: (args: { event: unknown }) => Promise<void>): void;
    start(port?: number): Promise<unknown>;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slackTime(value: unknown, now: Date): string {
  const raw = typeof value === "number" ? value : typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : Number.NaN;
  if (!Number.isFinite(raw) || raw <= 0) return now.toISOString();
  const date = new Date(raw > 10_000_000_000 ? raw : raw * 1000);
  if (Number.isNaN(date.getTime())) return now.toISOString();
  return date.toISOString();
}
