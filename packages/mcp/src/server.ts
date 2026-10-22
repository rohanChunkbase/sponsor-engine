import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./catalog.js";

export function buildServer(workspaceId: string | null = null) {
  const server = new McpServer({ name: "sponsor-engine", version: "0.1.0" });
  registerTools(server, workspaceId);
  return server;
}

export { listTools } from "./catalog.js";
export type { ToolCard } from "./catalog.js";
