import assert from "node:assert/strict";
import test from "node:test";
import { parseBuilderBase } from "../src/data/builderbase.ts";
import { organiserLeads } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

const PAYLOAD = {
  data: {
    events: [
      {
        name: "GFTN Forum",
        slug: "gftn-forum",
        start_at: "2026-11-01T00:00:00.000Z",
        end_at: "2026-11-03T00:00:00.000Z",
        format: "in-person",
        event_type: "hackathon",
        location: { lat: 1.29, lng: 103.85, city: "Singapore", country: "Singapore" },
        participant_count: 220,
        organization: { name: "GFTN" },
        theme_tags: ["fintech", "policy"],
      },
      {
        name: "London builders weekend",
        slug: "london-builders",
        start_at: "2026-12-01T00:00:00.000Z",
        end_at: "2026-12-02T00:00:00.000Z",
        format: "in-person",
        location: { lat: 51.5, lng: -0.12, city: "London", country: "United Kingdom" },
        participant_count: 80,
        organization: { name: "Thames Builders" },
        theme_tags: ["agents"],
      },
    ],
    next_cursor: null,
  },
};

test("parseBuilderBase keeps the organiser, size, and theme tags", () => {
  const leads = parseBuilderBase(PAYLOAD);
  assert.equal(leads.length, 2);
  assert.equal(leads[0]?.organisation, "GFTN");
  assert.equal(leads[0]?.size, 220);
  assert.deepEqual(leads[0]?.themes, ["fintech", "policy"]);
  assert.equal(leads[0]?.london, false);
  assert.equal(leads[1]?.london, true);
  assert.equal(leads[1]?.lat, 51.5);
});

test("organiserLeads uses BuilderBase when discovery responds", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (!url.includes("builderbase.com")) return new Response("down", { status: 503 });
    return new Response(JSON.stringify(PAYLOAD), { status: 200 });
  };
  const result = await organiserLeads(baseOptions({ fetchImpl }));
  assert.equal(result.mode, "live");
  assert.equal(result.data.leads.length, 2);
  assert.equal(result.data.leads[0]?.organisation, "GFTN");
});

test("organiserLeads uses bundled hackathons when discovery fails", async () => {
  const result = await organiserLeads(baseOptions());
  assert.equal(result.mode, "builtin");
  assert.ok(result.data.leads.length > 0);
  assert.match(result.warning ?? "", /BuilderBase/);
});
