import { findFunction, loadOptionalPackage } from "./optional-module.js";

export type CompanySizeNote = {
  note: string;
  matched_name: string | null;
  via: string;
  source_url: string | null;
};

/** Companies House when a key or the public page is available. The bundle answers with no key. */
export async function companySizeIfAvailable(company: string): Promise<CompanySizeNote | null> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["companySize"]);
  if (!fn) return null;
  try {
    return readCompanySize(await fn(company));
  } catch {
    return null;
  }
}

function readCompanySize(value: unknown): CompanySizeNote | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  const note = typeof data.sizeNote === "string" ? data.sizeNote.trim() : "";
  if (!note) return null;
  return {
    note,
    matched_name: typeof data.matchedName === "string" ? data.matchedName : null,
    via: typeof data.via === "string" ? data.via : "",
    source_url: typeof data.sourceUrl === "string" ? data.sourceUrl : null,
  };
}

export async function lumaHostsIfAvailable(query: { community?: string | null; area?: string | null; headcount?: number | null }) {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["lumaEventHosts", "getLumaHosts"]);
  if (!fn) return null;
  try {
    return await fn(query);
  } catch {
    return null;
  }
}

export type DealPush = {
  used: "built-in" | "external";
  email_sent: false;
  result?: unknown;
  error?: string;
};

/** The CRM stores a draft. It does not send email. No key keeps the built-in file. */
export async function pushDealIfAvailable(input: {
  sponsor: string;
  event: string;
  askAmount: number;
  stage: string;
}): Promise<DealPush> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["pushDeal"]);
  if (!fn) return { used: "built-in", email_sent: false };
  try {
    const result = await fn(input.sponsor, input.event, input.askAmount, input.stage);
    const data = result && typeof result === "object" ? (result as { data?: { emailSent?: boolean }; provider?: string; mode?: string }).data : undefined;
    if (data?.emailSent === true) {
      return {
        used: "built-in",
        email_sent: false,
        error: "The CRM reported an email send. Sponsor Engine kept the draft and did not send.",
      };
    }
    const provider = result && typeof result === "object" ? (result as { provider?: string; mode?: string }).provider : "";
    const mode = result && typeof result === "object" ? (result as { mode?: string }).mode : "";
    const builtin = provider === "local-crm" || mode === "builtin" || provider === "";
    return { used: builtin ? "built-in" : "external", email_sent: false, result };
  } catch (error) {
    return {
      used: "built-in",
      email_sent: false,
      error: error instanceof Error ? error.message : "The CRM call failed. The built-in list still has the deal.",
    };
  }
}

export type MemoryRecall = {
  provider: string;
  mode: string;
  hits: Array<{ title: string; text: string; source: string; score: number }>;
};

/** MemoryProvider.recall. No key uses the built-in keyword search. */
export async function recallIfAvailable(organiserId: string, query: string): Promise<MemoryRecall | null> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["recall"]);
  if (!fn) return null;
  try {
    return readRecall(await fn(organiserId, query));
  } catch {
    return null;
  }
}

function readRecall(value: unknown): MemoryRecall | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.data) ? record.data : [];
  const hits = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const text = typeof item.text === "string" ? item.text : "";
    if (!text) return [];
    return [{
      title: typeof item.title === "string" ? item.title : "",
      text,
      source: typeof item.source === "string" ? item.source : "",
      score: typeof item.score === "number" ? item.score : 0,
    }];
  });
  return {
    provider: typeof record.provider === "string" ? record.provider : "memory",
    mode: typeof record.mode === "string" ? record.mode : "",
    hits,
  };
}

export async function integrationStatus(): Promise<unknown | null> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["getStatus", "status"]);
  if (!fn) return null;
  try {
    return await fn();
  } catch {
    return null;
  }
}
