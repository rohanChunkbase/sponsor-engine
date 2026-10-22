import type { InboundMessage } from "../types.js";

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isoOrNull(value: string): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

/** Read one JSON webhook body into inbound messages. Bad input returns an empty list. */
export function parseJsonInbound(body: unknown, now = new Date()): InboundMessage[] {
  const item = record(body);
  if (!item) return [];
  if (Array.isArray(item.messages)) {
    return item.messages.flatMap((entry) => parseJsonInbound(entry, now));
  }
  const text = textOf(item.text) || textOf(item.message) || textOf(item.body);
  if (!text) return [];
  const from = textOf(item.from) || textOf(item.sender) || textOf(item.sender_name) || "unknown";
  const channel = textOf(item.channel) || "web";
  const receivedAt = isoOrNull(textOf(item.receivedAt) || textOf(item.received_at)) ?? now.toISOString();
  const threadId = textOf(item.threadId) || textOf(item.thread_id) || channel;
  return [{ channel, from, text, receivedAt, threadId }];
}
