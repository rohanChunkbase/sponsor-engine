import http from "node:http";
import { handleMcpRequest } from "./web.js";

/** Node listener for the same stateless MCP handler as /api/mcp. Approve is not a tool. */
export function createMcpHttpServer(env: NodeJS.ProcessEnv = process.env): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        dry_run: dryRun(env),
        mcp_token: Boolean(env.MCP_TOKEN?.trim()),
      }));
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found." }));
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
    try {
      const response = await handleMcpRequest(toRequest(req, Buffer.concat(chunks)), env);
      await writeResponse(res, response);
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

function dryRun(env: NodeJS.ProcessEnv): boolean {
  const demo = (env.DEMO_MODE ?? "").trim().toLowerCase();
  if (demo === "true" || demo === "1" || demo === "yes") return true;
  const value = (env.DRY_RUN ?? process.env.DRY_RUN ?? "true").trim().toLowerCase();
  return value !== "false" && value !== "0" && value !== "no";
}

function toRequest(req: http.IncomingMessage, body: Buffer): Request {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else headers.set(key, value);
  }
  if (!headers.has("x-forwarded-for") && req.socket.remoteAddress) {
    headers.set("x-forwarded-for", req.socket.remoteAddress);
  }
  const method = req.method || "GET";
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") init.body = new Uint8Array(body);
  return new Request(url, init);
}

async function writeResponse(res: http.ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, key) => {
    const current = headers[key];
    if (current === undefined) headers[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else headers[key] = [current, value];
  });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}
