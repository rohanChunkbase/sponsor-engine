import assert from "node:assert/strict";
import test from "node:test";
import { createRegistry, getStatus } from "../src/index.ts";
import type { ConnectionStatus } from "../src/types.ts";
import { baseOptions } from "./helpers.ts";

const EXPECTED_IDS = [
  "local-crm",
  "zero",
  "twenty",
  "hubspot",
  "notion",
  "google-sheets",
  "local-memory",
  "cognee",
  "mem0",
  "bundled-data",
  "luma",
  "luma-discover",
  "luma-ics",
  "meetup",
  "eventbrite",
  "builderbase",
  "devpost",
  "companies-house",
] as const;

function row(status: ConnectionStatus[], id: string): ConnectionStatus {
  const found = status.find((item) => item.id === id);
  assert.ok(found, `missing status row ${id}`);
  return found;
}

test("getStatus lists every provider and keeps one built-in CRM and one built-in memory active", () => {
  const registry = createRegistry(baseOptions());
  assert.equal(registry.crm.id, "local-crm");
  assert.equal(registry.crm.slot, "crm");
  assert.equal(registry.memory.id, "local-memory");
  assert.equal(registry.memory.slot, "memory");
  assert.equal(registry.data.id, "live-data");
  assert.equal(registry.data.slot, "data");

  const status = registry.getStatus();
  assert.deepEqual(
    status.map((item) => item.id),
    [...EXPECTED_IDS],
  );

  for (const id of ["local-crm", "local-memory", "luma", "luma-discover", "luma-ics", "meetup", "eventbrite", "builderbase", "devpost", "companies-house", "bundled-data"] as const) {
    const item = row(status, id);
    assert.equal(item.connected, true, id);
    assert.deepEqual(item.missing, [], id);
  }

  assert.equal(row(status, "local-crm").active, true);
  assert.equal(row(status, "zero").active, false);
  assert.equal(row(status, "local-memory").active, true);
  assert.equal(row(status, "cognee").active, false);
  assert.equal(row(status, "luma").active, true);
  assert.equal(row(status, "luma-discover").active, true);
  assert.equal(row(status, "luma-ics").active, true);
  assert.equal(row(status, "meetup").active, true);
  assert.equal(row(status, "eventbrite").active, true);
  assert.equal(row(status, "builderbase").active, true);
  assert.equal(row(status, "devpost").active, true);
  assert.equal(row(status, "companies-house").active, true);
  assert.equal(row(status, "bundled-data").active, false);

  for (const slot of ["crm", "memory"] as const) {
    assert.equal(status.filter((item) => item.slot === slot && item.active).length, 1);
  }

  for (const id of ["twenty", "hubspot", "notion", "google-sheets", "mem0"] as const) {
    const item = row(status, id);
    assert.equal(item.connected, false, id);
    assert.equal(item.implemented, false, id);
    assert.equal(item.active, false, id);
    assert.ok(item.missing.length > 0, id);
  }
});

test("Cognee becomes the active memory provider when the key and the URL are set", () => {
  const partial = getStatus(baseOptions({ env: { COGNEE_API_KEY: "cog-key" } }));
  assert.equal(row(partial, "cognee").connected, false);
  assert.deepEqual(row(partial, "cognee").missing, ["COGNEE_URL"]);
  assert.equal(row(partial, "local-memory").active, true);

  const registry = createRegistry(
    baseOptions({
      env: { COGNEE_API_KEY: "cog-key", COGNEE_BASE_URL: "http://127.0.0.1:8000" },
    }),
  );
  assert.equal(registry.memory.id, "cognee");
  const status = registry.getStatus();
  assert.equal(row(status, "cognee").connected, true);
  assert.equal(row(status, "cognee").active, true);
  assert.deepEqual(row(status, "cognee").missing, []);
  assert.equal(row(status, "local-memory").active, false);
  assert.equal(row(status, "local-crm").active, true);
});

test("the Companies House key does not block the public page", () => {
  const open = getStatus(baseOptions());
  assert.match(row(open, "companies-house").detail, /public search page/);

  const keyed = getStatus(baseOptions({ env: { COMPANIES_HOUSE_API_KEY: "ch-key" } }));
  const house = row(keyed, "companies-house");
  assert.equal(house.connected, true);
  assert.equal(house.active, true);
  assert.deepEqual(house.missing, []);
  assert.match(house.detail, /official API/);
});

test("registry calls use the built-in providers when no key is set", async () => {
  const registry = createRegistry(baseOptions());
  const deal = await registry.crm.pushDeal("Anthropic", "Encode London Hackathon", 1500, "intro");
  const memory = await registry.memory.recall("C01", "which sponsors backed my food before");
  const company = await registry.data.companySize("Anthropic");
  assert.equal(deal.provider, "local-crm");
  assert.equal(deal.mode, "builtin");
  assert.equal(deal.data.emailSent, false);
  assert.equal(memory.provider, "local-memory");
  assert.equal(memory.mode, "builtin");
  assert.ok(memory.data.length > 0);
  assert.equal(company.provider, "bundled-data");
  assert.equal(company.mode, "builtin");
  assert.equal(company.data.matchedName, "Anthropic");
});
