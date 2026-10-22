import assert from "node:assert/strict";
import test from "node:test";
import { parseEventbritePage } from "../src/data/eventbrite.ts";
import { londonEventsIndex } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

const PAGE = `<!doctype html><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Event",
        name: "London tech breakfast",
        description: "A short morning meetup.",
        startDate: "2026-11-20T08:00:00+00:00",
        endDate: "2026-11-20T10:00:00+00:00",
        url: "https://www.eventbrite.co.uk/e/london-tech-breakfast",
        location: {
          "@type": "Place",
          name: "Campus London",
          address: {
            "@type": "PostalAddress",
            streetAddress: "4-5 Bonhill Street",
            addressLocality: "London",
          },
          geo: { "@type": "GeoCoordinates", latitude: 51.525, longitude: -0.086 },
        },
      },
    },
  ],
})}</script>`;

test("parseEventbritePage reads an ItemList event", () => {
  const events = parseEventbritePage(PAGE);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.name, "London tech breakfast");
  assert.equal(events[0]?.venue, "Campus London");
  assert.equal(events[0]?.address, "4-5 Bonhill Street, London");
  assert.equal(events[0]?.lat, 51.525);
  assert.equal(events[0]?.startAt, "2026-11-20T08:00:00+00:00");
});

test("londonEventsIndex keeps Eventbrite rows from the listing", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("eventbrite.co.uk")) return new Response(PAGE, { status: 200 });
    return new Response("down", { status: 503 });
  };
  const result = await londonEventsIndex(baseOptions({ fetchImpl }));
  const rows = result.data.events.filter((event) => event.source === "eventbrite");
  assert.equal(rows.length, 1);
  assert.equal(result.data.venues[0]?.name, "Campus London");
  assert.equal(result.data.sources.find((row) => row.id === "eventbrite")?.mode, "live");
});
