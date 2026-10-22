# Connect Claude

You keep Claude. You do not install a new chat app.

The server uses Model Context Protocol (MCP). The HTTP form is streamable HTTP.

## Start the server

1. Open a terminal in this project folder.
2. Start the server.

```bash
npx tsx packages/channels/src/mcp-http.ts
```

The server listens on `http://127.0.0.1:8787/mcp`.

Set `MCP_TOKEN` when you want a bearer token. Leave it empty when you do not want a token. The server still starts.

## Claude Code

1. Open a terminal in this project folder.
2. Add the server. Replace `replace-me` with the same value as `MCP_TOKEN`.

```bash
claude mcp add --transport http sponsor-engine http://127.0.0.1:8787/mcp \
  --header "Authorization: Bearer replace-me"
```

You can also save this file as `.mcp.json` in the project folder.

```json
{
  "mcpServers": {
    "sponsor-engine": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer ${MCP_TOKEN}"
      }
    }
  }
}
```

Claude Code needs `"type": "http"`. `streamable-http` is also valid. An entry with `url` and no `type` does not load.

Delete the `headers` block when `MCP_TOKEN` is empty.

## Claude Desktop

Claude Desktop runs a local command. Put this in the desktop config file.

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

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

Set the working directory to this project folder when the desktop form asks for it. Restart Claude Desktop.

For a remote URL, open Settings, then Connectors, then add a custom connector. Use `http://127.0.0.1:8787/mcp`. Add the header `Authorization: Bearer replace-me` when the form has a header field and `MCP_TOKEN` is set.

The tools do not send a message. A reply waits in the outbox until a person approves it.
