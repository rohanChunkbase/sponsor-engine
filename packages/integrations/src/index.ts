/**
 * Sponsor Engine integrations.
 * Import `createRegistry` from the core app. A missing key selects the built-in provider.
 */

import { sponsorMatchEval as runSponsorMatchEval, loadSponsorMatchReport } from "./eval/sponsor-match.ts";
import { createRegistry, getStatus, readLocalCrm } from "./registry.ts";
import { resolveOptions, type RegistryOptions } from "./options.ts";
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
export type { OrganiserLead, OrganiserLeadsData } from "./data/organisers.ts";
export type { DevpostProject } from "./data/devpost-projects.ts";
export type { GithubProfile } from "./data/github.ts";
export type { HackerNewsStory } from "./data/hackernews.ts";
export type { RequesterSignal } from "./data/verify.ts";
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
  LumaAggregates,
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

export { lumaAggregatesFromPayload, parseLumaPayload } from "./data/parse.ts";

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

export async function organiserLeads(options?: RegistryOptions) {
  return createRegistry(options).data.organiserLeads();
}

export async function devpostProjects(query: string, options?: RegistryOptions) {
  return createRegistry(options).data.devpostProjects(query);
}

export async function githubProfile(handle: string, options?: RegistryOptions) {
  return createRegistry(options).data.githubProfile(handle);
}

export async function hackerNewsStories(handle: string, options?: RegistryOptions) {
  return createRegistry(options).data.hackerNewsStories(handle);
}

export async function verifyRequester(handle: string, options?: RegistryOptions) {
  return createRegistry(options).data.verifyRequester(handle);
}

export { isLikelySpam } from "./spam/classify.ts";
export type { SpamVerdict } from "./spam/bayes.ts";
export { triageInbound, triage_inbound } from "./triage.ts";
export type { InboundRequest, InboundTask, TriageData } from "./triage.ts";
export type { SponsorMatchNumbers, SponsorMatchReport, SponsorMatchRow } from "./eval/sponsor-match.ts";

export function sponsorMatchEval(options?: RegistryOptions) {
  return runSponsorMatchEval(resolveOptions(options).seedDir);
}

export function sponsorMatchReport() {
  return loadSponsorMatchReport();
}
