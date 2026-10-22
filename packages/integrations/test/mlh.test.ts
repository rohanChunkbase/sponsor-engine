import assert from "node:assert/strict";
import test from "node:test";
import { parseMlhPage } from "../src/data/mlh.ts";
import { organiserLeads } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

const PAGE = `<!doctype html><script data-page="app" type="application/json">${JSON.stringify({
  props: {
    upcomingEvents: [
      {
        name: "London Hack Week",
        startsAt: "2026-11-01T00:00:00.000Z",
        endsAt: "2026-11-02T00:00:00.000Z",
        location: "London, UK",
        formatType: "in-person",
        url: "https://mlh.io/events/london-hack-week",
        logoUrl: "https://mlh.io/logo.png",
      },
    ],
    pastEvents: [
      {
        name: "Past Cup",
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-02T00:00:00.000Z",
        location: "New York, NY",
        formatType: "in-person",
        url: "https://mlh.io/events/past-cup",
      },
    ],
  },
})}</script>`;

test("parseMlhPage reads upcoming and past events", () => {
  const leads = parseMlhPage(PAGE);
  assert.equal(leads.length, 2);
  assert.equal(leads[0]?.eventName, "London Hack Week");
  assert.equal(leads[0]?.london, true);
  assert.equal(leads[0]?.format, "in-person");
  assert.equal(leads[1]?.london, false);
});

test("organiserLeads keeps MLH rows when the season page responds", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("mlh.io/seasons")) return new Response(PAGE, { status: 200 });
    return new Response("down", { status: 503 });
  };
  const result = await organiserLeads(baseOptions({ fetchImpl }));
  assert.equal(result.mode, "live");
  assert.equal(result.data.leads.filter((lead) => lead.source === "mlh").length, 2);
  assert.equal(result.data.sources.find((source) => source.id === "mlh")?.mode, "live");
  assert.equal(result.data.sources.find((source) => source.id === "builderbase")?.mode, "builtin");
});
