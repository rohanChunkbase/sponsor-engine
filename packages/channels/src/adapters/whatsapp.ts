import { createHash } from "node:crypto";
import type { InboundMessage } from "../types.js";

const DASH =
  /^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp][Mm]))?\s+[-–—]\s+([^:\n]+):\s?([\s\S]*)$/;
const BRACKET =
  /^\[(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp][Mm]))?\]\s+([^:\n]+):\s?([\s\S]*)$/;
const STAMP = /^(?:\[)?\d{1,4}[./-]\d{1,2}[./-]\d{1,4},\s+\d{1,2}:\d{2}/;

/**
 * Read a WhatsApp .txt export.
 * Several senders and several lines are kept. System lines are skipped.
 * The file has no time zone. The clock time is stored as UTC.
 */
export function parseWhatsAppExport(raw: string): InboundMessage[] {
  const cleaned = clean(raw);
  if (!cleaned.trim()) return [];
  const threadId = `whatsapp-${createHash("sha256").update(cleaned).digest("hex").slice(0, 12)}`;
  const messages: InboundMessage[] = [];
  let current: InboundMessage | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.text.trim();
    if (text) messages.push({ ...current, text });
    current = null;
  };

  for (const line of cleaned.split("\n")) {
    const parsed = parseLine(line);
    if (parsed) {
      flush();
      current = { channel: "whatsapp", from: parsed.from, text: parsed.text, receivedAt: parsed.receivedAt, threadId };
      continue;
    }
    if (STAMP.test(line.trim())) {
      flush();
      continue;
    }
    if (current) current = { ...current, text: `${current.text}\n${line}` };
  }
  flush();
  return messages;
}

function clean(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g, "")
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function parseLine(line: string): { from: string; text: string; receivedAt: string } | null {
  const match = line.trim().match(DASH) ?? line.trim().match(BRACKET);
  if (!match) return null;
  const receivedAt = toIso({
    a: Number(match[1]),
    b: Number(match[2]),
    c: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: match[6] ? Number(match[6]) : 0,
    ampm: match[7],
  });
  const from = match[8].trim();
  if (!receivedAt || !from) return null;
  return { from, text: match[9], receivedAt };
}

function toIso(input: {
  a: number;
  b: number;
  c: number;
  hour: number;
  minute: number;
  second: number;
  ampm?: string;
}): string | null {
  const date = dateParts(input.a, input.b, input.c, input.ampm);
  const hour = hour24(input.hour, input.ampm);
  if (!date || hour == null) return null;
  if (input.minute > 59 || input.second > 59) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(hour)}:${pad(input.minute)}:${pad(input.second)}.000Z`;
}

function dateParts(a: number, b: number, c: number, ampm?: string): { day: number; month: number; year: number } | null {
  if (a > 31) return valid(c, b, a);
  const year = c < 100 ? 2000 + c : c;
  if (ampm && a <= 12 && b <= 12) return valid(b, a, year);
  if (a > 12) return valid(a, b, year);
  if (b > 12) return valid(b, a, year);
  return valid(a, b, year);
}

function valid(day: number, month: number, year: number): { day: number; month: number; year: number } | null {
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) return null;
  return { day, month, year };
}

function hour24(hour: number, ampm?: string): number | null {
  if (!ampm) return hour >= 0 && hour <= 23 ? hour : null;
  if (hour < 1 || hour > 12) return null;
  if (hour === 12) return ampm.toLowerCase() === "pm" ? 12 : 0;
  return ampm.toLowerCase() === "pm" ? hour + 12 : hour;
}
