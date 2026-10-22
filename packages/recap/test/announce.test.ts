import assert from "node:assert/strict";
import { test } from "node:test";

import { announceWinners, cardSpecFor } from "../src/announce.ts";
import { cardSpecFromSearchParams } from "../src/cards.ts";
import { RecapInputError } from "../src/errors.ts";
import { EXPEDITE_EXAMPLE, getRecap } from "../src/example.ts";
import { attendeeCountFromLuma } from "../src/luma.ts";
import { shareOnLinkedIn, shareOnX } from "../src/share.ts";

const base = {
  eventName: "Hackathon at Expedite",
  date: "2026-10-22",
  venue: "Expedite",
  sponsors: ["Example Labs"],
  winners: [{ place: "1", team: "EXAMPLE Team North", project: "EXAMPLE Raft Notes" }],
};

test("a winner card uses the share line", () => {
  const recap = announceWinners({ ...base, example: true });
  assert.equal(recap.slug, "hackathon-at-expedite-2026-10-22");
  assert.equal(recap.cards[0]?.caption, "1st place, EXAMPLE Team North, EXAMPLE Raft Notes, Hackathon at Expedite @ Expedite");
  assert.equal(recap.cards.map((card) => card.kind).join(","), "winner,sponsors,summary");
});

test("the Expedite seed labels every winner as an example", () => {
  assert.equal(EXPEDITE_EXAMPLE.example, true);
  assert.equal(EXPEDITE_EXAMPLE.winners.length, 3);
  assert.equal(getRecap(EXPEDITE_EXAMPLE.slug), EXPEDITE_EXAMPLE);
  for (const winner of EXPEDITE_EXAMPLE.winners) {
    assert.match(winner.team, /^EXAMPLE /);
    assert.match(winner.project, /^EXAMPLE /);
  }
  assert.equal(EXPEDITE_EXAMPLE.cards[0]?.heading, "1st place");
  assert.equal(EXPEDITE_EXAMPLE.cards[3]?.heading, "Thank you sponsors");
  assert.equal(EXPEDITE_EXAMPLE.cards[4]?.id, "summary");
});

test("Luma contributes a count and no personal fields", () => {
  const luma = {
    guest_counts: { approved: { guests: 42, tickets: 40 } },
    hosts: [{ name: "Amina Host", email: "amina@example.com" }],
    guests: [{ name: "Sam Guest", email: "sam@example.com" }],
  };
  assert.equal(attendeeCountFromLuma(luma), 42);
  const recap = announceWinners({ ...base, luma });
  assert.equal(recap.attendeeCount, 42);
  const packed = JSON.stringify(recap);
  assert.equal(packed.includes("Amina"), false);
  assert.equal(packed.includes("sam@example.com"), false);
  assert.equal(attendeeCountFromLuma({ guests: [{ name: "Sam Guest" }] }), undefined);
});

test("an organiser count wins over the Luma count", () => {
  const recap = announceWinners({
    ...base,
    attendeeCount: 80,
    luma: { guest_counts: { approved: { guests: 42 } } },
  });
  assert.equal(recap.attendeeCount, 80);
});

test("bad dates and links are refused", () => {
  assert.throws(() => announceWinners({ ...base, date: "2026-02-31" }), RecapInputError);
  assert.throws(() => announceWinners({ ...base, winners: [{ place: "1", team: "EXAMPLE A", project: "EXAMPLE B", url: "javascript:alert(1)" }] }), RecapInputError);
});

test("card lookup and share intents stay on the public compose URLs", () => {
  const spec = cardSpecFor(EXPEDITE_EXAMPLE, "winner", 0, "landscape");
  assert.ok(spec);
  assert.equal(spec.width, 1200);
  assert.equal(spec.height, 630);
  assert.equal(spec.kicker, "EXAMPLE");
  const portrait = cardSpecFor(EXPEDITE_EXAMPLE, "summary", 0, "portrait");
  assert.equal(portrait?.width, 1080);
  assert.equal(portrait?.height, 1350);
  assert.equal(cardSpecFromSearchParams(new URLSearchParams("slug=missing&kind=summary&format=landscape")), undefined);

  const params = new URLSearchParams({
    slug: EXPEDITE_EXAMPLE.slug,
    kind: "sponsors",
    format: "portrait",
  });
  assert.equal(cardSpecFromSearchParams(params)?.heading, "Thank you sponsors");

  const page = "https://example.com/recap/hackathon-at-expedite-2026-10-22?card=winner-0";
  const x = new URL(shareOnX(page, EXPEDITE_EXAMPLE.cards[0]!.caption));
  assert.equal(x.origin + x.pathname, "https://twitter.com/intent/tweet");
  assert.equal(x.searchParams.get("url"), page);
  const linkedin = new URL(shareOnLinkedIn(page));
  assert.equal(linkedin.origin + linkedin.pathname, "https://www.linkedin.com/sharing/share-offsite/");
  assert.equal(linkedin.searchParams.get("url"), page);
});
