import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { getDb, resetSingleton } from "@sponsor-engine/db";
import { allowWrite, resetWriteLimits } from "@sponsor-engine/core";
import { chooseWorkspaceId } from "../src/workspace-id.ts";
import { connectConfigs } from "../src/connect.ts";
import { handleMcpRequest } from "../src/web.ts";

const root = mkdtempSync(path.join(tmpdir(), "sponsor-engine-mcp-"));
const previous = {
  SPONSOR_ENGINE_DB: process.env.SPONSOR_ENGINE_DB,
  SPONSOR_ENGINE_OFFLINE: process.env.SPONSOR_ENGINE_OFFLINE,
  DATABASE_URL: process.env.DATABASE_URL,
  MCP_TOKEN: process.env.MCP_TOKEN,
  DEMO_MODE: process.env.DEMO_MODE,
};

before(() => {
  process.env.SPONSOR_ENGINE_DB = path.join(root, "mcp.db");
  process.env.SPONSOR_ENGINE_OFFLINE = "1";
  delete process.env.DATABASE_URL;
  delete process.env.MCP_TOKEN;
  delete process.env.DEMO_MODE;
  resetSingleton();
  resetWriteLimits();
});

after(() => {
  restore("SPONSOR_ENGINE_DB", previous.SPONSOR_ENGINE_DB);
  restore("SPONSOR_ENGINE_OFFLINE", previous.SPONSOR_ENGINE_OFFLINE);
  restore("DATABASE_URL", previous.DATABASE_URL);
  restore("MCP_TOKEN", previous.MCP_TOKEN);
  restore("DEMO_MODE", previous.DEMO_MODE);
  resetWriteLimits();
  resetSingleton();
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function mcpRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://demo.example/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-forwarded-for": headers["x-forwarded-for"] ?? "203.0.113.50",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("a stateless call needs no session and cannot approve", async () => {
  const listed = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_failures", arguments: { limit: 5 } },
  }));
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get("mcp-session-id"), null);
  const listedBody = await listed.json() as { result?: { content?: Array<{ text: string }> } };
  assert.match(listedBody.result?.content?.[0]?.text ?? "", /\[\]/);

  const approved = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "approve", arguments: { id: "draft-1" } },
  }, { "x-forwarded-for": "203.0.113.51" }));
  assert.equal(approved.status, 200);
  const raw = JSON.stringify(await approved.json());
  assert.match(raw, /not found|unknown tool/i);
  assert.doesNotMatch(raw, /"status": "approved"/);
});

test("the workspace comes from the header or from a bearer that is not MCP_TOKEN", async () => {
  const message = "Please book a company room for 40 people on 2 December 2026.";
  const viaHeader = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "triage_inbound", arguments: { message, channel: "web" } },
  }, { "x-workspace-id": "browser-a-ws", "x-forwarded-for": "203.0.113.52" }));
  assert.equal(viaHeader.status, 200);
  const headerRow = getDb().get<{ workspace_id: string }>(
    "SELECT workspace_id FROM requests WHERE raw_message = ?",
    [message],
  );
  assert.equal(headerRow?.workspace_id, "browser-a-ws");

  const bearerMessage = "Please book a company room for 42 people on 3 December 2026.";
  const viaBearer = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "triage_inbound", arguments: { message: bearerMessage, channel: "web" } },
  }, {
    authorization: "Bearer ws-bearer-1",
    "x-forwarded-for": "203.0.113.53",
  }));
  assert.equal(viaBearer.status, 200);
  const bearerRow = getDb().get<{ workspace_id: string }>(
    "SELECT workspace_id FROM requests WHERE raw_message = ?",
    [bearerMessage],
  );
  assert.equal(bearerRow?.workspace_id, "ws-bearer-1");
});

test("MCP_TOKEN is required until the hosted demo turns it off", async () => {
  process.env.MCP_TOKEN = "secret-token-value";
  delete process.env.DEMO_MODE;
  const denied = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "list_failures", arguments: {} },
  }, { "x-forwarded-for": "203.0.113.54" }));
  assert.equal(denied.status, 401);

  const allowed = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "list_failures", arguments: {} },
  }, {
    authorization: "Bearer secret-token-value",
    "x-forwarded-for": "203.0.113.55",
  }));
  assert.equal(allowed.status, 200);

  process.env.DEMO_MODE = "true";
  const demo = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "list_failures", arguments: {} },
  }, { "x-forwarded-for": "203.0.113.56" }));
  assert.equal(demo.status, 200);
  delete process.env.DEMO_MODE;
  delete process.env.MCP_TOKEN;
});

test("write calls are rate limited", async () => {
  const ip = "198.51.100.7";
  for (let i = 0; i < 40; i += 1) allowWrite(ip);
  const limited = await handleMcpRequest(mcpRequest({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "list_failures", arguments: {} },
  }, { "x-forwarded-for": ip }));
  assert.equal(limited.status, 429);
});

test("an MCP client header is kept when the browser has no workspace cookie", () => {
  assert.equal(chooseWorkspaceId(undefined, "agent-workspace-1"), "agent-workspace-1");
  assert.equal(chooseWorkspaceId("browser-cookie-1", "agent-workspace-1"), "browser-cookie-1");
  assert.notEqual(chooseWorkspaceId(undefined, "nope"), "nope");
});

test("connect snippets point at /api/mcp and do not embed a token", () => {
  const snippets = connectConfigs("https://demo.example");
  const byId = Object.fromEntries(snippets.map((item) => [item.id, item]));
  assert.match(byId.grok.body, /https:\/\/demo\.example\/api\/mcp/);
  assert.doesNotMatch(byId.cursor.body, /"type"/);
  assert.match(byId.claude.body, /"type": "http"/);
  assert.equal(byId.chatgpt.body, "https://demo.example/api/mcp");
  for (const item of snippets) assert.doesNotMatch(item.body, /Bearer|MCP_TOKEN/);
});
