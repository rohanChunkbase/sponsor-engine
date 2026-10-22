import { envValue } from "../options.ts";
import type { CrmProvider } from "./types.ts";

interface StubSpec {
  id: string;
  label: string;
  requiredEnv: readonly string[];
  /** What a future adapter must create. It must not send email. */
  records: string;
}

/**
 * Stubs for CRMs a community may already use.
 * A stub does not call the network. Calls go to the built-in CRM.
 * Add a real adapter by implementing CrmProvider and registering it in select.ts.
 */
const STUBS: readonly StubSpec[] = [
  {
    id: "twenty",
    label: "Twenty",
    requiredEnv: ["TWENTY_API_URL", "TWENTY_API_KEY"],
    records: "Create a company record and a deal record in Twenty. Store the ask as a note draft.",
  },
  {
    id: "hubspot",
    label: "HubSpot",
    requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],
    records: "Create a company, a contact, and a deal. Do not enroll the contact in an email workflow.",
  },
  {
    id: "notion",
    label: "Notion",
    requiredEnv: ["NOTION_API_KEY", "NOTION_SPONSORS_DATABASE_ID"],
    records: "Add a page to the sponsors database. Put the email text in the page body as a draft.",
  },
  {
    id: "google-sheets",
    label: "Google Sheets",
    requiredEnv: ["GOOGLE_SHEETS_SPREADSHEET_ID", "GOOGLE_SHEETS_API_KEY"],
    records: "Append one row for the lead or the deal. Do not call a mail add-on.",
  },
];

export function createCrmStubs(local: CrmProvider): CrmProvider[] {
  return STUBS.map((spec) => {
    const provider: CrmProvider = {
      id: spec.id,
      label: spec.label,
      slot: "crm",
      implemented: false,
      requiredEnv: spec.requiredEnv,
      isAvailable: () => false,
      missingEnv(env) {
        return spec.requiredEnv.filter((key) => envValue(env, key) === undefined);
      },
      async pushSponsorLead(company, contact, notes, sourceUrls) {
        const saved = await local.pushSponsorLead(company, contact, notes, sourceUrls);
        return {
          ...saved,
          warning: joinWarning(
            saved.warning,
            `${spec.label} is a stub. The built-in CRM stored this lead. ${spec.records}`,
          ),
        };
      },
      async pushDeal(sponsor, event, askAmount, stage) {
        const saved = await local.pushDeal(sponsor, event, askAmount, stage);
        return {
          ...saved,
          warning: joinWarning(
            saved.warning,
            `${spec.label} is a stub. The built-in CRM stored this deal. ${spec.records}`,
          ),
        };
      },
    };
    return provider;
  });
}

function joinWarning(current: string | undefined, extra: string): string {
  return current ? `${current} ${extra}` : extra;
}

export const CRM_STUB_DOCS = STUBS;
