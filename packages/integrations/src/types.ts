/**
 * Shared result and status types.
 * A missing key returns a result. It does not throw.
 */

export type ProviderSlot = "crm" | "memory" | "data";

export type ResultMode = "live" | "builtin";

export interface ProviderResult<T> {
  ok: true;
  /** "live" when the external tool answered. "builtin" when the local tool answered. */
  mode: ResultMode;
  /** Provider id that produced `data`, for example "zero" or "local-crm". */
  provider: string;
  data: T;
  /** Set when the call moved to the built-in tool, or when a draft needs care. */
  warning?: string;
  /** True when `data` was read from the disk cache. */
  cached?: boolean;
}

export interface ConnectionStatus {
  /** Stable id, for example "zero" or "local-crm". */
  id: string;
  /** Name for the Connections screen. */
  name: string;
  slot: ProviderSlot;
  /** True when this provider can run with the current environment. */
  connected: boolean;
  /**
   * Env var names that are empty.
   * An empty array means no required env var is missing.
   */
  missing: string[];
  /** True when calls use this provider first. */
  active: boolean;
  /** False for a stub. A stub never becomes the active provider. */
  implemented: boolean;
  /** One short sentence for the Connections screen. */
  detail: string;
}

export interface CrmContact {
  name?: string;
  email?: string;
  title?: string;
  linkedin?: string;
}

export interface CrmLeadRecord {
  id: string;
  company: string;
  contact?: CrmContact;
  notes?: string;
  sourceUrls: string[];
  companyId?: string;
  contactId?: string;
  noteId?: string;
  /** Always true. This package stores a draft and does not send email. */
  draft: true;
  /** Always false. This package does not send email. */
  emailSent: false;
  createdAt: string;
}

export interface CrmDealRecord {
  id: string;
  sponsor: string;
  event: string;
  askAmount: number;
  stage: string;
  currency: "GBP";
  companyId?: string;
  dealId?: string;
  noteId?: string;
  draft: true;
  emailSent: false;
  createdAt: string;
}

export interface MemoryDoc {
  title?: string;
  text: string;
  kind?: string;
  source?: string;
}

export interface RecallHit {
  organiserId: string;
  title: string;
  text: string;
  score: number;
  source: string;
  kind: string;
}

export interface RememberReceipt {
  organiserId: string;
  stored: number;
  dataset?: string;
}

export interface LumaHost {
  name: string;
  linkedinHandle: string | null;
  twitterHandle: string | null;
  website: string | null;
  lumaUsername: string | null;
}

export interface LumaSponsor {
  company: string;
  role: string;
  confidence: string | null;
  evidence: string | null;
  sourceUrl: string | null;
}

export interface LumaEventHosts {
  eventId: string | null;
  name: string | null;
  url: string | null;
  startAt: string | null;
  guestCount: number | null;
  calendarName: string | null;
  hosts: LumaHost[];
  sponsors: LumaSponsor[];
}

export interface DevpostHackathon {
  id: string | null;
  title: string;
  url: string | null;
  location: string | null;
  dates: string | null;
  status: string | null;
  organizationName: string | null;
  registrationsCount: number | null;
  prizeAmount: string | null;
  themes: string[];
}

export interface SicCode {
  code: string;
  description?: string;
}

export interface CompanySize {
  query: string;
  matchedName: string | null;
  companyNumber: string | null;
  status: string | null;
  incorporatedOn: string | null;
  sicCodes: SicCode[];
  address: string | null;
  sizeNote: string;
  sourceUrl: string | null;
  /** "official-api", "public-page", or "bundled-data". */
  via: "official-api" | "public-page" | "bundled-data";
}

export interface LocalCrmFile {
  provider: "local-crm";
  updatedAt: string;
  leads: CrmLeadRecord[];
  deals: CrmDealRecord[];
}
