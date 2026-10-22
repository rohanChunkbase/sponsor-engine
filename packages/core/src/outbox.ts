import type { Db } from "@sponsor-engine/db";
import { blockOpenAsks, explainSponsorAsk, sponsorDomain, sponsorIsSuppressed, suppressSponsor, withOptOut } from "./ask-policy.js";
import { pushDealIfAvailable } from "./integrations.js";
import { recordRun } from "./runs.js";
import { isAllowlisted, isDemoMode, isDryRun } from "./safety.js";
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
    clientRequestId?: string | null;
  },
): OutboxRow {
  const id = makeId("out");
  const at = nowIso();
  const status = input.status === "needs_contact" ? "needs_contact" : "awaiting_approval";
  db.run(
    `INSERT INTO outbox
      (id, kind, recipient, subject, body, status, request_id, sponsor_id, sponsor_name, ask_gbp, blocked_reason, created_at, updated_at, client_request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
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
      input.clientRequestId?.trim() || null,
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
    clientRequestId?: string | null;
    community?: string | null;
    now?: Date;
  },
) {
  const kind = input.kind ?? "sponsor_email";
  const replay = replayOutbox(db, input.clientRequestId);
  if (replay) return replay;
  const sponsorAsk = kind === "sponsor_email";
  const body = sponsorAsk ? withOptOut(input.body) : input.body;
  const missingContact = sponsorAsk && !input.recipient.trim();
  const reason = sponsorAsk
    ? explainSponsorAsk(db, {
      sponsorId: input.sponsorId,
      sponsorName: input.sponsorName,
      recipient: input.recipient,
      requestId: input.requestId,
      community: input.community,
      now: input.now,
    })
    : null;
  const item = createOutbox(db, {
    kind,
    recipient: input.recipient.trim(),
    subject: input.subject,
    body,
    requestId: input.requestId,
    sponsorId: input.sponsorId,
    sponsorName: input.sponsorName,
    askGbp: input.askGbp,
    status: missingContact ? "needs_contact" : input.status,
    clientRequestId: input.clientRequestId,
  });
  if (reason) {
    move(db, item, "blocked", reason);
    recordRun(db, {
      tool: "send_with_approval",
      inputSummary: `${item.kind} to ${item.recipient}`,
      outputSummary: reason,
      requestId: item.request_id,
    });
    return { item: mustOutbox(db, item.id), sent: false as const, reason };
  }
  recordRun(db, {
    tool: "send_with_approval",
    inputSummary: `${item.kind} to ${item.recipient}`,
    outputSummary: "Waiting for a person. Nothing was sent.",
    requestId: item.request_id,
  });
  return { item, sent: false as const, reason: "Waiting for a person. Nothing was sent." };
}

function replayOutbox(db: Db, clientRequestId?: string | null) {
  const id = clientRequestId?.trim();
  if (!id) return null;
  const item = db.get<OutboxRow>("SELECT * FROM outbox WHERE client_request_id = ?", [id]);
  if (!item) return null;
  return {
    item,
    sent: false as const,
    reason: item.blocked_reason || "Waiting for a person. Nothing was sent.",
  };
}

/** Forever. Closes open asks to this sponsor. A profile cannot undo this. */
export function doNotContact(
  db: Db,
  input: { sponsorId?: string | null; sponsorName?: string | null; domain?: string | null; recipient?: string | null; reason?: string },
) {
  const domain = input.domain?.trim() || sponsorDomain(input.recipient ?? "");
  const reason = "Do not contact. This sponsor opted out.";
  const saved = suppressSponsor(db, {
    sponsorId: input.sponsorId,
    sponsorName: input.sponsorName,
    domain,
    reason: input.reason?.trim() || reason,
  });
  blockOpenAsks(db, { sponsorId: input.sponsorId, sponsorName: input.sponsorName, domain }, reason);
  return { id: saved.id, reason };
}

export async function approveOutbox(db: Db, id: string, actor = "dashboard") {
  const current = mustOutbox(db, id);
  if (current.status === "blocked") {
    throw new Error(current.blocked_reason || "This ask is blocked.");
  }
  if (current.kind === "sponsor_email" && sponsorIsSuppressed(db, {
    sponsorId: current.sponsor_id,
    sponsorName: current.sponsor_name,
    domain: sponsorDomain(current.recipient),
  })) {
    const reason = "Do not contact. This sponsor opted out.";
    if (current.status !== "sent") move(db, current, "blocked", reason);
    return { item: mustOutbox(db, id), sent: false as const, reason, deal: null };
  }
  if (current.status === "needs_contact" || !current.recipient.trim()) {
    throw new Error("Find a contact before this can be approved.");
  }
  move(db, current, "approved");
  db.run(
    `INSERT INTO approvals (id, outbox_id, actor, decision, note, created_at) VALUES (?, ?, ?, 'approve', ?, ?)`,
    [makeId("apr"), id, actor, isDryRun() ? "Test mode. Nothing was sent." : "Approved.", nowIso()],
  );
  const request = current.request_id
    ? db.get<{ organisation: string | null; event_date: string | null }>("SELECT organisation, event_date FROM requests WHERE id = ?", [current.request_id])
    : undefined;
  const event = [request?.organisation, request?.event_date].filter(Boolean).join(" · ") || current.subject || "Booking";
  const deal = await pushDealIfAvailable({
    sponsor: current.sponsor_name?.trim() || "Sponsor",
    event,
    askAmount: current.ask_gbp ?? 0,
    stage: "approved",
  });
  const crmNote = deal.used === "external"
    ? "The deal was copied to the CRM. Email was not sent."
    : "The deal is in the built-in CRM. Email was not sent.";
  if (isDryRun()) {
    recordRun(db, {
      tool: "approve",
      inputSummary: id,
      outputSummary: `Approved. ${crmNote} Test mode is on, so nothing was sent.`,
      requestId: current.request_id,
    });
    return {
      item: mustOutbox(db, id),
      sent: false as const,
      reason: `Approved. ${crmNote} Test mode is on, so nothing was sent.`,
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
  if (isDemoMode()) {
    throw new Error("This demo does not send messages.");
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
  if (to === "sent" && isDemoMode()) {
    throw new Error("This demo does not send messages.");
  }
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
