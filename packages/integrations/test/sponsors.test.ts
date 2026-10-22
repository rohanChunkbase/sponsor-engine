import assert from "node:assert/strict";
import test from "node:test";
import { findSponsors, find_sponsors } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

test("findSponsors ranks sponsors from similar events and leaves out the query event", async () => {
  const result = await findSponsors("L-encode-london-2026", baseOptions());
  assert.equal(result.ok, true);
  assert.equal(result.data.eventId, "L-encode-london-2026");
  assert.equal(result.data.community, "Encode Club");
  assert.ok(result.data.similarEvents.length > 0);
  assert.ok(result.data.similarEvents.every((event) => event.eventId !== "L-encode-london-2026"));
  const hub = result.data.sponsors.find((row) => row.company === "Encode Hub");
  assert.ok(hub, "Encode Hub backs other Encode events");
  assert.ok(hub.sourceUrls.length > 0);
  assert.ok(hub.sourceUrls.every((url) => url.startsWith("http")));
  assert.equal(find_sponsors, findSponsors);
});

test("findSponsors returns an empty list when nothing is similar", async () => {
  const result = await findSponsors("zzzz-no-such-event", baseOptions());
  assert.equal(result.mode, "builtin");
  assert.deepEqual(result.data.sponsors, []);
  assert.match(result.warning ?? "", /No similar events/);
});
