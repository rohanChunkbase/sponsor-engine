import { findFunction, loadOptionalPackage } from "./optional-module.js";

export async function companySizeIfAvailable(company: string) {
  const fn = findFunction(await loadOptionalPackage("integrations"), ["companySize", "getCompanySize"]);
  if (!fn) return null;
  try {
    return await fn(company);
  } catch {
    return null;
  }
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
