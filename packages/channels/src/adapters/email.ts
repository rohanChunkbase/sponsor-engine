import { createHash } from "node:crypto";
import type { InboundMessage } from "../types.js";

/** Read a .eml file or a pasted email. A plain note with no headers is still one message. */
export function parseEmail(raw: string, now = new Date()): InboundMessage[] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.trim()) return [];
  const splitAt = text.indexOf("\n\n");
  const headerBlock = splitAt === -1 ? text : text.slice(0, splitAt);
  const bodyBlock = splitAt === -1 ? "" : text.slice(splitAt + 2);
  const headers = parseHeaders(headerBlock);
  if (!headers.has("from") && !headers.has("subject") && !headers.has("message-id")) {
    const note = text.trim();
    return [{
      channel: "email",
      from: "email",
      text: note,
      receivedAt: now.toISOString(),
      threadId: threadFor("email", note),
    }];
  }

  const contentType = headers.get("content-type") ?? "";
  let body = bodyBlock;
  const boundary = /boundary="?([^";\s]+)"?/i.exec(contentType)?.[1];
  if (/multipart\//i.test(contentType) && boundary) body = plainPart(bodyBlock, boundary);
  else body = decodeBody(bodyBlock, headers.get("content-transfer-encoding") ?? "");

  const from = sender(headers.get("from") ?? "") || "email";
  const subject = headers.get("subject") ?? "";
  const message = [subject ? `Subject: ${subject}` : "", body.trim()].filter(Boolean).join("\n\n");
  if (!message) return [];
  const messageId = (headers.get("message-id") ?? "").replace(/[<>]/g, "").trim();
  const date = headers.get("date") ?? "";
  const receivedAt = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : now.toISOString();
  return [{
    channel: "email",
    from,
    text: message,
    receivedAt,
    threadId: messageId || threadFor(from, subject || message),
  }];
}

function parseHeaders(block: string): Map<string, string> {
  const map = new Map<string, string>();
  let name = "";
  let value = "";
  const push = () => {
    if (!name) return;
    map.set(name, value.trim().replace(/\s+/g, " "));
    name = "";
    value = "";
  };
  for (const line of block.split("\n")) {
    if (/^[ \t]/.test(line) && name) {
      value += ` ${line.trim()}`;
      continue;
    }
    const match = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    push();
    name = match[1].toLowerCase();
    value = match[2];
  }
  push();
  return map;
}

function sender(from: string): string {
  const angle = /^(.*)<([^>]+)>$/.exec(from.trim());
  if (!angle) return from.trim();
  const name = angle[1].trim().replace(/^"|"$/g, "");
  return name || angle[2].trim();
}

function plainPart(rawBody: string, boundary: string): string {
  let fallback = "";
  for (const part of rawBody.split(`--${boundary}`)) {
    const trimmed = part.replace(/^\n/, "").replace(/\n--\s*$/, "").trim();
    if (!trimmed || trimmed === "--") continue;
    const splitAt = trimmed.indexOf("\n\n");
    const headers = parseHeaders(splitAt === -1 ? trimmed : trimmed.slice(0, splitAt));
    const body = splitAt === -1 ? "" : trimmed.slice(splitAt + 2);
    const decoded = decodeBody(body, headers.get("content-transfer-encoding") ?? "").trim();
    if (!decoded) continue;
    const type = headers.get("content-type") ?? "";
    if (/text\/plain/i.test(type)) return decoded;
    if (/text\/html/i.test(type)) fallback ||= stripHtml(decoded);
    else fallback ||= decoded;
  }
  return fallback;
}

function decodeBody(body: string, encoding: string): string {
  const kind = encoding.toLowerCase().trim();
  try {
    if (kind === "base64") return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
    if (kind === "quoted-printable") return decodeQuotedPrintable(body);
  } catch {
    return body;
  }
  return body;
}

function decodeQuotedPrintable(body: string): string {
  const joined = body.replace(/=\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < joined.length; index += 1) {
    const pair = joined.slice(index + 1, index + 3);
    if (joined[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(pair)) {
      bytes.push(Number.parseInt(pair, 16));
      index += 2;
    } else {
      bytes.push(joined.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function threadFor(from: string, text: string): string {
  return `email-${createHash("sha256").update(`${from}\n${text}`).digest("hex").slice(0, 12)}`;
}
