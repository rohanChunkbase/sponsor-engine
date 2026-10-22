import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { rewriteDocUrl } from "../lib/remark-docs-links.mjs";

const config = JSON.parse(readFileSync(new URL("../../../docs/docs.json", import.meta.url), "utf8"));

test("the docs navigation uses the seven Mintlify groups", () => {
  const groups = config.navigation.groups.map((group: { group: string }) => group.group);
  assert.deepEqual(groups, [
    "Quickstart",
    "Connect your agent",
    "MCP tools reference",
    "Channels",
    "Bring your own tools",
    "Safety",
    "Self-host",
  ]);
});

test("every docs.json page is an MDX file with a title", () => {
  for (const group of config.navigation.groups) {
    for (const slug of group.pages) {
      const text = readFileSync(new URL(`../../../docs/${slug}.mdx`, import.meta.url), "utf8");
      assert.match(text, /^---\ntitle: ".+"\n/);
    }
  }
});

test("Mintlify root links open the same pages under /docs", () => {
  assert.equal(rewriteDocUrl("/connect"), "/docs/connect");
  assert.equal(rewriteDocUrl("/tools#triage_inbound"), "/docs/tools#triage_inbound");
  assert.equal(rewriteDocUrl("/quickstart"), "/docs");
  assert.equal(rewriteDocUrl("/safety"), "/docs/safety");
  assert.equal(rewriteDocUrl("https://example.com/safety"), "https://example.com/safety");
  assert.equal(rewriteDocUrl("/mcp"), "/mcp");
});
