import { headers } from "next/headers";
import { McpTry } from "@/components/mcp-try";
import { PageIntro } from "@/components/shell";
import { listTools } from "@sponsor-engine/mcp/catalog";
import { connectConfigs } from "@sponsor-engine/mcp/connect";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const incoming = await headers();
  return (
    <>
      <PageIntro kicker="MCP" title="Try the MCP">
        These are the same tools Grok Bot and Cursor call. A run stays in this browser. Nothing is sent. A person approves on the dashboard.
      </PageIntro>
      <McpTry tools={listTools()} snippets={connectConfigs(publicOrigin(incoming))} />
    </>
  );
}

function publicOrigin(headerList: Headers): string {
  const configured = process.env["NEXT_PUBLIC_APP_URL"]?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = (headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3000").split(",")[0]?.trim() || "localhost:3000";
  const proto = (headerList.get("x-forwarded-proto") || "http").split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}
