import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isDryRun } from "@sponsor-engine/core";
import { buildServer } from "./server.js";

const port = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, dry_run: isDryRun() }));
    return;
  }
  if (!url.startsWith("/mcp")) {
    res.writeHead(404);
    res.end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  let body: unknown;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400);
      res.end("Expected JSON.");
      return;
    }
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const mcp = buildServer();
  await mcp.connect(transport);
  await transport.handleRequest(req, res, body);
});

server.listen(port, () => {
  console.log(`Sponsor Engine MCP is on http://127.0.0.1:${port}/mcp`);
});
