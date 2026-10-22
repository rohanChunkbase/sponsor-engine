import assert from "node:assert/strict";
import test from "node:test";
import { getStatus } from "../src/index.ts";
import { baseOptions } from "./helpers.ts";

test("a missing key selects the built-in providers and lists the env vars", () => {
  const status = getStatus(baseOptions());
  const local = status.find((row) => row.id === "local-crm");
  const zero = status.find((row) => row.id === "zero");
  const memory = status.find((row) => row.id === "local-memory");
  const cognee = status.find((row) => row.id === "cognee");
  const luma = status.find((row) => row.id === "luma");
  const bundled = status.find((row) => row.id === "bundled-data");
  const house = status.find((row) => row.id === "companies-house");
  const twenty = status.find((row) => row.id === "twenty");
  const mem0 = status.find((row) => row.id === "mem0");

  assert.equal(local?.connected, true);
  assert.equal(local?.active, true);
  assert.deepEqual(local?.missing, []);
  assert.equal(zero?.connected, false);
  assert.equal(zero?.active, false);
  assert.deepEqual(zero?.missing, ["ZERO_API_KEY", "ZERO_WORKSPACE_ID"]);
  assert.equal(memory?.active, true);
  assert.deepEqual(cognee?.missing, ["COGNEE_API_KEY", "COGNEE_URL"]);
  assert.equal(luma?.connected, true);
  assert.deepEqual(luma?.missing, []);
  assert.equal(luma?.active, true);
  assert.equal(bundled?.active, false);
  assert.equal(house?.connected, true);
  assert.equal(house?.missing.length, 0);
  assert.match(house?.detail ?? "", /COMPANIES_HOUSE_API_KEY/);
  assert.equal(twenty?.implemented, false);
  assert.equal(twenty?.connected, false);
  assert.ok(twenty?.missing.includes("TWENTY_API_KEY"));
  assert.equal(mem0?.connected, false);
  assert.deepEqual(mem0?.missing, ["MEM0_API_KEY"]);
});

test("Zero becomes active only when the key and the workspace id are set", () => {
  const partial = getStatus(
    baseOptions({ env: { ZERO_API_KEY: "test-key", ZERO_WORKSPACE_ID: "" } }),
  );
  assert.deepEqual(partial.find((row) => row.id === "zero")?.missing, ["ZERO_WORKSPACE_ID"]);
  assert.equal(partial.find((row) => row.id === "local-crm")?.active, true);

  const ready = getStatus(
    baseOptions({ env: { ZERO_API_TOKEN: "test-key", ZERO_WORKSPACE_ID: "ws-1" } }),
  );
  const zero = ready.find((row) => row.id === "zero");
  assert.equal(zero?.connected, true);
  assert.equal(zero?.active, true);
  assert.deepEqual(zero?.missing, []);
  assert.equal(ready.find((row) => row.id === "local-crm")?.active, false);
});

test("a stub stays inactive when its key is set", () => {
  const status = getStatus(
    baseOptions({ env: { TWENTY_API_URL: "https://example.test", TWENTY_API_KEY: "key" } }),
  );
  const twenty = status.find((row) => row.id === "twenty");
  assert.equal(twenty?.connected, false);
  assert.deepEqual(twenty?.missing, []);
  assert.equal(twenty?.active, false);
  assert.match(twenty?.detail ?? "", /stub/i);
});

test("offline mode keeps bundled data active and does not call the network", () => {
  let called = false;
  const status = getStatus(
    baseOptions({
      offline: true,
      fetchImpl: async () => {
        called = true;
        throw new Error("should not run");
      },
    }),
  );
  assert.equal(called, false);
  assert.equal(status.find((row) => row.id === "bundled-data")?.active, true);
  assert.equal(status.find((row) => row.id === "luma")?.active, false);
  assert.equal(status.find((row) => row.id === "luma")?.connected, true);
});
