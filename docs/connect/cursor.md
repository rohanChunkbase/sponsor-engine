# Connect Cursor

You keep Cursor. You do not install a new chat app.

The server uses Model Context Protocol (MCP). The HTTP form is streamable HTTP.

## Start the server

1. Open a terminal in this project folder.
2. Start the server.

```bash
npx tsx packages/channels/src/mcp-http.ts
```

The server listens on `http://127.0.0.1:8787/mcp`.

Set `MCP_TOKEN` when you want a bearer token. Leave it empty when you do not want a token. The server still starts.

## Add the HTTP server

1. Create `.cursor/mcp.json` in this project, or create `~/.cursor/mcp.json` for every project.
2. Paste this server.
3. Save the file.
4. Restart Cursor.

```json
{
  "mcpServers": {
    "sponsor-engine": {
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer ${env:MCP_TOKEN}"
      }
    }
  }
}
```

Cursor reads `${env:MCP_TOKEN}` from your shell. Do not add a `type` field. Delete the `headers` block when `MCP_TOKEN` is empty.

## Add the local server

This form runs on your computer. It does not use a token.

```json
{
  "mcpServers": {
    "sponsor-engine": {
      "command": "npm",
      "args": ["run", "mcp"],
      "env": { "DRY_RUN": "true" }
    }
  }
}
```

The tools do not send a message. A reply waits in the outbox until a person approves it.
