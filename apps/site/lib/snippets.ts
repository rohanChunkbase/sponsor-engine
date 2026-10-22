export const githubUrl = "https://github.com/rohanChunkbase/sponsor-engine";

export const licenseUrl = "https://github.com/rohanChunkbase/sponsor-engine/blob/main/LICENSE";

export const startCommand = "npm install && npm run dev";

export const mcpCommand = "npm run mcp";

export const httpCommand = "npm run mcp:http";

export const httpUrl = "http://127.0.0.1:8787/mcp";

export const mcpConfig = `{
  "mcpServers": {
    "sponsor-engine": {
      "command": "npm",
      "args": ["run", "mcp"],
      "env": { "DRY_RUN": "true" }
    }
  }
}`;

export const codexConfig = `[mcp_servers.sponsor-engine]
command = "npm"
args = ["run", "mcp"]

[mcp_servers.sponsor-engine.env]
DRY_RUN = "true"`;

