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

export type SpamCheck = { spam: boolean; score: number; reasons: string[] };

/** Local SMS model. A missing package does not block the desk. */
export async function spamCheck(text: string): Promise<SpamCheck | null> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["isLikelySpam"]);
  if (!fn) return null;
  try {
    const value = await fn(text);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    return {
      spam: record.spam === true,
      score: typeof record.score === "number" ? record.score : 0,
      reasons: Array.isArray(record.reasons) ? record.reasons.filter((item) => typeof item === "string") : [],
    };
  } catch {
    return null;
  }
}

export type RequesterCheck = {
  handle: string;
  real_builder: boolean;
  reasons: string[];
  warning: string | null;
};

/** Public GitHub, Devpost, and Hacker News signals. Offline keeps the booking and skips the lookup. */
export async function verifyHandle(handle: string): Promise<RequesterCheck | null> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["verifyRequester"]);
  if (!fn) return null;
  try {
    const value = await fn(handle);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
    const name = typeof data.handle === "string" ? data.handle : handle;
    return {
      handle: name,
      real_builder: data.realBuilder === true,
      reasons: Array.isArray(data.reasons) ? data.reasons.filter((item) => typeof item === "string") : [],
      warning: typeof record.warning === "string" ? record.warning : null,
    };
  } catch {
    return null;
  }
}

export type SponsorEvidence = {
  company: string;
  roles: string[];
  similar_events: string[];
  source_urls: string[];
};

/** Sponsors named on similar public events, with the claim URL. */
export async function sponsorEvidence(query: string): Promise<SponsorEvidence[]> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["findSponsors", "find_sponsors"]);
  if (!fn || !query.trim()) return [];
  try {
    return readSponsorEvidence(await fn(query));
  } catch {
    return [];
  }
}

export type SponsorMatchAccuracy = {
  events: number;
  precision_at_3: number;
  recall_at_5: number;
};

/** Saved sponsor-match check. precision@3 and recall@5 are fractions, not percents. */
export async function sponsorMatchAccuracy(): Promise<SponsorMatchAccuracy | null> {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["sponsorMatchReport"]);
  if (!fn) return null;
  try {
    const value = await fn();
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const events = typeof record.events === "number" ? record.events : 0;
    const precision = typeof record.precisionAt3 === "number" ? record.precisionAt3 : null;
    const recall = typeof record.recallAt5 === "number" ? record.recallAt5 : null;
    if (precision === null || recall === null || events < 1) return null;
    return { events, precision_at_3: precision, recall_at_5: recall };
  } catch {
    return null;
  }
}

function readSponsorEvidence(value: unknown): SponsorEvidence[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  const rows = Array.isArray(data.sponsors) ? data.sponsors : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const company = typeof item.company === "string" ? item.company.trim() : "";
    if (!company) return [];
    const strings = (value: unknown) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()) as string[] : [];
    return [{
      company,
      roles: strings(item.roles),
      similar_events: strings(item.similarEvents),
      source_urls: strings(item.sourceUrls),
    }];
  });
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
