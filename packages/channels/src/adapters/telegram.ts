import { timingSafeEqual } from "node:crypto";
import type { InboundMessage } from "../types.js";

/** Read a Telegram update. Posts from bots and messages with no text are skipped. */
export function parseTelegramUpdate(body: unknown, now = new Date()): InboundMessage[] {
  if (Array.isArray(body)) return body.flatMap((item) => parseTelegramUpdate(item, now));
  const record = asRecord(body);
  if (!record) return [];
  const message = asRecord(record.message)
    ?? asRecord(record.edited_message)
    ?? asRecord(record.channel_post)
    ?? (typeof record.text === "string" && record.chat ? record : null);
  if (!message) return [];
  const from = asRecord(message.from);
  if (from?.is_bot === true) return [];
  const text = textOf(message.text) || textOf(message.caption);
  if (!text) return [];
  const chat = asRecord(message.chat);
  const name = [textOf(from?.first_name), textOf(from?.last_name)].filter(Boolean).join(" ")
    || textOf(from?.username)
    || textOf(chat?.title)
    || "telegram";
  const threadId = chat && chat.id != null && String(chat.id).trim() ? String(chat.id) : "telegram";
  return [{
    channel: "telegram",
    from: name,
    text,
    receivedAt: unixTime(message.date, now),
    threadId,
  }];
}

/**
 * Check the Telegram secret header when TELEGRAM_WEBHOOK_SECRET is set.
 * When the secret is empty, the check passes. This function does not call Telegram.
 */
export function telegramSecretOk(header: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!expected) return true;
  const got = header?.trim() ?? "";
  const left = Buffer.from(got);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unixTime(value: unknown, now: Date): string {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isFinite(number) || number <= 0) return now.toISOString();
  const ms = number > 10_000_000_000 ? number : number * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return now.toISOString();
  return date.toISOString();
}
