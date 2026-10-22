import { timingSafeEqual } from "node:crypto";
import type { InboundMessage } from "../types.js";

type Query = URLSearchParams | Record<string, string | string[] | undefined>;

/**
 * Read a WhatsApp Cloud API webhook.
 * This function does not call WhatsApp. It does not send a reply.
 */
export function parseWhatsAppCloud(body: unknown): InboundMessage[] {
  const root = asRecord(body);
  if (!root) return [];
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const messages: InboundMessage[] = [];
  for (const entry of entries) {
    const changes = asRecord(entry);
    const list = Array.isArray(changes?.changes) ? changes.changes : [];
    for (const change of list) {
      const value = asRecord(asRecord(change)?.value);
      if (!value) continue;
      const names = contactNames(value.contacts);
      const phoneNumberId = textOf(asRecord(value.metadata)?.phone_number_id) || "whatsapp";
      const items = Array.isArray(value.messages) ? value.messages : [];
      for (const item of items) {
        const message = asRecord(item);
        if (!message) continue;
        const text = messageText(message);
        const waId = textOf(message.from);
        if (!text || !waId) continue;
        messages.push({
          channel: "whatsapp",
          from: names.get(waId) || waId,
          text,
          receivedAt: unixTime(message.timestamp),
          threadId: `${phoneNumberId}:${waId}`,
        });
      }
    }
  }
  return messages;
}

/**
 * Answer the Cloud API URL check when WHATSAPP_TOKEN matches.
 * When the token is empty, this returns null. It does not throw.
 */
export function whatsAppChallenge(query: Query, env: NodeJS.ProcessEnv = process.env): string | null {
  const mode = queryValue(query, "hub.mode") || queryValue(query, "hub_mode");
  const token = queryValue(query, "hub.verify_token") || queryValue(query, "hub_verify_token");
  const challenge = queryValue(query, "hub.challenge") || queryValue(query, "hub_challenge");
  const expected = env.WHATSAPP_TOKEN?.trim() ?? "";
  if (!expected || mode !== "subscribe" || !challenge || !same(token, expected)) return null;
  return challenge;
}

function contactNames(value: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (!Array.isArray(value)) return names;
  for (const item of value) {
    const contact = asRecord(item);
    const id = textOf(contact?.wa_id);
    const name = textOf(asRecord(contact?.profile)?.name);
    if (id && name) names.set(id, name);
  }
  return names;
}

function messageText(message: Record<string, unknown>): string {
  const text = textOf(asRecord(message.text)?.body);
  if (text) return text;
  const button = textOf(asRecord(message.button)?.text);
  if (button) return button;
  const interactive = asRecord(message.interactive);
  const choice = textOf(asRecord(interactive?.button_reply)?.title) || textOf(asRecord(interactive?.list_reply)?.title);
  if (choice) return choice;
  for (const key of ["image", "video", "document"]) {
    const caption = textOf(asRecord(message[key])?.caption);
    if (caption) return caption;
  }
  return "";
}

function queryValue(query: Query, key: string): string {
  if (query instanceof URLSearchParams) return query.get(key)?.trim() ?? "";
  const value = query[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return typeof value === "string" ? value.trim() : "";
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unixTime(value: unknown): string {
  const raw = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const date = new Date(raw > 10_000_000_000 ? raw : raw * 1000);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}
