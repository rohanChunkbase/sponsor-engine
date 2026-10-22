# Connect ChatGPT

You keep ChatGPT. You do not install a new chat app.

ChatGPT connects to a remote MCP URL. The server must use HTTPS. The transport is streamable HTTP.

## Start the server

1. Open a terminal in this project folder.
2. Start the server.

```bash
npx tsx packages/channels/src/mcp-http.ts
```

The server listens on `http://127.0.0.1:8787/mcp`. ChatGPT cannot open that local address.

## Open a tunnel

1. Install `cloudflared`.
2. Open a tunnel to the local server.

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

3. Copy the `https://….trycloudflare.com` host.
4. Add `/mcp` at the end. The connector URL looks like `https://random-name.trycloudflare.com/mcp`.

The tunnel is public while it runs. Close it when you finish the test. Do not put the URL in a public chat.

## Add the connector

ChatGPT calls this Developer mode on some accounts.

1. Open ChatGPT on the web.
2. Open Settings, then Apps, then Advanced settings.
3. Turn Developer mode on when you see that switch.
4. Open Plugins, or Apps.
5. Select the plus button, then Add custom MCP server.
6. Enter the name `sponsor-engine`.
7. Paste the public URL that ends with `/mcp`.
8. Choose No authentication for a short local test.
9. Read the warning. Confirm it. Create the connector.

ChatGPT sends OAuth, or it sends no authentication. It does not send a static bearer token from a pasted header. Leave `MCP_TOKEN` empty for this test. The server still starts.

Use OAuth only when you put your own login service in front of the server. This project does not include that login service.

The tools do not send a message. A reply waits in the outbox until a person approves it.
