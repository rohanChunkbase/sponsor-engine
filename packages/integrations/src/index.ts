/**
 * Sponsor Engine integrations.
 * Import `createRegistry` from the core app. A missing key selects the built-in provider.
 */

import { createRegistry, getStatus, readLocalCrm } from "./registry.ts";
import type { RegistryOptions } from "./options.ts";
import type { CrmContact, MemoryDoc } from "./types.ts";

export { createRegistry, getStatus, readLocalCrm };
export { assertZeroRecordPath, DRAFT_BANNER, tiptap } from "./crm/draft.ts";
export { createLocalCrm } from "./crm/local.ts";
export { createZeroCrm } from "./crm/zero.ts";
export { CRM_STUB_DOCS } from "./crm/stubs.ts";
export type { CrmProvider } from "./crm/types.ts";
export type { MemoryProvider } from "./memory/types.ts";
export type { DataSource } from "./data/types.ts";
export type { FindSponsorsData, SimilarEvent, SponsorMatch } from "./data/sponsors.ts";
export type { ProviderRegistry } from "./registry.ts";
export type { RegistryOptions, ResolvedOptions } from "./options.ts";
export type {
  CompanySize,
  ConnectionStatus,
  CrmContact,
  CrmDealRecord,
  CrmLeadRecord,
  DevpostHackathon,
  LocalCrmFile,
  LumaEventHosts,
  LumaHost,
  LumaSponsor,
  MemoryDoc,
  ProviderResult,
  ProviderSlot,
  RecallHit,
  RememberReceipt,
  ResultMode,
  SicCode,
} from "./types.ts";

export async function pushSponsorLead(
  company: string,
  contact?: CrmContact,
  notes?: string,
  sourceUrls?: string[],
  options?: RegistryOptions,
) {
  return createRegistry(options).crm.pushSponsorLead(company, contact, notes, sourceUrls);
}

export async function pushDeal(
  sponsor: string,
  event: string,
  askAmount: number,
  stage: string,
  options?: RegistryOptions,
) {
  return createRegistry(options).crm.pushDeal(sponsor, event, askAmount, stage);
}

export async function remember(
  organiserId: string,
  docs: Array<string | MemoryDoc>,
  options?: RegistryOptions,
) {
  return createRegistry(options).memory.remember(organiserId, docs);
}

export async function recall(organiserId: string, query: string, options?: RegistryOptions) {
  return createRegistry(options).memory.recall(organiserId, query);
}

export async function lumaEventHosts(eventUrlOrId: string, options?: RegistryOptions) {
  return createRegistry(options).data.lumaEventHosts(eventUrlOrId);
}

export async function devpostLondonHackathons(options?: RegistryOptions) {
  return createRegistry(options).data.devpostLondonHackathons();
}

export async function companySize(name: string, options?: RegistryOptions) {
  return createRegistry(options).data.companySize(name);
}

export async function londonEventsIndex(options?: RegistryOptions) {
  return createRegistry(options).data.londonEventsIndex();
}

export async function findSponsors(query: string, options?: RegistryOptions) {
  return createRegistry(options).data.findSponsors(query);
}

export const find_sponsors = findSponsors;
