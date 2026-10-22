import assert from "node:assert/strict";
import test from "node:test";
import { loadSponsorLabels } from "../src/eval/sponsor-match.ts";
import { sponsorMatchEval, sponsorMatchReport } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

test("sponsor match eval reports precision@3 and recall@5 for the labelled events", () => {
  const labels = loadSponsorLabels();
  assert.equal(labels.length, 30);
  for (const label of labels) {
    assert.ok(label.sponsors.length > 0, label.eventId);
    for (const sponsor of label.sponsors) {
      assert.ok(sponsor.company, label.eventId);
      assert.match(sponsor.sourceUrl ?? "", /^https?:\/\//, `${label.eventId} ${sponsor.company}`);
    }
  }
  const report = sponsorMatchEval(baseOptions());
  const saved = sponsorMatchReport();
  assert.equal(report.events, saved.events);
  assert.equal(report.precisionAt3, saved.precisionAt3);
  assert.equal(report.recallAt5, saved.recallAt5);
  assert.equal(saved.events, 30);
  assert.ok(saved.precisionAt3 > 0 && saved.precisionAt3 < 1);
  assert.ok(saved.recallAt5 > 0 && saved.recallAt5 < 1);
});
