import assert from "node:assert/strict";
import test from "node:test";
import { parseGithubUser } from "../src/data/github.ts";
import { getStatus, githubProfile } from "../src/index.ts";
import { baseOptions, header } from "./helpers.ts";

const NOW = Date.parse("2026-10-22T00:00:00.000Z");

test("parseGithubUser reads created_at, public_repos, and followers", () => {
  const profile = parseGithubUser(
    "octocat",
    { created_at: "2011-01-25T18:44:36Z", public_repos: 8, followers: 24709 },
    NOW,
  );
  assert.equal(profile.found, true);
  assert.equal(profile.publicRepos, 8);
  assert.equal(profile.followers, 24709);
  assert.ok((profile.accountAgeDays ?? 0) > 365);
});

test("githubProfile sends the token when it is set and treats 404 as no user", async () => {
  const missing = await githubProfile("octocat", baseOptions());
  assert.equal(missing.mode, "builtin");
  assert.equal(missing.data.found, false);

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/users/missing")) return new Response("nope", { status: 404 });
    assert.match(url, /\/users\/octocat$/);
    assert.equal(header(init, "authorization"), "Bearer ghp-test");
    return new Response(
      JSON.stringify({ created_at: "2011-01-25T18:44:36Z", public_repos: 8, followers: 24709 }),
      { status: 200 },
    );
  };
  const live = await githubProfile("octocat", baseOptions({ env: { GITHUB_TOKEN: "ghp-test" }, fetchImpl }));
  assert.equal(live.mode, "live");
  assert.equal(live.data.publicRepos, 8);
  const absent = await githubProfile("missing", baseOptions({ fetchImpl }));
  assert.equal(absent.mode, "live");
  assert.equal(absent.data.found, false);

  const status = getStatus(baseOptions({ env: { GITHUB_TOKEN: "ghp-test" } }));
  const row = status.find((item) => item.id === "github");
  assert.deepEqual(row?.missing, []);
  assert.match(row?.detail ?? "", /GITHUB_TOKEN is set/);
});
