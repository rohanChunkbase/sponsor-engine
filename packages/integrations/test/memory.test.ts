import assert from "node:assert/strict";
import test from "node:test";
import { recall, remember } from "../src/index.ts";
import { baseOptions, header } from "./helpers.ts";

test("built-in recall finds food sponsors for organiser C01", async () => {
  const result = await recall("C01", "which sponsors backed my food before", baseOptions());
  assert.equal(result.mode, "builtin");
  assert.equal(result.provider, "local-memory");
  assert.ok(result.data.length > 0);
  assert.equal(result.data[0]?.organiserId, "C01");
  assert.match(result.data[0]?.text.toLowerCase() ?? "", /food/);
  assert.match(result.data.map((hit) => hit.text).join("\n"), /fictional/i);
});

test("remember stores a note that recall can find", async () => {
  const options = baseOptions();
  const stored = await remember(
    "C01",
    [{ title: "Night note", text: "Bao Down Street Food confirmed the dumplings.", kind: "chat" }],
    options,
  );
  assert.equal(stored.data.stored, 1);
  const result = await recall("thames", "dumplings", options);
  assert.ok(result.data.some((hit) => hit.text.includes("dumplings")));
});

test("Cognee search uses the documented add, cognify, and search calls", async () => {
  const calls: Array<{ url: string; json?: unknown; dataset?: string; auth: string | null }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const entry: (typeof calls)[number] = { url, auth: header(init, "authorization") };
    if (typeof init?.body === "string") entry.json = JSON.parse(init.body);
    if (init?.body instanceof FormData) entry.dataset = String(init.body.get("datasetName"));
    calls.push(entry);
    if (url.endsWith("/api/v1/search")) {
      return new Response(
        JSON.stringify([
          {
            dataset_id: "ds-1",
            dataset_name: "sponsor-engine-C01",
            dataset_tenant_id: "tenant-1",
            search_result: ["Falafel Foundry backed the food."],
          },
        ]),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  };
  const options = baseOptions({
    env: { COGNEE_API_KEY: "cog-key", COGNEE_URL: "http://127.0.0.1:8000" },
    fetchImpl,
  });
  const stored = await remember("C01", ["Past food sponsors for Thames."], options);
  assert.equal(stored.mode, "live");
  assert.equal(stored.data.dataset, "sponsor-engine-C01");
  assert.ok(calls.some((call) => call.url.endsWith("/api/v1/add") && call.dataset === "sponsor-engine-C01"));
  assert.ok(calls.some((call) => call.url.endsWith("/api/v1/cognify")));
  const found = await recall("C01", "food", options);
  assert.equal(found.mode, "live");
  assert.match(found.data[0]?.text ?? "", /Falafel/);
  assert.equal(found.data[0]?.source, "sponsor-engine-C01");
  const search = calls.find((call) => call.url.endsWith("/api/v1/search"));
  const body = search?.json as { datasets?: string[]; search_type?: string };
  assert.deepEqual(body.datasets, ["sponsor-engine-C01"]);
  assert.equal(body.search_type, "GRAPH_COMPLETION");
  assert.equal(search?.auth, "Bearer cog-key");
});

test("Cognee CHUNKS results read the text field on each item", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/api/v1/search")) {
      return new Response(
        JSON.stringify([
          {
            dataset_id: "ds-1",
            dataset_name: "sponsor-engine-C01",
            dataset_tenant_id: "tenant-1",
            search_result: [{ text: "Bao Down supplied the dumplings." }],
          },
        ]),
        { status: 200 },
      );
    }
    return new Response("missing", { status: 404 });
  };
  const result = await recall("C01", "dumplings", baseOptions({
    env: { COGNEE_API_KEY: "cog-key", COGNEE_URL: "http://127.0.0.1:8000" },
    fetchImpl,
  }));
  assert.equal(result.mode, "live");
  assert.equal(result.data[0]?.text, "Bao Down supplied the dumplings.");
  assert.equal(result.data[0]?.source, "sponsor-engine-C01");
});

test("a Cognee failure falls back to built-in search", async () => {
  const result = await recall("C01", "which sponsors backed my food before", baseOptions({
    env: { COGNEE_API_KEY: "cog-key", COGNEE_URL: "http://127.0.0.1:8000" },
    fetchImpl: async () => {
      throw new Error("down");
    },
  }));
  assert.equal(result.mode, "builtin");
  assert.match(result.warning ?? "", /Built-in memory/);
  assert.ok(result.data.length > 0);
});
