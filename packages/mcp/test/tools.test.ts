import assert from "node:assert/strict";
import { test } from "node:test";
import { listTools } from "../src/catalog.ts";
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
  const cards = listTools();
  assert.deepEqual(cards.map((card) => card.name).sort(), names.sort());
  for (const card of cards) {
    assert.ok(card.description.length > 20, card.name);
    assert.equal(typeof card.inputSchema, "object");
    assert.ok(card.example);
  }
});
