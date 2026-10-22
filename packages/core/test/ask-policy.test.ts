import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { openDb, type Db } from "@sponsor-engine/db";
import { readFileSync } from "node:fs";
import { blockReason, cooldownDays, isOptOut, OPT_OUT_LINE, sponsorDomain, type AskRow } from "../src/ask-policy.ts";
import { approveOutbox, doNotContact, quoteBooking, sendWithApproval } from "../src/index.ts";
import { triageInbound } from "../src/triage.ts";

const now = new Date("2026-10-22T12:00:00.000Z");

function row(partial: Partial<AskRow> & { status: string }): AskRow {
  return {
    sponsor_id: partial.sponsor_id ?? "s1",
    sponsor_name: partial.sponsor_name ?? "Acme",
    recipient: partial.recipient ?? "partnerships@acme.test",
    request_id: partial.request_id ?? "req_1",
    community: partial.community ?? "Unicorn Mafia",
    created_at: partial.created_at ?? "2026-10-22T09:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-10-22T09:00:00.000Z",
    blocked_reason: partial.blocked_reason ?? null,
    status: partial.status,
  };
}

function reason(partial: Partial<Parameters<typeof blockReason>[0]> = {}): string | null {
  return blockReason({
    now,
    cooldownDays: 30,
    community: "Unicorn Mafia",
    sponsorId: "s1",
    sponsorName: "Acme",
    domain: "acme.test",
    eventId: "req_1",
    rows: [],
    suppressed: false,
    repliesSinceSend: 0,
    ...partial,
  });
}

test("cooldown cannot be set under 14 days and can be set longer", () => {
  assert.equal(cooldownDays({ SPONSOR_ASK_COOLDOWN_DAYS: "3" } as NodeJS.ProcessEnv), 14);
  assert.equal(cooldownDays({ SPONSOR_ASK_COOLDOWN_DAYS: "45" } as NodeJS.ProcessEnv), 45);
  assert.equal(cooldownDays({} as NodeJS.ProcessEnv), 30);
});

test("opt-out phrases are recognised and a booking is not", () => {
  assert.equal(isOptOut("no"), true);
  assert.equal(isOptOut("Unsubscribe."), true);
  assert.equal(isOptOut("Not interested"), true);
  assert.equal(isOptOut("Please book the room for 80 people. No projector."), false);
});

test("one open ask per sponsor per community is blocked", () => {
  assert.equal(reason({ rows: [row({ status: "awaiting_approval" })] }), "Already asked by this community");
});

test("the same sponsor domain and event is one ask", () => {
  assert.equal(
    reason({
      sponsorId: "other",
      rows: [row({ status: "awaiting_approval", sponsor_id: "s1", recipient: "partnerships@acme.test" })],
    }),
    "Already asked by this community",
  );
  assert.equal(sponsorDomain("sponsors+mubit@example.com"), "example.com/mubit");
  assert.notEqual(sponsorDomain("sponsors+mubit@example.com"), sponsorDomain("sponsors+encode@example.com"));
});

test("a send or a decline starts a cooldown for the next community", () => {
  const sent = reason({
    community: "River Club",
    rows: [row({ status: "sent", community: "Unicorn Mafia", updated_at: "2026-10-21T12:00:00.000Z", request_id: "req_old" })],
    eventId: "req_new",
  });
  assert.match(sent ?? "", /^Cooldown until \d+ Nov$/);
  const declined = reason({
    community: "River Club",
    rows: [row({ status: "blocked", community: "Unicorn Mafia", blocked_reason: "A person skipped this.", updated_at: "2026-10-21T12:00:00.000Z", request_id: "req_old" })],
    eventId: "req_new",
  });
  assert.match(declined ?? "", /^Cooldown until /);
  const old = reason({
    community: "River Club",
    cooldownDays: 14,
    rows: [row({ status: "sent", community: "Unicorn Mafia", updated_at: "2026-09-01T12:00:00.000Z", request_id: "req_old" })],
    eventId: "req_new",
  });
  assert.equal(old, null);
});

test("the workspace can queue 5 sponsor asks in a day", () => {
  const rows = [0, 1, 2, 3, 4].map((index) => row({
    status: "awaiting_approval",
    sponsor_id: `other-${index}`,
    sponsor_name: `Other ${index}`,
    recipient: `partnerships@other${index}.test`,
    community: `Community ${index}`,
    request_id: `req_${index}`,
  }));
  assert.equal(reason({ rows, eventId: "req_fresh" }), "Daily limit reached");
});

test("one follow-up is allowed after 7 silent days and then it stops", () => {
  const sent = row({ status: "sent", updated_at: "2026-10-20T12:00:00.000Z", created_at: "2026-10-01T12:00:00.000Z", request_id: "req_old" });
  assert.match(reason({ rows: [sent], eventId: "req_new" }) ?? "", /^Follow-up waits until /);
  const ready = row({ status: "sent", updated_at: "2026-10-01T12:00:00.000Z", created_at: "2026-10-01T12:00:00.000Z", request_id: "req_old" });
  assert.equal(reason({ rows: [ready], eventId: "req_new" }), null);
  assert.equal(reason({ rows: [ready], eventId: "req_new", repliesSinceSend: 1 }), "They replied. No follow-up.");
  const followed = row({
    status: "sent",
    sponsor_id: "s1",
    created_at: "2026-10-10T12:00:00.000Z",
    updated_at: "2026-10-10T12:00:00.000Z",
    request_id: "req_follow",
  });
  assert.equal(reason({ rows: [ready, followed], eventId: "req_third" }), "No further follow-up");
});

test("suppression blocks every later ask", () => {
  assert.equal(reason({ suppressed: true }), "Do not contact. This sponsor opted out.");
});

function desk(): Db {
  const root = mkdtempSync(path.join(tmpdir(), "ask-policy-"));
  return openDb(path.join(root, "test.db"));
}

test("the outbox stores the block reason and a second click with the same id does not add a row", () => {
  const db = desk();
  db.run(
    `INSERT INTO requests (id, channel, raw_message, organisation, status, created_at) VALUES ('req_um', 'web', 'hello', 'Unicorn Mafia', 'triaged', '2026-10-22T08:00:00.000Z')`,
  );
  const first = sendWithApproval(db, {
    recipient: "partnerships@acme.test",
    subject: "Food",
    body: "Please fund the food.",
    sponsorId: "s1",
    sponsorName: "Acme",
    requestId: "req_um",
    clientRequestId: "click-1",
    now,
  });
  assert.equal(first.item.status, "awaiting_approval");
  assert.match(first.item.body, new RegExp(OPT_OUT_LINE));
  const again = sendWithApproval(db, {
    recipient: "partnerships@acme.test",
    subject: "Food",
    body: "Please fund the food.",
    sponsorId: "s1",
    sponsorName: "Acme",
    requestId: "req_um",
    clientRequestId: "click-1",
    now,
  });
  assert.equal(again.item.id, first.item.id);
  const second = sendWithApproval(db, {
    recipient: "hello@acme.test",
    subject: "Food again",
    body: "Another note.",
    sponsorId: "s1",
    sponsorName: "Acme",
    requestId: "req_um",
    now,
  });
  assert.equal(second.item.status, "blocked");
  assert.equal(second.item.blocked_reason, "Already asked by this community");
  const count = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE kind = 'sponsor_email'");
  assert.equal(count?.n, 2);
  db.close();
});

test("do not contact closes an open ask and a later ask stays blocked", async () => {
  const db = desk();
  const waiting = sendWithApproval(db, {
    recipient: "partnerships@acme.test",
    subject: "Food",
    body: "Please fund the food.",
    sponsorId: "s1",
    sponsorName: "Acme",
    now,
  });
  doNotContact(db, { sponsorId: "s1", sponsorName: "Acme", recipient: "partnerships@acme.test" });
  const closed = db.get<{ status: string; blocked_reason: string }>("SELECT status, blocked_reason FROM outbox WHERE id = ?", [waiting.item.id]);
  assert.equal(closed?.status, "blocked");
  assert.match(closed?.blocked_reason ?? "", /Do not contact/);
  const later = sendWithApproval(db, {
    recipient: "partnerships@acme.test",
    subject: "Next month",
    body: "Another event.",
    sponsorId: "s1",
    sponsorName: "Acme",
    now: new Date("2026-12-01T12:00:00.000Z"),
  });
  assert.equal(later.item.blocked_reason, "Do not contact. This sponsor opted out.");
  await assert.rejects(() => approveOutbox(db, later.item.id, "test"), /blocked|Do not contact/i);
  db.close();
});

test("an opt-out reply suppresses the sponsor and does not queue an ask", () => {
  const db = desk();
  const result = triageInbound(db, { message: "unsubscribe", sender_name: "Acme", channel: "email" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.failure?.message ?? "", /Do not contact/);
  const saved = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM sponsor_suppression");
  assert.equal(saved?.n, 1);
  const ask = sendWithApproval(db, {
    recipient: "partnerships@acme.test",
    subject: "Food",
    body: "Hello",
    sponsorName: "Acme",
    now,
  });
  assert.match(ask.item.blocked_reason ?? "", /Do not contact/);
  db.close();
});

test("there is no batch send and approving one ask leaves the other waiting", async () => {
  const source = readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../src/outbox.ts"), "utf8");
  assert.doesNotMatch(source, /sendAll|send_to_all|approveAll/);
  const db = desk();
  process.env.DRY_RUN = "true";
  const first = sendWithApproval(db, {
    recipient: "partnerships@one.test",
    subject: "One",
    body: "One",
    sponsorId: "one",
    sponsorName: "One",
    now,
  });
  const second = sendWithApproval(db, {
    recipient: "partnerships@two.test",
    subject: "Two",
    body: "Two",
    sponsorId: "two",
    sponsorName: "Two",
    now,
  });
  const approved = await approveOutbox(db, first.item.id, "test");
  assert.equal(approved.item.status, "approved");
  assert.equal(db.get<{ status: string }>("SELECT status FROM outbox WHERE id = ?", [second.item.id])?.status, "awaiting_approval");
  db.close();
});

test("a retried quote id returns the same quote", async () => {
  const db = desk();
  const first = await quoteBooking(db, { headcount: 40, requester_kind: "company", date: "2026-11-18", client_request_id: "quote-1" });
  const second = await quoteBooking(db, { headcount: 40, requester_kind: "company", date: "2026-11-18", client_request_id: "quote-1" });
  assert.equal(second.id, first.id);
  const count = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM quotes");
  assert.equal(count?.n, 1);
  db.close();
});

test("chat replies do not count toward the sponsor cap", () => {
  const db = desk();
  for (let index = 0; index < 6; index += 1) {
    const reply = sendWithApproval(db, {
      kind: "chat_reply",
      recipient: "In the chat",
      subject: `Reply ${index}`,
      body: "Thanks",
      now,
    });
    assert.equal(reply.item.status, "awaiting_approval");
  }
  const ask = sendWithApproval(db, {
    recipient: "partnerships@acme.test",
    subject: "Food",
    body: "Hello",
    sponsorId: "s1",
    sponsorName: "Acme",
    now,
  });
  assert.equal(ask.item.status, "awaiting_approval");
  db.close();
});
