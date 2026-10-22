import type { Db } from "@sponsor-engine/db";
import type { OutboxRow } from "./types.js";
import { makeId, nowIso } from "./util.js";

export const MIN_COOLDOWN_DAYS = 14;
export const DEFAULT_COOLDOWN_DAYS = 30;
export const FOLLOW_UP_WAIT_DAYS = 7;
export const DAILY_ASK_CAP = 5;
export const OPT_OUT_LINE = "Reply no if you would rather we did not write again.";

const OPEN = new Set(["draft", "awaiting_approval", "needs_contact", "approved"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type AskRow = {
  status: string;
  sponsor_id: string | null;
  sponsor_name: string | null;
  recipient: string;
  request_id: string | null;
  community: string | null;
  created_at: string;
  updated_at: string;
  blocked_reason: string | null;
};

export function cooldownDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.SPONSOR_ASK_COOLDOWN_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_COOLDOWN_DAYS;
  return Math.max(MIN_COOLDOWN_DAYS, Math.floor(raw));
}

/** Company domain, or the plus-tag on the test inbox so placeholders stay distinct. */
export function sponsorDomain(recipient: string): string {
  const email = recipient.match(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (email) {
    const local = email[1].toLowerCase();
    const domain = email[2].toLowerCase().replace(/^www\./, "");
    if (domain === "example.com" || domain === "example.org" || domain.endsWith(".example")) {
      return `${domain}/${local.split("+")[1] || local}`;
    }
    return domain;
  }
  const trimmed = recipient.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isOptOut(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[.!]+$/g, "");
  if (!clean) return false;
  if (/^(no|no thanks|no thank you|unsubscribe|not interested|stop|do not contact|don't contact|dont contact)$/.test(clean)) return true;
  return /\b(unsubscribe|not interested|do not contact|don't contact me|dont contact me)\b/.test(clean);
}

export function withOptOut(body: string): string {
  if (body.includes(OPT_OUT_LINE)) return body;
  return `${body.trim()}\n\n${OPT_OUT_LINE}`;
}

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = left?.trim().toLowerCase() ?? "";
  const b = right?.trim().toLowerCase() ?? "";
  return a !== "" && a === b;
}

function sameSponsor(row: AskRow, sponsorId: string, sponsorName: string, domain: string): boolean {
  if (sponsorId && row.sponsor_id === sponsorId) return true;
  if (domain && sponsorDomain(row.recipient) === domain) return true;
  return sameText(row.sponsor_name, sponsorName);
}

function dayLabel(until: Date): string {
  return `${until.getUTCDate()} ${MONTHS[until.getUTCMonth()]}`;
}

function addDays(iso: string, days: number): Date {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000);
}

function isDecline(row: AskRow): boolean {
  return row.status === "blocked" && /skip|declin/i.test(row.blocked_reason ?? "");
}

/**
 * Hard stop for a new sponsor ask. A bot profile cannot pass a flag that skips this.
 * Returns the sentence to store on the blocked row, or null when the ask may be queued.
 */
export function blockReason(input: {
  now: Date;
  cooldownDays: number;
  community: string;
  sponsorId: string;
  sponsorName: string;
  domain: string;
  eventId: string;
  rows: AskRow[];
  suppressed: boolean;
  repliesSinceSend: number;
}): string | null {
  if (input.suppressed) return "Do not contact. This sponsor opted out.";
  const mine = input.rows.filter((row) => sameSponsor(row, input.sponsorId, input.sponsorName, input.domain));
  const community = input.community.trim().toLowerCase();
  const open = mine.filter((row) => OPEN.has(row.status));
  if (open.some((row) => community && (row.community ?? "").trim().toLowerCase() === community)) {
    return "Already asked by this community";
  }
  if (input.eventId && open.some((row) => row.request_id === input.eventId)) {
    return "Already asked by this community";
  }
  if (input.eventId && mine.some((row) => row.request_id === input.eventId && row.status !== "blocked")) {
    return "Already asked by this community";
  }

  const thread = mine.filter((row) => {
    if (row.status === "blocked") return false;
    if (!community) return input.eventId ? row.request_id === input.eventId : true;
    return (row.community ?? "").trim().toLowerCase() === community;
  });
  const sent = thread.filter((row) => row.status === "sent").sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const lastSent = sent.at(-1);
  if (sent.length >= 2) return "No further follow-up";
  if (lastSent) {
    const followUps = thread.filter((row) => row !== lastSent && row.created_at > lastSent.updated_at);
    if (followUps.length >= 1) return "No further follow-up";
    if (input.repliesSinceSend > 0) return "They replied. No follow-up.";
    const until = addDays(lastSent.updated_at, FOLLOW_UP_WAIT_DAYS);
    if (input.now.getTime() < until.getTime()) return `Follow-up waits until ${dayLabel(until)}`;
  } else {
    const cooled = mine.filter((row) => row.status === "sent" || isDecline(row));
    const latestCool = cooled.map((row) => row.updated_at).sort().at(-1);
    if (latestCool) {
      const until = addDays(latestCool, input.cooldownDays);
      if (input.now.getTime() < until.getTime()) return `Cooldown until ${dayLabel(until)}`;
    }
  }

  const start = new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate())).toISOString();
  const asksToday = input.rows.filter((row) => row.status !== "blocked" && row.created_at >= start).length;
  if (asksToday >= DAILY_ASK_CAP) return "Daily limit reached";
  return null;
}

export function listSponsorAsks(db: Db): AskRow[] {
  return db.all<AskRow>(
    `SELECT outbox.status, outbox.sponsor_id, outbox.sponsor_name, outbox.recipient, outbox.request_id,
            requests.organisation AS community, outbox.created_at, outbox.updated_at, outbox.blocked_reason
     FROM outbox
     LEFT JOIN requests ON requests.id = outbox.request_id
     WHERE outbox.kind = 'sponsor_email'`,
  );
}

export function sponsorIsSuppressed(db: Db, input: { sponsorId?: string | null; sponsorName?: string | null; domain?: string | null }): boolean {
  const rows = db.all<{ sponsor_id: string | null; sponsor_name: string | null; domain: string | null }>(
    "SELECT sponsor_id, sponsor_name, domain FROM sponsor_suppression",
  );
  return rows.some((row) => {
    if (input.sponsorId && row.sponsor_id === input.sponsorId) return true;
    if (input.domain && row.domain && row.domain === input.domain) return true;
    return sameText(row.sponsor_name, input.sponsorName);
  });
}

export function explainSponsorAsk(
  db: Db,
  input: {
    sponsorId?: string | null;
    sponsorName?: string | null;
    recipient: string;
    requestId?: string | null;
    community?: string | null;
    now?: Date;
  },
): string | null {
  const now = input.now ?? new Date();
  const domain = sponsorDomain(input.recipient);
  const community = input.community?.trim()
    || (input.requestId
      ? db.get<{ organisation: string | null }>("SELECT organisation FROM requests WHERE id = ?", [input.requestId])?.organisation ?? ""
      : "");
  const rows = listSponsorAsks(db);
  const sent = rows
    .filter((row) => sameSponsor(row, input.sponsorId ?? "", input.sponsorName ?? "", domain) && row.status === "sent")
    .map((row) => row.updated_at)
    .sort()
    .at(-1);
  const repliesSinceSend = sent ? countReplies(db, sent, input.sponsorName ?? "", domain) : 0;
  return blockReason({
    now,
    cooldownDays: cooldownDays(),
    community: community ?? "",
    sponsorId: input.sponsorId?.trim() ?? "",
    sponsorName: input.sponsorName?.trim() ?? "",
    domain,
    eventId: input.requestId ?? "",
    rows,
    suppressed: sponsorIsSuppressed(db, { sponsorId: input.sponsorId, sponsorName: input.sponsorName, domain }),
    repliesSinceSend,
  });
}

function countReplies(db: Db, since: string, sponsorName: string, domain: string): number {
  const rows = db.all<{ raw_message: string; sender_name: string | null }>(
    "SELECT raw_message, sender_name FROM requests WHERE created_at > ?",
    [since],
  );
  return rows.filter((row) => {
    if (isOptOut(row.raw_message)) return false;
    const blob = `${row.sender_name ?? ""}\n${row.raw_message}`.toLowerCase();
    if (sponsorName && blob.includes(sponsorName.toLowerCase())) return true;
    return Boolean(domain) && blob.includes(domain);
  }).length;
}

export function suppressSponsor(
  db: Db,
  input: { sponsorId?: string | null; sponsorName?: string | null; domain?: string | null; reason: string },
): { id: string } {
  const sponsorId = input.sponsorId?.trim() || null;
  const sponsorName = input.sponsorName?.trim() || null;
  const domain = input.domain?.trim().toLowerCase() || null;
  if (sponsorIsSuppressed(db, { sponsorId, sponsorName, domain })) {
    const existing = db.get<{ id: string }>("SELECT id FROM sponsor_suppression ORDER BY created_at LIMIT 1");
    return { id: existing?.id ?? "" };
  }
  const id = makeId("sup");
  db.run(
    `INSERT INTO sponsor_suppression (id, sponsor_id, sponsor_name, domain, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sponsorId, sponsorName, domain, input.reason, nowIso()],
  );
  return { id };
}

export function blockOpenAsks(db: Db, input: { sponsorId?: string | null; sponsorName?: string | null; domain?: string | null }, reason: string): void {
  const rows = db.all<OutboxRow>(
    "SELECT * FROM outbox WHERE kind = 'sponsor_email' AND status IN ('draft', 'awaiting_approval', 'needs_contact', 'approved')",
  );
  for (const row of rows) {
    const domain = sponsorDomain(row.recipient);
    const match = (input.sponsorId && row.sponsor_id === input.sponsorId)
      || (input.domain && domain === input.domain)
      || sameText(row.sponsor_name, input.sponsorName);
    if (!match) continue;
    db.run(`UPDATE outbox SET status = 'blocked', blocked_reason = ?, updated_at = ? WHERE id = ?`, [reason, nowIso(), row.id]);
  }
}
