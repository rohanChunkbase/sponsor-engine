import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { openDb, seed, type Db } from "@sponsor-engine/db";
import {
  approveOutbox,
  deliverOutbox,
  DEMO_MESSAGE,
  draftSponsorAsk,
  evaluateSampleHistory,
  findSponsors,
  getConnections,
  listFailures,
  quoteBooking,
  runDemo,
  sendWithApproval,
  triageInbound,
} from "../src/index.ts";

const root = mkdtempSync(path.join(tmpdir(), "sponsor-engine-"));
const db: Db = openDb(path.join(root, "test.db"));
const previous = {
  DRY_RUN: process.env.DRY_RUN,
  ALLOWLIST: process.env.ALLOWLIST,
  SPONSOR_ENGINE_VENUE_CSV: process.env.SPONSOR_ENGINE_VENUE_CSV,
};

before(() => {
  process.env.SPONSOR_ENGINE_VENUE_CSV = path.join(root, "venue-bookings.csv");
  seed(db);
});

after(() => {
  restore("DRY_RUN", previous.DRY_RUN);
  restore("ALLOWLIST", previous.ALLOWLIST);
  restore("SPONSOR_ENGINE_VENUE_CSV", previous.SPONSOR_ENGINE_VENUE_CSV);
  db.close();
});

test("demo message becomes a community task with an owner", () => {
  const result = triageInbound(db, { message: DEMO_MESSAGE, channel: "whatsapp" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.qualified.sender_name, "Ada Fernwood");
  assert.match(result.qualified.organisation || "", /Thames Agent Builders/);
  assert.equal(result.qualified.requester_kind, "community");
  assert.equal(result.qualified.headcount, 80);
  assert.equal(result.qualified.event_date, "2026-11-26");
  assert.ok(result.qualified.needs.includes("food"));
  assert.equal(result.task?.owner, "Venue lead");
  assert.equal(result.task?.priority, "p1");
  assert.equal(result.outbox?.status, "awaiting_approval");
});

test("a short message is kept and logged as a failure", () => {
  const result = triageInbound(db, { message: "hey can someone look at this later??", channel: "whatsapp" });
  assert.equal(result.ok, false);
  const failures = listFailures(db, 10) as Array<{ message: string }>;
  assert.ok(failures.some((row) => /date|headcount|short/i.test(row.message)));
});

test("an 80-person community evening is a free room and food is the sponsor ask", async () => {
  const quote = await quoteBooking(db, {
    requester_kind: "community",
    headcount: 80,
    date: "2026-11-26",
    community_name: "Thames Agent Builders (SAMPLE)",
    needs: ["food", "room", "evening", "projector"],
  });
  assert.equal(quote.price, 0);
  assert.equal(quote.lines.room_gbp, 0);
  assert.equal(quote.range.low, 0);
  assert.equal(quote.range.high, 0);
  assert.equal(quote.currency, "GBP");
  assert.equal(quote.lines.sponsor_ask_gbp, quote.lines.food_gbp);
  assert.equal(quote.lines.food_gbp, Math.round(quote.lines.expected_heads * quote.lines.food_per_head));
  assert.ok(quote.lines.food_gbp > 0);
  assert.ok(quote.lines.company_room_gbp > quote.lines.room_gbp);
  assert.ok(quote.comparables.length >= 1);
  assert.ok(quote.comparables.every((row) => row.freeCommunitySlot));
  assert.match(quote.explanation, /free community slot/i);
  assert.match(quote.explanation, /company/i);
  assert.match(quote.explanation, /sponsor ask/i);
});

test("held-out nearest bookings beat the other scores on the sample file", () => {
  const report = evaluateSampleHistory();
  const knn = report.scores.find((row) => row.model === "knn-rules");
  const gbdt = report.scores.find((row) => row.model === "gbdt");
  assert.ok(knn);
  assert.ok(gbdt);
  assert.equal(report.winner, "knn-rules");
  assert.ok(knn.maeGbp < gbdt.maeGbp, `knn ${knn.maeGbp} gbdt ${gbdt.maeGbp}`);
  assert.ok(knn.maeGbp < report.baselineMedian.maeGbp, `knn ${knn.maeGbp} median ${report.baselineMedian.maeGbp}`);
  assert.ok(knn.mapePercent > 0 && knn.mapePercent < 40);
});

test("sponsor matches are real London companies with sources", async () => {
  const found = await findSponsors(db, {
    community: "Thames Agent Builders (SAMPLE)",
    headcount: 80,
    needs: ["food", "room"],
    focus: "AI agents",
    limit: 3,
    log: false,
  });
  assert.equal(found.matches.length, 3);
  for (const match of found.matches) {
    assert.notEqual(match.is_sample, "SAMPLE");
    assert.ok(match.reasons.length > 0);
    assert.ok(match.sources.some((source) => source.url.startsWith("http")));
  }
});

test("nothing reaches sent without approval", async () => {
  process.env.DRY_RUN = "false";
  process.env.ALLOWLIST = "allowed@example.com";
  const waiting = sendWithApproval(db, {
    recipient: "allowed@example.com",
    subject: "Test",
    body: "Hello",
  });
  assert.equal(waiting.item.status, "awaiting_approval");
  assert.equal(waiting.sent, false);
  assert.throws(() => deliverOutbox(db, waiting.item.id), /not approved/i);
  assert.equal(reload(waiting.item.id).status, "awaiting_approval");

  process.env.DRY_RUN = "true";
  const approved = await approveOutbox(db, waiting.item.id, "test");
  assert.equal(approved.sent, false);
  assert.equal(approved.item.status, "approved");

  const blocked = sendWithApproval(db, {
    recipient: "stranger@example.com",
    subject: "No",
    body: "No",
  });
  process.env.DRY_RUN = "false";
  process.env.ALLOWLIST = "allowed@example.com";
  const refused = await approveOutbox(db, blocked.item.id, "test");
  assert.equal(refused.sent, false);
  assert.equal(refused.item.status, "blocked");

  const allowed = sendWithApproval(db, {
    recipient: "allowed@example.com",
    subject: "Yes",
    body: "Yes",
  });
  const sent = await approveOutbox(db, allowed.item.id, "test");
  assert.equal(sent.sent, true);
  assert.equal(sent.item.status, "sent");
});

test("connections stay on the built-in tools when no integrations package is present", async () => {
  const status = await getConnections();
  assert.equal(status.source, "built-in");
  const zero = status.cards.find((card) => card.id === "zero");
  const cognee = status.cards.find((card) => card.id === "cognee");
  const house = status.cards.find((card) => card.id === "companies-house");
  assert.equal(zero?.state, "built-in");
  assert.match(zero?.step || "", /ZERO_API_KEY/);
  assert.match(cognee?.step || "", /COGNEE_API_KEY/);
  assert.match(house?.step || "", /COMPANIES_HOUSE_API_KEY/);
  assert.equal(status.cards.find((card) => card.id === "hubspot")?.state, "coming-soon");
});

test("demo flow quotes, matches three sponsors, and waits for approval", async () => {
  const result = await runDemo(db);
  assert.equal(result.quote.price, 0);
  assert.equal(result.quote.lines.room_gbp, 0);
  assert.ok(result.quote.lines.company_room_gbp > 0);
  assert.equal(result.draft.ask_gbp, result.quote.lines.food_gbp);
  assert.match(result.draft.outbox.body, /free community slot/i);
  assert.equal(result.sponsors.matches.length, 3);
  assert.equal(result.draft.outbox.status, "awaiting_approval");
  assert.equal(result.draft.sent, false);
  assert.ok(result.draft.ask_gbp > 0);
  const again = await draftSponsorAsk(db, { request_id: result.request_id, sponsor_id: result.sponsors.matches[1].sponsor_id });
  assert.equal(again.outbox.status, "awaiting_approval");
});

function reload(id: string) {
  const row = db.get<{ status: string }>("SELECT status FROM outbox WHERE id = ?", [id]);
  if (!row) throw new Error("missing outbox row");
  return row;
}

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
