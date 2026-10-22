# Connect Codex CLI

You keep the Codex CLI. You do not install a new chat app.

The server uses Model Context Protocol (MCP). The HTTP form is streamable HTTP.

## Start the server

1. Open a terminal in this project folder.
2. Start the server.

```bash
npx tsx packages/channels/src/mcp-http.ts
```

The server listens on `http://127.0.0.1:8787/mcp`.

Set `MCP_TOKEN` in the same shell when you want a bearer token. Leave it empty when you do not want a token. The server still starts.

## Add the HTTP server

1. Open `~/.codex/config.toml`. A project file `.codex/config.toml` also works in a trusted project.
2. Paste this block.
3. Export `MCP_TOKEN` before you start Codex. The value is the variable name, not the token text.

```toml
[mcp_servers.sponsor-engine]
url = "http://127.0.0.1:8787/mcp"
bearer_token_env_var = "MCP_TOKEN"
```

Delete `bearer_token_env_var` when `MCP_TOKEN` is empty. Codex then connects with no token.

## Add the local server

This form runs on your computer. It does not use a token. Replace the path with this project folder.

```toml
[mcp_servers.sponsor-engine]
command = "npm"
args = ["run", "mcp"]
cwd = "/absolute/path/to/sponsor-engine"

[mcp_servers.sponsor-engine.env]
DRY_RUN = "true"
```

The tools do not send a message. A reply waits in the outbox until a person approves it.
