# Connect Grok Bot

You keep Grok Bot. You do not install a new chat app.

The server uses Model Context Protocol (MCP). The HTTP form is streamable HTTP.

## Start the server

1. Open a terminal in this project folder.
2. Start the server.

```bash
npx tsx packages/channels/src/mcp-http.ts
```

The server listens on `http://127.0.0.1:8787/mcp`.

Set `MCP_TOKEN` when you want a bearer token. Leave `MCP_TOKEN` empty when you do not want a token. The server still starts.

```bash
MCP_TOKEN=replace-me npx tsx packages/channels/src/mcp-http.ts
```

## Add the HTTP server

1. Open the MCP settings in Grok Bot.
2. Paste this server.
3. Replace `replace-me` with the same value as `MCP_TOKEN`.
4. Save the settings.

```json
{
  "mcpServers": {
    "sponsor-engine": {
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer replace-me"
      }
    }
  }
}
```

Delete the `headers` block when `MCP_TOKEN` is empty.

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

Set the working directory to this project folder.

The tools do not send a message. A reply waits in the outbox until a person approves it.
