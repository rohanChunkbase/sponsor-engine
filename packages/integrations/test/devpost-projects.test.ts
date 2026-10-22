import assert from "node:assert/strict";
import test from "node:test";
import { parseDevpostProjects } from "../src/data/devpost-projects.ts";
import { devpostProjects } from "../src/index.ts";
import { baseOptions, header } from "./helpers.ts";

const PAYLOAD = {
  total_count: 1,
  software: [
    {
      name: "Community bot",
      tagline: "Answers the front desk.",
      url: "https://devpost.com/software/community-bot",
      members: ["ada"],
      tags: ["agents"],
      winner: true,
      like_count: 12,
    },
  ],
};

test("parseDevpostProjects keeps members and the winner flag", () => {
  const projects = parseDevpostProjects(PAYLOAD);
  assert.equal(projects[0]?.name, "Community bot");
  assert.deepEqual(projects[0]?.members, ["ada"]);
  assert.equal(projects[0]?.winner, true);
  assert.equal(projects[0]?.likeCount, 12);
});

test("devpostProjects asks for JSON and falls back when the call fails", async () => {
  const failed = await devpostProjects("ada", baseOptions());
  assert.equal(failed.mode, "builtin");
  assert.deepEqual(failed.data, []);

  const fetchImpl: typeof fetch = async (input, init) => {
    assert.match(String(input), /devpost\.com\/software\/search\?query=ada/);
    assert.equal(header(init, "accept"), "application/json");
    return new Response(JSON.stringify(PAYLOAD), { status: 200 });
  };
  const live = await devpostProjects("ada", baseOptions({ fetchImpl }));
  assert.equal(live.mode, "live");
  assert.equal(live.data[0]?.winner, true);
});
