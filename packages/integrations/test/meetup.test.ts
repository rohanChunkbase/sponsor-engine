import assert from "node:assert/strict";
import test from "node:test";
import { londonEventsIndex } from "../src/index.ts";
import { parseMeetupPage } from "../src/data/meetup.ts";
import { baseOptions } from "./helpers.ts";

const PAGE = `<!doctype html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      __APOLLO_STATE__: {
        "Group:london-js": { __typename: "Group", id: "london-js", name: "London JavaScript" },
        "RsvpCounts:evt-1": { __typename: "RsvpCounts", totalCount: 86 },
        "Event:evt-1": {
          __typename: "Event",
          title: "London JS tech night",
          dateTime: "2026-11-12T18:30:00.000Z",
          eventUrl: "https://www.meetup.com/london-js/events/evt-1/",
          eventType: "PHYSICAL",
          rsvps: { __ref: "RsvpCounts:evt-1" },
          group: { __ref: "Group:london-js" },
        },
      },
    },
  },
})}</script>`;

test("parseMeetupPage reads RSVP size and the group", () => {
  const events = parseMeetupPage(PAGE);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.name, "London JS tech night");
  assert.equal(events[0]?.size, 86);
  assert.equal(events[0]?.calendarName, "London JavaScript");
  assert.equal(events[0]?.source, "meetup");
});

test("londonEventsIndex keeps Meetup rows when the search page responds", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("meetup.com/find")) return new Response(PAGE, { status: 200 });
    return new Response("down", { status: 503 });
  };
  const result = await londonEventsIndex(baseOptions({ fetchImpl }));
  assert.equal(result.mode, "live");
  const meetup = result.data.events.filter((event) => event.source === "meetup");
  assert.equal(meetup.length, 1);
  assert.equal(meetup[0]?.size, 86);
  assert.equal(result.data.sources.find((row) => row.id === "meetup")?.mode, "live");
  assert.equal(result.data.sources.find((row) => row.id === "luma-discover")?.mode, "builtin");
});
