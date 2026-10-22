import type { ResolvedOptions } from "../options.ts";
import { builtinResult, liveResult } from "../result.ts";
import type { ProviderResult } from "../types.ts";
import { fetchBuilderBase } from "./builderbase.ts";
import { fetchMlhLeads } from "./mlh.ts";
import { bundledLondonEvents, type LondonEvent } from "./london.ts";

export interface OrganiserLead {
  id: string;
  source: "builderbase" | "mlh" | "bundled";
  organisation: string;
  eventName: string;
  url: string | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  size: number | null;
  themes: string[];
  london: boolean;
  format: string | null;
}

export interface OrganiserSource {
  id: string;
  mode: "live" | "builtin";
  count: number;
  warning?: string;
}

export interface OrganiserLeadsData {
  leads: OrganiserLead[];
  sources: OrganiserSource[];
}

export function bundledOrganiserLeads(seedDir: string): OrganiserLead[] {
  return bundledLondonEvents(seedDir)
    .filter((event) => event.kind === "hackathon")
    .map((event) => ({
      id: event.id,
      source: "bundled" as const,
      organisation: event.calendarName ?? event.hostNames[0] ?? event.name,
      eventName: event.name,
      url: event.url,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.address,
      lat: event.lat,
      lng: event.lng,
      size: event.size,
      themes: event.themes,
      london: true,
      format: null,
    }));
}

export async function buildOrganiserLeads(options: ResolvedOptions): Promise<ProviderResult<OrganiserLeadsData>> {
  const bundled = bundledOrganiserLeads(options.seedDir);
  if (options.offline) {
    return builtinResult("bundled-data", { leads: bundled, sources: [{ id: "bundled-data", mode: "builtin", count: bundled.length }] });
  }
  const sources: OrganiserSource[] = [];
  const leads: OrganiserLead[] = [];
  await take("builderbase", "BuilderBase", () => fetchBuilderBase(options), sources, leads);
  await take("mlh", "MLH", () => fetchMlhLeads(options), sources, leads);
  if (leads.length === 0) {
    const warning = sources.map((source) => source.warning).filter(Boolean).join(" ") || "No organiser rows.";
    return builtinResult("bundled-data", {
      leads: bundled,
      sources: [...sources, { id: "bundled-data", mode: "builtin", count: bundled.length }],
    }, warning);
  }
  const warning = sources.map((source) => source.warning).filter(Boolean).join(" ") || undefined;
  return liveResult("organiser-leads", { leads, sources }, { warning });
}

export async function fetchBuilderBaseEvents(options: ResolvedOptions): Promise<LondonEvent[]> {
  const leads = await fetchBuilderBase(options);
  return leads.filter((lead) => lead.london).map(leadToEvent);
}

export function leadToEvent(lead: OrganiserLead): LondonEvent {
  return {
    id: `${lead.source}:${lead.id}`,
    source: lead.source === "mlh" ? "mlh" : "builderbase",
    name: lead.eventName,
    startAt: lead.startAt,
    endAt: lead.endAt,
    url: lead.url,
    venue: lead.location,
    address: lead.location,
    lat: lead.lat,
    lng: lead.lng,
    size: lead.size,
    calendarId: null,
    calendarName: lead.organisation,
    hostNames: [lead.organisation],
    themes: lead.themes,
    kind: "hackathon",
  };
}

async function take(
  id: string,
  label: string,
  load: () => Promise<OrganiserLead[]>,
  sources: OrganiserSource[],
  leads: OrganiserLead[],
): Promise<void> {
  try {
    const rows = await load();
    sources.push({ id, mode: "live", count: rows.length });
    leads.push(...rows);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "request failed";
    sources.push({ id, mode: "builtin", count: 0, warning: `${label} did not respond (${message}).` });
  }
}
