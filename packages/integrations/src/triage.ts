import type { RegistryOptions, ResolvedOptions } from "./options.ts";
import { resolveOptions } from "./options.ts";
import { builtinResult, liveResult } from "./result.ts";
import type { SpamVerdict } from "./spam/bayes.ts";
import { isLikelySpam } from "./spam/classify.ts";
import type { ProviderResult } from "./types.ts";
import { verifyRequester } from "./data/verify.ts";
import type { RequesterSignal } from "./data/verify.ts";

export interface InboundRequest {
  text: string;
  handle?: string;
}

export interface InboundTask {
  title: string;
  text: string;
  requester: RequesterSignal | null;
}

export interface TriageData {
  lane: "spam" | "task";
  spam: SpamVerdict;
  task: InboundTask | null;
}

export async function triageInbound(
  input: InboundRequest,
  options?: RegistryOptions,
): Promise<ProviderResult<TriageData>> {
  return triageWithOptions(input, resolveOptions(options));
}

export const triage_inbound = triageInbound;

async function triageWithOptions(
  input: InboundRequest,
  options: ResolvedOptions,
): Promise<ProviderResult<TriageData>> {
  const text = input.text.trim();
  const spam = isLikelySpam(text);
  if (spam.spam) {
    return builtinResult("sms-spam", { lane: "spam", spam, task: null });
  }
  const title = text.split("\n")[0]?.slice(0, 80) || "Inbound request";
  const handle = input.handle?.trim().replace(/^@/, "");
  if (!handle) {
    return builtinResult("sms-spam", {
      lane: "task",
      spam,
      task: { title, text, requester: null },
    });
  }
  const requester = await verifyRequester(handle, options);
  const data: TriageData = {
    lane: "task",
    spam,
    task: { title, text, requester: requester.data },
  };
  if (requester.mode === "live") return liveResult("verify-requester", data, { warning: requester.warning });
  return builtinResult("bundled-data", data, requester.warning);
}
