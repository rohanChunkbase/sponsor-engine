"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type ToolCard = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  example: Record<string, unknown>;
};

export type ConnectSnippet = {
  id: string;
  name: string;
  note: string;
  body: string;
};

export function McpTry({ tools, snippets }: { tools: ToolCard[]; snippets: ConnectSnippet[] }) {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[24px] leading-[30px] font-medium tracking-[-0.025em]">Connect</h2>
        <p className="max-w-[720px] text-[18px] leading-[29px] text-muted-foreground">
          Point your chat app at this site. The hosted demo does not need a token.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {snippets.map((snippet) => <Snippet key={snippet.id} snippet={snippet} />)}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[24px] leading-[30px] font-medium tracking-[-0.025em]">Tools</h2>
        <div className="flex flex-col gap-4">
          {tools.map((tool) => <Tool key={tool.name} tool={tool} />)}
        </div>
      </section>
    </div>
  );
}

function Snippet({ snippet }: { snippet: ConnectSnippet }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet.body);
    } catch {
      const area = document.createElement("textarea");
      area.value = snippet.body;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="bg-surface">
      <CardHeader>
        <CardTitle>{snippet.name}</CardTitle>
        <CardDescription>{snippet.note}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <pre className="overflow-auto rounded-[8px] border border-border bg-background p-3 font-mono text-[12px] leading-4">{snippet.body}</pre>
        <div>
          <Button type="button" variant="secondary" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Tool({ tool }: { tool: ToolCard }) {
  const [raw, setRaw] = useState(JSON.stringify(tool.example, null, 2));
  const [result, setResult] = useState("");
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setResult("");
    try {
      const args = JSON.parse(raw) as unknown;
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: tool.name, arguments: args },
        }),
      });
      const text = await response.text();
      setResult(response.ok ? pretty(text) : `${response.status}\n${text}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "The tool did not run.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card id={tool.name}>
      <CardHeader>
        <p className="font-mono text-[12px] leading-4 tracking-[0.08em] text-muted-foreground uppercase">{tool.name}</p>
        <CardTitle>{tool.title}</CardTitle>
        <CardDescription>{tool.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <details>
          <summary className="cursor-pointer text-[16px] leading-6">Input schema</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-[8px] border border-border bg-surface p-3 font-mono text-[12px] leading-4">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
        </details>
        <label className="flex flex-col gap-2 text-[16px] leading-6" htmlFor={`example-${tool.name}`}>
          Example
          <Textarea id={`example-${tool.name}`} className="min-h-40 font-mono text-[13px] leading-5" value={raw} onChange={(event) => setRaw(event.target.value)} />
        </label>
        <div>
          <Button type="button" onClick={() => void run()} disabled={pending}>{pending ? "Running" : "Run"}</Button>
        </div>
        {result ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[8px] border border-border bg-surface p-3 font-mono text-[12px] leading-4">{result}</pre>
        ) : null}
      </CardContent>
    </Card>
  );
}

function pretty(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as { result?: { content?: Array<{ text?: string }> } };
      const inner = parsed.result?.content?.map((item) => item.text).filter(Boolean).join("\n");
      if (inner) {
        try {
          return JSON.stringify(JSON.parse(inner), null, 2);
        } catch {
          return inner;
        }
      }
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  }
  const data = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]");
  const last = data.at(-1);
  return last ? pretty(last) : text;
}
