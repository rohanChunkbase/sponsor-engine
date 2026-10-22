import assert from "node:assert/strict";
import test from "node:test";
import { scoreRequester } from "../src/data/verify.ts";
import { verifyRequester } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

test("scoreRequester marks an established builder and ignores an empty profile", () => {
  const strong = scoreRequester({
    handle: "ada",
    github: {
      handle: "ada",
      found: true,
      createdAt: "2011-01-25T18:44:36Z",
      publicRepos: 8,
      followers: 20,
      accountAgeDays: 5000,
    },
    devpostProjects: [
      { name: "Bot", url: "https://devpost.com/software/bot", tagline: null, winner: true, likeCount: 1, members: ["ada"], tags: [] },
    ],
    hackerNews: [{ title: "Show HN", url: null, points: 3, comments: 0, createdAt: null, author: "ada" }],
  });
  assert.equal(strong.realBuilder, true);
  assert.equal(strong.score, 1);
  assert.ok(strong.reasons.some((reason) => /one year/.test(reason)));

  const empty = scoreRequester({ handle: "new", github: null, devpostProjects: [], hackerNews: [] });
  assert.equal(empty.realBuilder, false);
  assert.equal(empty.score, 0);
});

test("verifyRequester combines the three public sources", async () => {
  const failed = await verifyRequester("ada", baseOptions());
  assert.equal(failed.mode, "builtin");
  assert.equal(failed.data.realBuilder, false);

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.github.com")) {
      return new Response(
        JSON.stringify({ created_at: "2026-06-01T00:00:00Z", public_repos: 2, followers: 1 }),
        { status: 200 },
      );
    }
    if (url.includes("devpost.com/software/search")) {
      return new Response(JSON.stringify({ software: [] }), { status: 200 });
    }
    if (url.includes("hn.algolia.com")) return new Response(JSON.stringify({ hits: [] }), { status: 200 });
    return new Response("no", { status: 404 });
  };
  const live = await verifyRequester("ada", baseOptions({ fetchImpl }));
  assert.equal(live.mode, "live");
  assert.equal(live.data.github?.publicRepos, 2);
  assert.equal(live.data.realBuilder, true);
  assert.ok((live.data.github?.accountAgeDays ?? 0) >= 90);
});
