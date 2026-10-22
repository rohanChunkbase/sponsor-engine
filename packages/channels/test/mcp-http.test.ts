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
