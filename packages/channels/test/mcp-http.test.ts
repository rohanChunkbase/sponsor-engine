import assert from "node:assert/strict";
import type { Server } from "node:http";
import { test } from "node:test";
import { bearerAllowed, createMcpHttpServer } from "../src/index.ts";

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "channels-test", version: "0" },
  },
};

test("an empty MCP token allows the request", () => {
  assert.equal(bearerAllowed(undefined, ""), true);
  assert.equal(bearerAllowed(undefined, undefined), true);
  assert.equal(bearerAllowed("Bearer secret", "secret"), true);
  assert.equal(bearerAllowed("bearer secret", "secret"), true);
  assert.equal(bearerAllowed("Bearer wrong", "secret"), false);
  assert.equal(bearerAllowed(undefined, "secret"), false);
});

test("streamable http asks for a token only when MCP_TOKEN is set", async () => {
  const locked = await listen(createMcpHttpServer({ MCP_TOKEN: "secret", DRY_RUN: "true" }));
  try {
    const health = await fetch(`${locked.url}/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json() as { ok: boolean; mcp_token: boolean };
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.mcp_token, true);

    const blocked = await fetch(`${locked.url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(blocked.status, 401);
    const blockedBody = await blocked.text();
    assert.doesNotMatch(blockedBody, /secret/);

    const allowed = await post(locked.url, "secret");
    assert.notEqual(allowed.status, 401);
    assert.equal(allowed.status, 200);
  } finally {
    await close(locked.server);
  }
});

test("streamable http starts when MCP_TOKEN is not set", async () => {
  const open = await listen(createMcpHttpServer({ DRY_RUN: "true" }));
  try {
    const response = await post(open.url);
    assert.notEqual(response.status, 401);
    assert.equal(response.status, 200);
  } finally {
    await close(open.server);
  }
});

test("the http server does not offer approve", async () => {
  const open = await listen(createMcpHttpServer({ DRY_RUN: "true" }));
  try {
    const listed = await fetch(`${open.url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    assert.equal(listed.status, 200);
    const body = await listed.json() as { result?: { tools?: Array<{ name: string }> } };
    const names = (body.result?.tools ?? []).map((tool) => tool.name);
    assert.ok(names.includes("triage_inbound"));
    assert.equal(names.includes("approve"), false);

    const called = await fetch(`${open.url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "approve", arguments: { id: "draft-1" } },
      }),
    });
    assert.equal(called.status, 200);
    const raw = JSON.stringify(await called.json());
    assert.match(raw, /not found|unknown tool/i);
    assert.doesNotMatch(raw, /"status": "approved"/);
  } finally {
    await close(open.server);
  }
});

async function post(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${url}/mcp`, { method: "POST", headers, body: JSON.stringify(initialize) });
}

function listen(server: Server): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}
