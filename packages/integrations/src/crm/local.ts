import { randomUUID } from "node:crypto";
import type { ResolvedOptions } from "../options.ts";
import { builtinResult } from "../result.ts";
import type { CrmContact, CrmDealRecord, CrmLeadRecord, ProviderResult } from "../types.ts";
import { appendDeal, appendLead } from "./store.ts";
import type { CrmProvider } from "./types.ts";

function blank(company: string): string | undefined {
  return company.trim() ? undefined : "The company name is empty. No record was written.";
}

function leadRecord(
  company: string,
  contact: CrmContact | undefined,
  notes: string | undefined,
  sourceUrls: string[] | undefined,
): CrmLeadRecord {
  return {
    id: `local-${randomUUID()}`,
    company: company.trim(),
    contact,
    notes,
    sourceUrls: sourceUrls ?? [],
    draft: true,
    emailSent: false,
    createdAt: new Date().toISOString(),
  };
}

function dealRecord(sponsor: string, event: string, askAmount: number, stage: string): CrmDealRecord {
  const amount = Number.isFinite(askAmount) ? askAmount : 0;
  return {
    id: `local-${randomUUID()}`,
    sponsor: sponsor.trim(),
    event: event.trim(),
    askAmount: amount,
    stage: stage.trim(),
    currency: "GBP",
    draft: true,
    emailSent: false,
    createdAt: new Date().toISOString(),
  };
}

export function createLocalCrm(options: ResolvedOptions): CrmProvider {
  return {
    id: "local-crm",
    label: "Built-in CRM",
    slot: "crm",
    implemented: true,
    requiredEnv: [],
    isAvailable: () => true,
    missingEnv: () => [],
    async pushSponsorLead(company, contact, notes, sourceUrls) {
      const warning = blank(company);
      const record = leadRecord(company, contact, notes, sourceUrls);
      if (!warning) await appendLead(options.dataDir, record);
      return builtinResult("local-crm", record, warning);
    },
    async pushDeal(sponsor, event, askAmount, stage) {
      const warning = blank(sponsor) ?? (event.trim() ? undefined : "The event name is empty. No record was written.");
      const record = dealRecord(sponsor, event, askAmount, stage);
      if (!warning) await appendDeal(options.dataDir, record);
      const amountWarning = Number.isFinite(askAmount) ? undefined : "The ask amount was not a number. 0 was stored.";
      return builtinResult("local-crm", record, [warning, amountWarning].filter(Boolean).join(" ") || undefined);
    },
  };
}

export async function saveLeadLocal(
  options: ResolvedOptions,
  company: string,
  contact?: CrmContact,
  notes?: string,
  sourceUrls?: string[],
): Promise<ProviderResult<CrmLeadRecord>> {
  return createLocalCrm(options).pushSponsorLead(company, contact, notes, sourceUrls);
}

export async function saveDealLocal(
  options: ResolvedOptions,
  sponsor: string,
  event: string,
  askAmount: number,
  stage: string,
): Promise<ProviderResult<CrmDealRecord>> {
  return createLocalCrm(options).pushDeal(sponsor, event, askAmount, stage);
}
