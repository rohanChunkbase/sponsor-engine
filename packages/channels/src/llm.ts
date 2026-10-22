import type { InboundMessage } from "./types.js";

export type LlmSettings =
  | { enabled: false }
  | { enabled: true; baseUrl: string; apiKey: string | null; model: string };

/** Use a model only when the base URL and the model name are both set. The key may be empty. */
export function readLlmSettings(env: NodeJS.ProcessEnv = process.env): LlmSettings {
  const baseUrl = env.LLM_BASE_URL?.trim() ?? "";
  const model = env.LLM_MODEL?.trim() ?? "";
  const apiKey = env.LLM_API_KEY?.trim() ?? "";
  if (!baseUrl || !model) return { enabled: false };
  return { enabled: true, baseUrl: baseUrl.replace(/\/+$/, ""), apiKey: apiKey || null, model };
}

/** Build the chat completions URL for OpenAI, OpenRouter, Ollama, and other compatible hosts. */
export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

/**
 * Ask the configured model to rewrite a rule-based reply.
 * Returns null when no model is set, or when the call fails. The caller keeps the rule-based reply.
 */
export async function draftReply(input: {
  inbound: InboundMessage;
  ruleReply: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const settings = readLlmSettings(input.env);
  if (!settings.enabled) return null;
  const ruleReply = input.ruleReply.trim();
  if (!ruleReply) return null;
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
    const response = await fetchImpl(chatCompletionsUrl(settings.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: "You write a short reply for a venue desk. A person must approve the reply before anyone sends it. Do not say that the reply was sent. Keep the date, the number of people, and the community or company. Return only the reply text.",
          },
          {
            role: "user",
            content: `Message:\n${input.inbound.text}\n\nRule-based reply:\n${ruleReply}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const text = readContent(payload.choices?.[0]?.message?.content);
    if (!text) return null;
    return text.length > 4000 ? text.slice(0, 4000) : text;
  } catch {
    return null;
  }
}

function readContent(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!Array.isArray(value)) return null;
  const text = value.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
    return "";
  }).join("").trim();
  return text || null;
}
