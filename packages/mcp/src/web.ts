import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { allowWrite } from "@sponsor-engine/core";
import { bearerAllowed } from "./bearer.js";
import { buildServer } from "./server.js";
import { isWorkspaceId } from "./workspace-id.js";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function demoOn(env: NodeJS.ProcessEnv): boolean {
  const value = (env["DEMO_MODE"] ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/** Header first. A bearer that is not the shared MCP_TOKEN can name the workspace. */
export function workspaceFromRequest(request: Request, env: NodeJS.ProcessEnv = process.env): string | null {
  const header = request.headers.get("x-workspace-id")?.trim() ?? "";
  if (isWorkspaceId(header)) return header;
  const expected = env.MCP_TOKEN?.trim() ?? "";
  if (demoOn(env) || expected) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization")?.trim() ?? "");
  const token = match?.[1] ?? "";
  return isWorkspaceId(token) ? token : null;
}

export function mcpAuthorized(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  if (demoOn(env)) return true;
  return bearerAllowed(request.headers.get("authorization") ?? undefined, env.MCP_TOKEN);
}

/**
 * One stateless streamable-HTTP request.
 * JSON responses suit a serverless host. Approve is not a tool.
 * MCP_TOKEN is ignored when DEMO_MODE is on.
 */
export async function handleMcpRequest(request: Request, env: NodeJS.ProcessEnv = process.env): Promise<Response> {
  const limit = allowWrite(clientIp(request));
  if (!limit.ok) {
    return Response.json(
      { error: "Too many requests. Wait a minute and try again." },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }
  if (!mcpAuthorized(request, env)) {
    return Response.json(
      { error: "The bearer token is missing or wrong." },
      { status: 401, headers: { "www-authenticate": "Bearer" } },
    );
  }
  if (request.method === "GET") {
    return Response.json(
      { error: "This server is stateless. Send a POST." },
      { status: 405 },
    );
  }
  const workspaceId = workspaceFromRequest(request, env);
  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const mcp = buildServer(workspaceId);
    await mcp.connect(transport);
    const response = await transport.handleRequest(request);
    await transport.close();
    await mcp.close();
    return response;
  } catch {
    return Response.json({ error: "The MCP server could not read that request." }, { status: 500 });
  }
}
