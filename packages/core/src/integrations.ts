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

export async function pushDealIfAvailable(deal: Record<string, unknown>) {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["pushDeal", "zeroPushDeal"]);
  if (!fn) return { used: "built-in" as const };
  try {
    const result = await fn(deal);
    return { used: "external" as const, result };
  } catch (error) {
    return {
      used: "built-in" as const,
      error: error instanceof Error ? error.message : "The CRM call failed. The built-in list still has the deal.",
    };
  }
}

export async function recallIfAvailable(query: string) {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["recall", "recallHistory", "cogneeRecall"]);
  if (!fn) return null;
  try {
    return await fn(query);
  } catch {
    return null;
  }
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
