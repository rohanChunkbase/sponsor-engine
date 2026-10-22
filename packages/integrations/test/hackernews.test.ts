import assert from "node:assert/strict";
import test from "node:test";
import { parseHackerNews } from "../src/data/hackernews.ts";
import { hackerNewsStories } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

const PAYLOAD = {
  hits: [
    {
      title: "Show HN: a community bot",
      url: "https://example.com/bot",
      points: 12,
      num_comments: 3,
      created_at: "2026-10-01T00:00:00.000Z",
      author: "ada",
    },
  ],
};

test("parseHackerNews reads title, points, and author", () => {
  const stories = parseHackerNews(PAYLOAD);
  assert.equal(stories[0]?.title, "Show HN: a community bot");
  assert.equal(stories[0]?.points, 12);
  assert.equal(stories[0]?.author, "ada");
});

test("hackerNewsStories searches stories by author", async () => {
  const failed = await hackerNewsStories("ada", baseOptions());
  assert.equal(failed.mode, "builtin");

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    assert.match(url, /hn\.algolia\.com\/api\/v1\/search_by_date/);
    assert.match(url, /tags=story,author_ada/);
    return new Response(JSON.stringify(PAYLOAD), { status: 200 });
  };
  const live = await hackerNewsStories("ada", baseOptions({ fetchImpl }));
  assert.equal(live.mode, "live");
  assert.equal(live.data[0]?.points, 12);
});
