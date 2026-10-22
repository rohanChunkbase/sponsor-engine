import { pathToFileURL } from "node:url";
import { startMcpHttp } from "@sponsor-engine/mcp/http";

export { createMcpHttpServer, startMcpHttp } from "@sponsor-engine/mcp/http";

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invoked === import.meta.url || process.argv[1]?.endsWith("mcp-http.ts")) startMcpHttp();
