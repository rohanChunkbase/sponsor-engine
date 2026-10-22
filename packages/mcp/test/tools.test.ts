import assert from "node:assert/strict";
import { test } from "node:test";
import { buildServer } from "../src/server.ts";

test("the MCP server does not let an agent approve its own draft", () => {
  const server = buildServer() as unknown as { _registeredTools: Record<string, unknown> };
  const names = Object.keys(server._registeredTools);
  assert.equal(names.includes("approve"), false);
  for (const name of [
    "triage_inbound",
    "quote_booking",
    "find_sponsors",
    "forecast_turnout",
    "draft_sponsor_ask",
    "send_with_approval",
    "list_failures",
    "recall_history",
  ]) {
    assert.equal(names.includes(name), true, name);
  }
});
