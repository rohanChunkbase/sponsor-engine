import assert from "node:assert/strict";
import test from "node:test";
import { londonEventsIndex } from "../src/index.ts";
import { parseLumaDiscover, parseLumaIcs } from "../src/data/luma-discover.ts";
import { baseOptions } from "./helpers.ts";

const DISCOVER = {
  entries: [
    {
      api_id: "entry-1",
      guest_count: 139,
      start_at: "2026-11-01T18:00:00.000Z",
      hosts: [{ first_name: "Ada", last_name: "Lovelace", linkedin_handle: "ada" }],
      calendar: { api_id: "cal-wUKLVX9VWOdVkpg", name: "Future Forward", slug: "future-forward" },
      event: {
        api_id: "evt-demo",
        calendar_api_id: "cal-wUKLVX9VWOdVkpg",
        name: "Agent night",
        start_at: "2026-11-01T18:00:00.000Z",
        end_at: "2026-11-01T21:00:00.000Z",
        url: "https://lu.ma/agent-night",
        geo_address_info: {
          address: "Shoreditch",
          full_address: "1 Appold Street, London",
          place_coordinate: { latitude: 51.52, longitude: -0.08 },
        },
        coordinate: { latitude: 51.513413, longitude: -0.102748 },
      },
    },
  ],
  has_more: false,
  next_cursor: null,
};

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-ics-1
DTSTART:20261101T180000Z
DTEND:20261101T210000Z
SUMMARY:Future Forward meetup
LOCATION:London
URL:https://lu.ma/ff-meetup
END:VEVENT
END:VCALENDAR
`;

test("parseLumaDiscover reads guest count, geo, and calendar", () => {
  const parsed = parseLumaDiscover(DISCOVER);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0]?.size, 139);
  assert.equal(parsed.events[0]?.lat, 51.513413);
  assert.equal(parsed.events[0]?.lng, -0.102748);
  assert.equal(parsed.events[0]?.calendarName, "Future Forward");
  assert.equal(parsed.events[0]?.calendarId, "cal-wUKLVX9VWOdVkpg");
  assert.deepEqual(parsed.events[0]?.hostNames, ["Ada Lovelace"]);
  assert.deepEqual(parsed.calendarIds, ["cal-wUKLVX9VWOdVkpg"]);
  assert.equal(parsed.events[0]?.venue, "Shoreditch");
});

test("parseLumaIcs reads a calendar event", () => {
  const events = parseLumaIcs(ICS, "cal-wUKLVX9VWOdVkpg");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.name, "Future Forward meetup");
  assert.equal(events[0]?.address, "London");
  assert.equal(events[0]?.url, "https://lu.ma/ff-meetup");
  assert.equal(events[0]?.source, "luma-ics");
});

test("londonEventsIndex uses the bundle when discover fails", async () => {
  const result = await londonEventsIndex(baseOptions());
  assert.equal(result.mode, "builtin");
  assert.equal(result.provider, "bundled-data");
  assert.ok(result.data.events.some((event) => event.lat !== null));
  assert.match(result.warning ?? "", /Luma discover/);
});

test("londonEventsIndex builds venues and calendars from discover and the calendar feed", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/discover/get-paginated-events")) {
      return new Response(JSON.stringify(DISCOVER), { status: 200 });
    }
    if (url.includes("ics/get")) {
      assert.match(url, /id=cal-wUKLVX9VWOdVkpg/);
      return new Response(ICS, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
  const result = await londonEventsIndex(baseOptions({ fetchImpl }));
  assert.equal(result.mode, "live");
  assert.equal(result.provider, "london-events");
  assert.equal(result.data.events.length, 2);
  assert.equal(result.data.venues.length, 1);
  assert.equal(result.data.venues[0]?.lat, 51.513413);
  assert.equal(result.data.venues[0]?.largestSize, 139);
  const calendar = result.data.calendars.find((row) => row.name === "Future Forward");
  assert.ok(calendar);
  assert.equal(calendar?.eventCount, 2);
  assert.equal(calendar?.totalGuests, 139);
  assert.equal(result.data.sources.find((row) => row.id === "luma-discover")?.mode, "live");
  assert.equal(result.data.sources.find((row) => row.id === "luma-ics")?.mode, "live");
});
