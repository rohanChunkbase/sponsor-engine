import { randomUUID } from "node:crypto";
import { politeInterval, requestText } from "../http.ts";
import { envValue } from "../options.ts";
import type { ResolvedOptions } from "../options.ts";
import { errorText, liveResult } from "../result.ts";
import { companyDomain, findSponsor, loadBundle } from "../seed/load.ts";
import type { CrmDealRecord, CrmLeadRecord } from "../types.ts";
import { DRAFT_BANNER, assertZeroRecordPath, tiptap } from "./draft.ts";
import { saveDealLocal, saveLeadLocal } from "./local.ts";
import type { CrmProvider } from "./types.ts";

const DEFAULT_BASE = "https://api.zero.inc";

function recordId(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { id?: unknown; data?: { id?: unknown } };
  if (typeof record.data?.id === "string") return record.data.id;
  if (typeof record.id === "string") return record.id;
  return undefined;
}

function zeroConfigured(env: Record<string, string | undefined>): boolean {
  return envValue(env, "ZERO_API_KEY", "ZERO_API_TOKEN") !== undefined && envValue(env, "ZERO_WORKSPACE_ID") !== undefined;
}

function zeroMissing(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  if (envValue(env, "ZERO_API_KEY", "ZERO_API_TOKEN") === undefined) missing.push("ZERO_API_KEY");
  if (envValue(env, "ZERO_WORKSPACE_ID") === undefined) missing.push("ZERO_WORKSPACE_ID");
  return missing;
}

export function createZeroCrm(options: ResolvedOptions, local: CrmProvider): CrmProvider {
  const base = (envValue(options.env, "ZERO_API_BASE") ?? DEFAULT_BASE).replace(/\/$/, "");
  const apiKey = envValue(options.env, "ZERO_API_KEY", "ZERO_API_TOKEN") ?? "";
  const workspaceId = envValue(options.env, "ZERO_WORKSPACE_ID") ?? "";

  async function post(resourcePath: string, body: unknown): Promise<unknown> {
    assertZeroRecordPath(resourcePath);
    const response = await requestText({
      url: `${base}${resourcePath}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      timeoutMs: Math.max(options.timeoutMs, 5000),
      fetchImpl: options.fetchImpl,
      lane: "zero",
      minIntervalMs: politeInterval(options.fetchImpl, 200),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Zero HTTP ${response.status}`);
    }
    try {
      return JSON.parse(response.text) as unknown;
    } catch {
      return {};
    }
  }

  async function createCompany(name: string, externalId: string, description?: string): Promise<string> {
    const sponsor = findSponsor(loadBundle(options.seedDir), name);
    const domain = companyDomain(sponsor?.website);
    const body: Record<string, unknown> = {
      workspaceId,
      name,
      source: "sponsor-engine",
      externalId,
    };
    if (domain) body.domain = domain;
    if (description?.trim()) body.description = description.trim();
    const created = await post("/api/companies", body);
    const id = recordId(created);
    if (!id) throw new Error("Zero company response had no id");
    return id;
  }

  return {
    id: "zero",
    label: "Zero",
    slot: "crm",
    implemented: true,
    requiredEnv: ["ZERO_API_KEY", "ZERO_WORKSPACE_ID"],
    isAvailable: zeroConfigured,
    missingEnv: zeroMissing,
    async pushSponsorLead(company, contact, notes, sourceUrls) {
      if (!zeroConfigured(options.env)) {
        const saved = await local.pushSponsorLead(company, contact, notes, sourceUrls);
        const missing = zeroMissing(options.env);
        return {
          ...saved,
          warning: saved.warning ?? `Set ${missing.join(" and ")} to connect Zero. The built-in CRM stored this lead.`,
        };
      }
      const externalId = `sponsor-engine:${randomUUID()}`;
      try {
        const companyId = await createCompany(company.trim(), externalId, notes);
        let contactId: string | undefined;
        if (contact && (contact.name || contact.email || contact.linkedin || contact.title)) {
          const contactBody: Record<string, unknown> = {
            workspaceId,
            companyId,
            source: "sponsor-engine",
            externalId: `${externalId}:contact`,
          };
          if (contact.name) contactBody.name = contact.name;
          if (contact.email) contactBody.email = contact.email;
          if (contact.title) contactBody.title = contact.title;
          if (contact.linkedin) contactBody.linkedin = contact.linkedin;
          const created = await post("/api/contacts", contactBody);
          contactId = recordId(created);
        }
        const paragraphs = [
          DRAFT_BANNER,
          notes?.trim() || "Sponsor lead from Sponsor Engine.",
          ...(sourceUrls ?? []).map((url) => `Source: ${url}`),
        ];
        const noteBody: Record<string, unknown> = {
          workspaceId,
          companyId,
          name: "Sponsor lead draft",
          source: "sponsor-engine",
          externalId: `${externalId}:note`,
          content: tiptap(paragraphs),
        };
        if (contactId) noteBody.contactId = contactId;
        const note = await post("/api/notes", noteBody);
        const record: CrmLeadRecord = {
          id: companyId,
          company: company.trim(),
          contact,
          notes,
          sourceUrls: sourceUrls ?? [],
          companyId,
          contactId,
          noteId: recordId(note),
          draft: true,
          emailSent: false,
          createdAt: new Date().toISOString(),
        };
        return liveResult("zero", record);
      } catch (error) {
        const saved = await saveLeadLocal(options, company, contact, notes, sourceUrls);
        return {
          ...saved,
          warning: `Zero did not accept the lead (${errorText(error)}). The built-in CRM stored it.`,
        };
      }
    },
    async pushDeal(sponsor, event, askAmount, stage) {
      if (!zeroConfigured(options.env)) {
        const saved = await local.pushDeal(sponsor, event, askAmount, stage);
        const missing = zeroMissing(options.env);
        return {
          ...saved,
          warning: saved.warning ?? `Set ${missing.join(" and ")} to connect Zero. The built-in CRM stored this deal.`,
        };
      }
      const externalId = `sponsor-engine:${randomUUID()}`;
      const amount = Number.isFinite(askAmount) ? askAmount : 0;
      try {
        const companyId = await createCompany(sponsor.trim(), externalId);
        const dealBody: Record<string, unknown> = {
          workspaceId,
          companyId,
          name: `${sponsor.trim()} — ${event.trim()}`,
          value: amount,
          source: "sponsor-engine",
          externalId,
        };
        if (stage.trim()) dealBody.stage = stage.trim();
        const created = await post("/api/deals", dealBody);
        const dealId = recordId(created);
        if (!dealId) throw new Error("Zero deal response had no id");
        const note = await post("/api/notes", {
          workspaceId,
          companyId,
          dealId,
          name: "Sponsor ask draft",
          source: "sponsor-engine",
          externalId: `${externalId}:note`,
          content: tiptap([
            DRAFT_BANNER,
            `Sponsor: ${sponsor.trim()}`,
            `Event: ${event.trim()}`,
            `Ask amount: ${amount} GBP`,
            `Stage: ${stage.trim() || "workspace default"}`,
          ]),
        });
        const record: CrmDealRecord = {
          id: dealId,
          sponsor: sponsor.trim(),
          event: event.trim(),
          askAmount: amount,
          stage: stage.trim(),
          currency: "GBP",
          companyId,
          dealId,
          noteId: recordId(note),
          draft: true,
          emailSent: false,
          createdAt: new Date().toISOString(),
        };
        return liveResult("zero", record);
      } catch (error) {
        const saved = await saveDealLocal(options, sponsor, event, askAmount, stage);
        return {
          ...saved,
          warning: `Zero did not accept the deal (${errorText(error)}). The built-in CRM stored it.`,
        };
      }
    },
  };
}
