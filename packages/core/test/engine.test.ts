import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { openDb, repoRoot, seed, type Db } from "@sponsor-engine/db";
import { runWithWorkspace } from "@sponsor-engine/db";
import {
  allowWrite,
  recallHistory,
  approveOutbox,
  assertDashboardOrigin,
  deliverOutbox,
  DEMO_MESSAGE,
  draftSponsorAsk,
  inferRecipient,
  evaluateActiveHistory,
  evaluateSampleHistory,
  isDryRun,
  resetVenueHistory,
  resetWriteLimits,
  saveVenueCsv,
  findSponsors,
  getConnections,
  listFailures,
  quoteBooking,
  runDemo,
  sendWithApproval,
  triageInbound,
} from "../src/index.ts";
import { parseDate, parseHeadcount } from "../src/triage.ts";

const root = mkdtempSync(path.join(tmpdir(), "sponsor-engine-"));
const db: Db = openDb(path.join(root, "test.db"));
const previous = {
  DRY_RUN: process.env.DRY_RUN,
  ALLOWLIST: process.env.ALLOWLIST,
  SPONSOR_ENGINE_VENUE_CSV: process.env.SPONSOR_ENGINE_VENUE_CSV,
  SPONSOR_ENGINE_OFFLINE: process.env.SPONSOR_ENGINE_OFFLINE,
  SPONSOR_ENGINE_DATA_DIR: process.env.SPONSOR_ENGINE_DATA_DIR,
  DEMO_MODE: process.env.DEMO_MODE,
};

before(() => {
  process.env.SPONSOR_ENGINE_VENUE_CSV = path.join(root, "venue-bookings.csv");
  process.env.SPONSOR_ENGINE_OFFLINE = "1";
  process.env.SPONSOR_ENGINE_DATA_DIR = path.join(root, "integrations-data");
  seed(db);
});

after(() => {
  restore("DRY_RUN", previous.DRY_RUN);
  restore("ALLOWLIST", previous.ALLOWLIST);
  restore("SPONSOR_ENGINE_VENUE_CSV", previous.SPONSOR_ENGINE_VENUE_CSV);
  restore("SPONSOR_ENGINE_OFFLINE", previous.SPONSOR_ENGINE_OFFLINE);
  restore("SPONSOR_ENGINE_DATA_DIR", previous.SPONSOR_ENGINE_DATA_DIR);
  restore("DEMO_MODE", previous.DEMO_MODE);
  db.close();
});

test("demo message becomes a community task with an owner", () => {
  const result = triageInbound(db, { message: DEMO_MESSAGE, channel: "whatsapp" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.qualified.sender_name, null);
  assert.equal(result.qualified.organisation, "Unicorn Mafia");
  assert.equal(result.qualified.requester_kind, "community");
  assert.equal(result.qualified.headcount, 120);
  assert.equal(result.qualified.event_date, parseDate(DEMO_MESSAGE));
  assert.match(result.qualified.event_date || "", /-11-/);
  const [year, month, day] = String(result.qualified.event_date).split("-").map(Number);
  assert.equal(new Date(Date.UTC(year, month - 1, day)).getUTCDay(), 6);
  assert.equal(result.qualified.venue_hint, "Expedite");
  assert.ok(result.qualified.needs.includes("food"));
  assert.ok(result.qualified.needs.includes("room"));
  assert.equal(result.task?.owner, "Venue lead");
  assert.equal(result.task?.priority, "p0");
  assert.equal(result.outbox?.status, "awaiting_approval");
  assert.doesNotMatch(String(result.outbox?.body), /Charlie|Cheesman|@/);

  const thames = db.get<{ name: string; is_sample: string }>(
    "SELECT name, is_sample FROM communities WHERE name LIKE ?",
    ["%Thames Agent Builders%"],
  );
  assert.match(thames?.name || "", /Thames Agent Builders/);
  assert.equal(thames?.is_sample, "SAMPLE");
});

test("a 35-staff offsite and a ranged relative date both qualify", async () => {
  const now = new Date(2026, 9, 22, 12, 0, 0);
  const offsite = triageInbound(db, {
    message: "Please book a company offsite for 35-staff on 12 Dec at Expedite.",
    channel: "web",
    now,
  });
  assert.equal(offsite.ok, true);
  if (!offsite.ok) return;
  assert.equal(offsite.qualified.headcount, 35);
  assert.equal(offsite.qualified.requester_kind, "company");
  assert.equal(offsite.qualified.event_date, "2026-12-12");
  const requestId = String(offsite.request?.id);
  const quote = await quoteBooking(db, { request_id: requestId });
  assert.ok(quote.price > 0);
  const draft = await draftSponsorAsk(db, { request_id: requestId });
  assert.equal(draft.outbox.status, "needs_contact");
  assert.equal(draft.outbox.recipient, "");

  const ranged = triageInbound(db, {
    message: "Can we book a meetup next thurs for 40-50 ppl?",
    channel: "web",
    now,
  });
  assert.equal(ranged.ok, true);
  if (!ranged.ok) return;
  assert.equal(ranged.qualified.headcount, 45);
  assert.equal(ranged.qualified.event_date, "2026-10-29");
  assert.match(ranged.suggested_reply, /you said 40 to 50/);

  assert.equal(parseDate("tomorrow", now), "2026-10-23");
  assert.equal(parseDate("in two weeks", now), "2026-11-05");
  assert.equal(parseDate("Thursday 26 November", now), "2026-11-26");
  assert.equal(parseHeadcount("around 18:00"), null);
  assert.equal(parseHeadcount("about 2026 attendees"), null);
  assert.equal(parseHeadcount("25 of us"), 25);
  assert.equal(parseHeadcount("about 80 people"), 80);
});

test("an impossible date is not stored and the reply asks which day", () => {
  const now = new Date(2026, 9, 22, 12, 0, 0);
  for (const when of ["2026-13-45", "31 Feb"]) {
    const result = triageInbound(db, {
      message: `Can we book the room on ${when} for 40 people?`,
      channel: "web",
      now,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.qualified.event_date, null);
    assert.equal(result.request?.event_date ?? null, null);
    const body = String(result.outbox?.body);
    assert.doesNotMatch(body, /undefined/);
    assert.doesNotMatch(body, /on 45/);
    assert.match(body, /Which day did you mean/i);
  }
  assert.equal(parseDate("2026-11-26", now), "2026-11-26");
  assert.equal(parseDate("31 February 2026", now), null);
  assert.equal(parseDate("Thursday 26 November 2026", now), "2026-11-26");
});

test("an unknown booker is not given a free community room", async () => {
  const now = new Date(2026, 9, 22, 12, 0, 0);
  for (const kind of ["unknown", "alien"]) {
    const quote = await quoteBooking(db, {
      requester_kind: kind,
      headcount: 80,
      date: "2026-11-26",
      needs: ["food", "room", "evening", "projector"],
    });
    assert.ok(quote.price > 0);
    assert.equal(quote.requester_kind, "unknown");
    assert.match(quote.explanation, /not confirmed/i);
    assert.doesNotMatch(quote.explanation, /This is a free community slot/);
  }
  const inbound = triageInbound(db, {
    message: "Please book a room on 12 December 2026 for 40 people at Expedite.",
    channel: "web",
    now,
  });
  assert.equal(inbound.ok, true);
  if (!inbound.ok) return;
  assert.equal(inbound.qualified.requester_kind, "unknown");
  const fromRequest = await quoteBooking(db, { request_id: String(inbound.request?.id) });
  assert.ok(fromRequest.price > 0);
  assert.equal(fromRequest.requester_kind, "unknown");
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

test("the held-out winner beats a constant median on the sample file", () => {
  const report = evaluateSampleHistory();
  const knn = report.scores.find((row) => row.model === "knn-rules");
  const gbdt = report.scores.find((row) => row.model === "gbdt");
  assert.ok(knn);
  assert.ok(gbdt);
  assert.equal(report.winner, "gbdt");
  assert.ok(gbdt.maeGbp < knn.maeGbp, `gbdt ${gbdt.maeGbp} knn ${knn.maeGbp}`);
  assert.ok(gbdt.maeGbp < report.baselineMedian.maeGbp, `gbdt ${gbdt.maeGbp} median ${report.baselineMedian.maeGbp}`);
  assert.ok(gbdt.mapePercent > 0 && gbdt.mapePercent < 40);
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
    assert.equal(typeof match.company_size?.note, "string");
    assert.ok((match.company_size?.note.length ?? 0) > 0);
  }
});

test("a known sponsor card keeps the bundled company size when no key is set", async () => {
  const found = await findSponsors(db, {
    community: "AI Engineer London",
    headcount: 80,
    needs: ["food"],
    focus: "AI",
    limit: 8,
    include_sample: true,
    log: false,
  });
  const tessl = found.matches.find((match) => match.company.toLowerCase() === "tessl")
    ?? (await findSponsors(db, { community: "Tessl", headcount: 40, needs: ["food"], limit: 5, include_sample: true, log: false })).matches.find((match) => /tessl/i.test(match.company));
  assert.ok(tessl, "Tessl should be in the ranked list");
  assert.match(tessl.company_size?.note ?? "", /London events/);
  assert.equal(tessl.company_size?.via, "bundled-data");
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

test("approve stores a CRM draft and does not send email", async () => {
  process.env.DRY_RUN = "true";
  delete process.env.ZERO_API_KEY;
  const waiting = sendWithApproval(db, {
    recipient: "desk@example.com",
    subject: "Food for Thursday",
    body: "Please hold this note.",
    sponsorName: "Tessl",
    askGbp: 264,
  });
  const approved = await approveOutbox(db, waiting.item.id, "test");
  assert.equal(approved.sent, false);
  assert.equal(approved.item.status, "approved");
  assert.equal(approved.deal.used, "built-in");
  assert.equal(approved.deal.email_sent, false);
  const saved = approved.deal.result as { provider?: string; data?: { sponsor?: string; emailSent?: boolean; draft?: boolean; askAmount?: number } };
  assert.equal(saved.provider, "local-crm");
  assert.equal(saved.data?.sponsor, "Tessl");
  assert.equal(saved.data?.emailSent, false);
  assert.equal(saved.data?.draft, true);
  assert.equal(saved.data?.askAmount, 264);
  assert.match(approved.reason, /Email was not sent/);
});

test("recall_history uses built-in memory when no key is set", async () => {
  delete process.env.COGNEE_API_KEY;
  const recalled = await recallHistory(db, "food sponsor");
  assert.equal(recalled.memory?.provider, "local-memory");
  assert.equal(recalled.memory?.mode, "builtin");
  assert.ok((recalled.memory?.hits.length ?? 0) > 0);
  assert.match(recalled.note, /Built-in memory/);
  assert.ok(recalled.events);
  assert.ok(recalled.claims);
});

test("approval from another site is refused", () => {
  const same = new Request("http://localhost:3000/api/outbox/out_1/approve", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin", host: "localhost:3000" },
  });
  assert.doesNotThrow(() => assertDashboardOrigin(same));
  const cross = new Request("http://localhost:3000/api/outbox/out_1/approve", {
    method: "POST",
    headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", host: "localhost:3000" },
  });
  assert.throws(() => assertDashboardOrigin(cross), /this site/);
});

test("integrations report status and missing keys stay optional", async () => {
  const status = await getConnections();
  assert.equal(status.source, "integrations");
  const zero = status.cards.find((card) => card.id === "zero");
  const cognee = status.cards.find((card) => card.id === "cognee");
  const house = status.cards.find((card) => card.id === "companies-house");
  const luma = status.cards.find((card) => card.id === "luma");
  assert.equal(zero?.state, "missing");
  assert.match(`${zero?.plain ?? ""} ${zero?.step ?? ""}`, /ZERO_API_KEY/);
  assert.match(`${cognee?.plain ?? ""} ${cognee?.step ?? ""}`, /COGNEE_API_KEY/);
  assert.match(`${house?.plain ?? ""} ${house?.step ?? ""}`, /COMPANIES_HOUSE_API_KEY/);
  assert.equal(luma?.state, "connected");
  assert.equal(status.cards.find((card) => card.id === "hubspot")?.state, "coming-soon");
  const builtin = status.cards.find((card) => card.id === "crm-builtin");
  assert.equal(builtin?.state, "built-in");
  assert.match(builtin?.plain ?? "", /Email is not sent/i);
  const memory = status.cards.find((card) => card.id === "memory-builtin");
  assert.equal(memory?.state, "built-in");
  assert.match(memory?.plain ?? "", /Keyword search/);
});

test("demo flow quotes from sample history, matches past sponsors, and waits", async () => {
  process.env.DRY_RUN = "true";
  const backed = new Set(["Pydantic", "Render", "Expedite", "The Residency", "Cognition", "Mubit", "BuilderBase", "Encode Hub"]);
  const result = await runDemo(db);
  assert.match(result.quote.explanation, /SAMPLE venue history/);
  assert.equal(result.quote.lines.hours, 12);
  assert.equal(result.quote.lines.day_total_gbp, result.quote.lines.room_gbp + result.quote.lines.food_gbp);
  assert.ok(result.quote.lines.day_total_gbp > result.quote.lines.room_gbp);
  assert.equal(result.quote.lines.market_median_gbp, 1350);
  assert.match(result.quote.explanation, /full day/i);
  assert.match(result.quote.explanation, /not a price per hour/);
  assert.match(result.quote.explanation, /£1,350/);
  assert.ok(result.quote.lines.company_room_gbp > 0);
  assert.equal(result.draft.ask_gbp, result.quote.lines.food_gbp);
  assert.ok(result.draft.ask_gbp > 0);
  assert.equal(result.sponsors.matches.length, 3);
  for (const match of result.sponsors.matches) {
    assert.ok(backed.has(match.company), match.company);
    assert.match(match.reasons[0] || "", /Sponsors who backed events like theirs/);
    assert.match(match.reasons.join(" "), /100-120/);
    assert.ok(match.sources.some((source) => source.url === "https://luma.com/umhack"));
  }
  assert.equal(result.draft.outbox.status, "awaiting_approval");
  assert.match(result.draft.outbox.recipient, /^sponsors\+[a-z0-9]+@example\.com$/);
  assert.match(result.draft.outbox.body, /placeholder at the test inbox/);
  assert.doesNotMatch(result.draft.outbox.body, /Charlie|Cheesman|linkedin\.com\/in|@gmail|partnerships@/i);
  assert.equal(result.draft.sent, false);
  assert.equal(result.repeat.outbox.status, "blocked");
  assert.match(result.repeat.outbox.blocked_reason ?? "", /already asked for this booking/);
  assert.equal(result.repeat.sent, false);
  assert.equal(isDryRun(), true);
  const again = await draftSponsorAsk(db, { request_id: result.request_id, sponsor_id: result.sponsors.matches[1].sponsor_id });
  assert.match(again.outbox.recipient, /^sponsors\+[a-z0-9]+@example\.com$/);
  assert.equal(again.sent, false);
});

test("a sponsor draft never invents an email address", async () => {
  assert.equal(inferRecipient("elastic.co (well-known domain, not re-checked)"), "");
  assert.equal(inferRecipient(null), "");
  assert.equal(
    inferRecipient("https://elastic.co", [{ url: "https://x.com/elastic/status/123", quote: "Elastic hosted the meetup." }]),
    "",
  );
  assert.equal(
    inferRecipient(null, [{ url: "https://luma.com/abc", quote: "Write to partnerships@tessl.io for the night." }]),
    "partnerships@tessl.io",
  );
  assert.equal(
    inferRecipient(null, [], { hosts: [{ name: "Ada", linkedin: "https://www.linkedin.com/in/ada" }] }),
    "https://www.linkedin.com/in/ada",
  );
  const draft = await draftSponsorAsk(db, {
    headcount: 80,
    community: "Thames Agent Builders (SAMPLE)",
  });
  assert.equal(draft.outbox.recipient, "");
  assert.equal(draft.outbox.status, "needs_contact");
  assert.doesNotMatch(draft.outbox.body, /partnerships@/i);
  assert.doesNotMatch(draft.outbox.body, /taken from the public website/i);
  assert.match(draft.outbox.body, /Find a contact/i);
  await assert.rejects(() => approveOutbox(db, draft.outbox.id, "test"), /Find a contact/);
});

test("a venue CSV replaces the sample history and the check runs again", () => {
  const sample = readFileSync(path.join(repoRoot(), "packages/pricing/data/sample-bookings.csv"), "utf8");
  const bundled = evaluateSampleHistory();
  const saved = saveVenueCsv(sample);
  assert.equal(saved.count, bundled.historyCount);
  assert.equal(saved.source.source, "venue");
  const active = evaluateActiveHistory();
  const activeKnn = active.scores.find((row) => row.model === "knn-rules");
  const bundledKnn = bundled.scores.find((row) => row.model === "knn-rules");
  assert.ok(activeKnn && bundledKnn);
  assert.ok(Math.abs(activeKnn.maeGbp - bundledKnn.maeGbp) < 0.001);
  assert.ok(activeKnn.maeGbp < active.baselineMedian.maeGbp);
  assert.throws(() => saveVenueCsv("not,a,booking\n1,2,3\n"));
});

test("a short venue CSV is rejected before it replaces the history", () => {
  const venue = process.env.SPONSOR_ENGINE_VENUE_CSV;
  if (!venue) throw new Error("missing venue path");
  const sample = readFileSync(path.join(repoRoot(), "packages/pricing/data/sample-bookings.csv"), "utf8");
  const lines = sample.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
  const short = [...lines.slice(0, 6), ""].join("\n");
  const existed = existsSync(venue);
  const before = existed ? readFileSync(venue) : null;
  const beforeMtime = existed ? statSync(venue).mtimeMs : null;

  assert.throws(() => saveVenueCsv(short), /at least 10 bookings/);

  if (before === null) {
    assert.equal(existsSync(venue), false);
    assert.equal(evaluateActiveHistory().source, "sample");
  } else {
    assert.equal(readFileSync(venue).equals(before), true);
    assert.equal(statSync(venue).mtimeMs, beforeMtime);
  }
  const active = evaluateActiveHistory();
  assert.ok(active.historyCount >= 10);

  const reset = resetVenueHistory();
  assert.equal(reset.source, "sample");
  assert.equal(existsSync(venue), false);
  assert.equal(evaluateActiveHistory().source, "sample");

  if (before) writeFileSync(venue, before);
});

test("demo mode cannot mark a message sent", async () => {
  process.env.DEMO_MODE = "true";
  process.env.DRY_RUN = "false";
  process.env.ALLOWLIST = "allowed@example.com";
  assert.equal(isDryRun(), true);
  const waiting = sendWithApproval(db, {
    recipient: "allowed@example.com",
    subject: "Demo",
    body: "Hello",
  });
  const approved = await approveOutbox(db, waiting.item.id, "test");
  assert.equal(approved.sent, false);
  assert.equal(approved.item.status, "approved");
  assert.throws(() => deliverOutbox(db, waiting.item.id), /does not send/i);
  restore("DRY_RUN", previous.DRY_RUN);
  restore("ALLOWLIST", previous.ALLOWLIST);
  restore("DEMO_MODE", previous.DEMO_MODE);
});

test("write limits trip after the budget", () => {
  resetWriteLimits();
  assert.equal(allowWrite("203.0.113.8", 2, 60_000).ok, true);
  assert.equal(allowWrite("203.0.113.8", 2, 60_000).ok, true);
  assert.equal(allowWrite("203.0.113.8", 2, 60_000).ok, false);
  assert.equal(allowWrite("203.0.113.9", 2, 60_000).ok, true);
  resetWriteLimits();
});

test("a venue file stored for one browser stays there", () => {
  const sample = readFileSync(path.join(repoRoot(), "packages/pricing/data/sample-bookings.csv"), "utf8");
  runWithWorkspace("browser-a", () => {
    const saved = saveVenueCsv(sample, db);
    assert.equal(saved.source.source, "venue");
    assert.equal(evaluateActiveHistory(db).source, "venue");
  });
  runWithWorkspace("browser-b", () => {
    assert.equal(evaluateActiveHistory(db).source, "sample");
  });
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
