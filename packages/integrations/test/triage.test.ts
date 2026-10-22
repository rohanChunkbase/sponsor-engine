import assert from "node:assert/strict";
import test from "node:test";
import { triageInbound, triage_inbound } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

test("triageInbound routes spam to the spam lane and does not create a task", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    throw new Error("spam must not call the network");
  };
  const result = await triageInbound(
    { text: "URGENT! You have won a free prize. Call now to claim your reward.", handle: "spammer" },
    baseOptions({ fetchImpl }),
  );
  assert.equal(result.data.lane, "spam");
  assert.equal(result.data.task, null);
  assert.equal(result.data.spam.spam, true);
  assert.equal(called, false);
  assert.equal(triage_inbound, triageInbound);
});

test("triageInbound creates a task and attaches the builder check", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.github.com")) {
      return new Response(
        JSON.stringify({ created_at: "2011-01-25T18:44:36Z", public_repos: 8, followers: 20 }),
        { status: 200 },
      );
    }
    if (url.includes("devpost.com")) return new Response(JSON.stringify({ software: [] }), { status: 200 });
    if (url.includes("hn.algolia.com")) return new Response(JSON.stringify({ hits: [] }), { status: 200 });
    return new Response("no", { status: 404 });
  };
  const result = await triageInbound(
    { text: "Can you intro us to a sponsor for the November meetup?", handle: "@ada" },
    baseOptions({ fetchImpl }),
  );
  assert.equal(result.data.lane, "task");
  assert.equal(result.data.task?.requester?.handle, "ada");
  assert.equal(result.data.task?.requester?.realBuilder, true);
  assert.equal(result.mode, "live");
});
