export type ConnectSnippet = {
  id: "grok" | "cursor" | "claude" | "chatgpt";
  name: string;
  note: string;
  body: string;
};

/** Snippets for the public MCP URL. They do not include a secret. */
export function connectConfigs(origin: string): ConnectSnippet[] {
  const url = `${origin.replace(/\/$/, "")}/api/mcp`;
  const remote = {
    mcpServers: {
      "sponsor-engine": { url },
    },
  };
  return [
    {
      id: "grok",
      name: "Grok Bot",
      note: "Paste this server into the MCP settings. Add an Authorization bearer header when you set MCP_TOKEN.",
      body: JSON.stringify(remote, null, 2),
    },
    {
      id: "cursor",
      name: "Cursor",
      note: "Save this as .cursor/mcp.json. Do not add a type field. Add an Authorization bearer header when you set MCP_TOKEN.",
      body: JSON.stringify(remote, null, 2),
    },
    {
      id: "claude",
      name: "Claude",
      note: "Claude Code needs type http. Add an Authorization bearer header when you set MCP_TOKEN.",
      body: JSON.stringify({
        mcpServers: {
          "sponsor-engine": { type: "http", url },
        },
      }, null, 2),
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      note: "Paste this URL into a custom MCP connector. Choose no authentication. ChatGPT needs an https address.",
      body: url,
    },
  ];
}
