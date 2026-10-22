import http from "node:http";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isDryRun } from "@sponsor-engine/core";
import { buildServer } from "@sponsor-engine/mcp/src/server.js";
import { bearerAllowed } from "./bearer.js";

/** Streamable HTTP MCP server. MCP_TOKEN is optional. A missing token does not stop the server. */
export function createMcpHttpServer(env: NodeJS.ProcessEnv = process.env): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        dry_run: isDryRun(),
        mcp_token: Boolean(env.MCP_TOKEN?.trim()),
      }));
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found." }));
      return;
    }
    const header = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
    if (!bearerAllowed(header, env.MCP_TOKEN)) {
      res.writeHead(401, { "content-type": "application/json", "www-authenticate": "Bearer" });
      res.end(JSON.stringify({ error: "The bearer token is missing or wrong." }));
      return;
    }
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of req) chunks.push(chunk as Buffer);
    } catch {
      if (!res.headersSent) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "The request body could not be read." }));
      }
      return;
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let body: unknown;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Expected JSON." }));
        return;
      }
    }
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const mcp = buildServer();
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
      await transport.close();
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "The MCP server could not read that request." }));
      }
    }
  });
}

export function startMcpHttp(port = Number(process.env.PORT || 8787), env: NodeJS.ProcessEnv = process.env): http.Server {
  const server = createMcpHttpServer(env);
  server.listen(port, "127.0.0.1", () => {
    const token = env.MCP_TOKEN?.trim();
    console.log(`Sponsor Engine MCP is on http://127.0.0.1:${port}/mcp`);
    console.log(token
      ? "MCP_TOKEN is set. Send a bearer token."
      : "MCP_TOKEN is not set. The server accepts requests with no token.");
  });
  return server;
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invoked === import.meta.url || process.argv[1]?.endsWith("mcp-http.ts")) startMcpHttp();
