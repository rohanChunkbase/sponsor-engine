import type { Db } from "@sponsor-engine/db";
import { pushDealIfAvailable } from "./integrations.js";
import { recordRun } from "./runs.js";
import { isAllowlisted, isDryRun } from "./safety.js";
import type { OutboxRow } from "./types.js";
import { makeId, nowIso } from "./util.js";

const ALLOWED: Record<string, string[]> = {
  draft: ["awaiting_approval", "blocked"],
  needs_contact: ["blocked"],
  awaiting_approval: ["approved", "blocked"],
  approved: ["sent", "blocked"],
  sent: [],
  blocked: [],
};

export function createOutbox(
  db: Db,
  input: {
    kind: string;
    recipient: string;
    subject: string;
    body: string;
    requestId?: string | null;
    sponsorId?: string | null;
    sponsorName?: string | null;
    askGbp?: number | null;
    status?: "awaiting_approval" | "needs_contact";
  },
): OutboxRow {
  const id = makeId("out");
  const at = nowIso();
  const status = input.status === "needs_contact" ? "needs_contact" : "awaiting_approval";
  db.run(
    `INSERT INTO outbox
      (id, kind, recipient, subject, body, status, request_id, sponsor_id, sponsor_name, ask_gbp, blocked_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      id,
      input.kind,
      input.recipient,
      input.subject,
      input.body,
      status,
      input.requestId ?? null,
      input.sponsorId ?? null,
      input.sponsorName ?? null,
      input.askGbp ?? null,
      at,
      at,
    ],
  );
  return mustOutbox(db, id);
}

/** Writes an outbox row. This function never sends. */
export function sendWithApproval(
  db: Db,
  input: {
    kind?: string;
    recipient: string;
    subject: string;
    body: string;
    requestId?: string | null;
    sponsorId?: string | null;
    sponsorName?: string | null;
    askGbp?: number | null;
    status?: "awaiting_approval" | "needs_contact";
  },
) {
  const kind = input.kind ?? "sponsor_email";
  const missingContact = kind === "sponsor_email" && !input.recipient.trim();
  const item = createOutbox(db, {
    kind,
    recipient: input.recipient.trim(),
    subject: input.subject,
    body: input.body,
    requestId: input.requestId,
    sponsorId: input.sponsorId,
    sponsorName: input.sponsorName,
    askGbp: input.askGbp,
    status: missingContact ? "needs_contact" : input.status,
  });
  recordRun(db, {
    tool: "send_with_approval",
    inputSummary: `${item.kind} to ${item.recipient}`,
    outputSummary: "Waiting for a person. Nothing was sent.",
    requestId: item.request_id,
  });
  return { item, sent: false as const, reason: "Waiting for a person. Nothing was sent." };
}

export async function approveOutbox(db: Db, id: string, actor = "dashboard") {
  const current = mustOutbox(db, id);
  if (current.status === "needs_contact" || !current.recipient.trim()) {
    throw new Error("Find a contact before this can be approved.");
  }
  move(db, current, "approved");
  db.run(
    `INSERT INTO approvals (id, outbox_id, actor, decision, note, created_at) VALUES (?, ?, ?, 'approve', ?, ?)`,
    [makeId("apr"), id, actor, isDryRun() ? "Test mode. Nothing was sent." : "Approved.", nowIso()],
  );
  const deal = await pushDealIfAvailable({
    dry_run: isDryRun(),
    outbox_id: id,
    request_id: current.request_id,
    sponsor_name: current.sponsor_name,
    recipient: current.recipient,
    subject: current.subject,
    body: current.body,
    ask_gbp: current.ask_gbp,
  });
  if (isDryRun()) {
    recordRun(db, {
      tool: "approve",
      inputSummary: id,
      outputSummary: "Approved. Test mode is on, so nothing was sent.",
      requestId: current.request_id,
    });
    return {
      item: mustOutbox(db, id),
      sent: false as const,
      reason: "Approved. Test mode is on, so nothing was sent.",
      deal,
    };
  }
  const delivery = deliverOutbox(db, id);
  return { ...delivery, deal };
}

export function deliverOutbox(db: Db, id: string) {
  const current = mustOutbox(db, id);
  if (current.status !== "approved") {
    throw new Error("Refusing to send. A person has not approved this yet.");
  }
  if (isDryRun()) {
    return {
      item: current,
      sent: false as const,
      reason: "Test mode is on, so nothing was sent.",
    };
  }
  if (!isAllowlisted(current.recipient)) {
    move(db, current, "blocked", "The address is not on the allow list.");
    recordRun(db, {
      tool: "approve",
      inputSummary: id,
      outputSummary: "Blocked. The address is not on the allow list.",
      status: "error",
      requestId: current.request_id,
    });
    return {
      item: mustOutbox(db, id),
      sent: false as const,
      reason: "Blocked. The address is not on the allow list.",
    };
  }
  move(db, current, "sent");
  recordRun(db, {
    tool: "approve",
    inputSummary: id,
    outputSummary: "Marked sent. This build has no email service and no WhatsApp service.",
    requestId: current.request_id,
  });
  return {
    item: mustOutbox(db, id),
    sent: true as const,
    reason: "Marked sent. This build has no email service and no WhatsApp service.",
  };
}

export function skipOutbox(db: Db, id: string, actor = "dashboard") {
  const current = mustOutbox(db, id);
  if (current.status !== "awaiting_approval" && current.status !== "draft" && current.status !== "needs_contact") {
    throw new Error(`You can skip a message only while it is waiting. This one is ${current.status}.`);
  }
  move(db, current, "blocked", "A person skipped this.");
  db.run(
    `INSERT INTO approvals (id, outbox_id, actor, decision, note, created_at) VALUES (?, ?, ?, 'skip', ?, ?)`,
    [makeId("apr"), id, actor, "A person skipped this.", nowIso()],
  );
  recordRun(db, {
    tool: "skip",
    inputSummary: id,
    outputSummary: "Skipped. Nothing was sent.",
    requestId: current.request_id,
  });
  return { item: mustOutbox(db, id), sent: false as const, reason: "Skipped. Nothing was sent." };
}

export function editOutbox(db: Db, id: string, input: { subject?: string; body?: string; actor?: string }) {
  const current = mustOutbox(db, id);
  if (current.status !== "awaiting_approval" && current.status !== "draft" && current.status !== "needs_contact") {
    throw new Error(`You can edit a message only while it is waiting. This one is ${current.status}.`);
  }
  const subject = input.subject?.trim() || current.subject;
  const body = input.body?.trim() || current.body;
  db.run(`UPDATE outbox SET subject = ?, body = ?, updated_at = ? WHERE id = ?`, [subject, body, nowIso(), id]);
  db.run(
    `INSERT INTO approvals (id, outbox_id, actor, decision, note, created_at) VALUES (?, ?, ?, 'edit', ?, ?)`,
    [makeId("apr"), id, input.actor ?? "dashboard", "A person edited the text.", nowIso()],
  );
  recordRun(db, {
    tool: "edit",
    inputSummary: id,
    outputSummary: "Text updated. It is still waiting for approval.",
    requestId: current.request_id,
  });
  return { item: mustOutbox(db, id), sent: false as const, reason: "Text updated. It is still waiting for you." };
}

export function listOutbox(db: Db): OutboxRow[] {
  return db.all<OutboxRow>("SELECT * FROM outbox ORDER BY created_at DESC");
}

export function mustOutbox(db: Db, id: string): OutboxRow {
  const row = db.get<OutboxRow>("SELECT * FROM outbox WHERE id = ?", [id]);
  if (!row) throw new Error(`No outbox item ${id}.`);
  return row;
}

function move(db: Db, current: OutboxRow, to: string, reason?: string) {
  const allowed = ALLOWED[current.status] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot move ${current.status} to ${to}.`);
  }
  db.run(`UPDATE outbox SET status = ?, blocked_reason = ?, updated_at = ? WHERE id = ?`, [
    to,
    reason ?? current.blocked_reason,
    nowIso(),
    current.id,
  ]);
}
