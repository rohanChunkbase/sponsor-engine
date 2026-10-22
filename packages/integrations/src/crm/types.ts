import type { CrmContact, CrmDealRecord, CrmLeadRecord, ProviderResult } from "../types.ts";

/**
 * CRM provider. Bring your own CRM, or use the built-in file.
 * Implementations create records and drafts. They do not send email.
 */
export interface CrmProvider {
  readonly id: string;
  readonly label: string;
  readonly slot: "crm";
  readonly implemented: boolean;
  /** Env vars the Connections screen lists when they are empty. */
  readonly requiredEnv: readonly string[];
  isAvailable(env: Record<string, string | undefined>): boolean;
  missingEnv(env: Record<string, string | undefined>): string[];
  pushSponsorLead(
    company: string,
    contact?: CrmContact,
    notes?: string,
    sourceUrls?: string[],
  ): Promise<ProviderResult<CrmLeadRecord>>;
  pushDeal(
    sponsor: string,
    event: string,
    askAmount: number,
    stage: string,
  ): Promise<ProviderResult<CrmDealRecord>>;
}
