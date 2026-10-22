import type { ResolvedOptions } from "../options.ts";
import { builtinResult } from "../result.ts";
import {
  eventTitle,
  findSponsor,
  loadBundle,
  normalName,
  type ClaimRow,
  type EventRow,
} from "../seed/load.ts";
import type { CompanySize, DevpostHackathon, LumaEventHosts, LumaHost, LumaSponsor } from "../types.ts";
import { bundledLondonEvents, indexFromEvents } from "./london.ts";
import { findSponsorsInSeed } from "./sponsors.ts";
import { companySizeNote, emptyCompany } from "./parse.ts";
import type { DataSource } from "./types.ts";

export function eventSlug(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("evt-")) return trimmed;
  try {
    if (trimmed.startsWith("http")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? trimmed;
    }
  } catch {
    return trimmed;
  }
  return trimmed.replace(/^\/+/, "");
}

function sponsorsFor(claims: ClaimRow[], eventIds: Set<string>, urls: Set<string>): LumaSponsor[] {
  const rows = claims.filter((claim) => {
    if (claim.event_id && eventIds.has(claim.event_id)) return true;
    if (claim.source_url && urls.has(claim.source_url)) return true;
    return false;
  });
  return rows.map((claim) => ({
    company: claim.company ?? "Unknown",
    role: claim.role ?? "sponsor",
    confidence: claim.confidence ?? null,
    evidence: claim.evidence_quote ?? null,
    sourceUrl: claim.source_url ?? null,
  }));
}

function hostFromSample(row: Record<string, unknown>): LumaHost | null {
  const name = typeof row.name === "string" ? row.name : "";
  if (!name) return null;
  return {
    name,
    linkedinHandle: null,
    twitterHandle: null,
    website: null,
    lumaUsername: typeof row.id === "string" ? row.id : null,
  };
}

export function lookupLuma(seedDir: string, eventUrlOrId: string): LumaEventHosts {
  const bundle = loadBundle(seedDir);
  const slug = eventSlug(eventUrlOrId);
  const urls = new Set<string>();
  const eventIds = new Set<string>();
  if (eventUrlOrId.startsWith("http")) urls.add(eventUrlOrId.split("?")[0]);

  const sample = bundle.sampleLuma.find((event) => event.id === slug || event.id === eventUrlOrId || event.url?.includes(slug));
  let name: string | null = sample?.name ?? null;
  let startAt: string | null = sample?.start_at ?? null;
  let url: string | null = sample?.url ?? (eventUrlOrId.startsWith("http") ? eventUrlOrId : null);
  const hosts = (sample?.hosts ?? [])
    .map((host) => hostFromSample(host))
    .filter((host): host is LumaHost => host !== null);

  const events = [...bundle.realEvents, ...bundle.newEvents, ...bundle.sampleEvents];
  const matched: EventRow[] = events.filter((event) => {
    const title = eventTitle(event);
    const eventUrl = event.url || event.source_url || "";
    return (
      event.event_id === slug ||
      event.event_id === eventUrlOrId ||
      eventUrl.includes(slug) ||
      normalName(title) === normalName(slug)
    );
  });
  for (const event of matched) {
    if (event.event_id) eventIds.add(event.event_id);
    if (event.url) urls.add(event.url);
    if (event.source_url) urls.add(event.source_url);
    name = name ?? eventTitle(event);
    startAt = startAt ?? event.date ?? null;
    url = url ?? event.url ?? event.source_url ?? null;
  }

  const sponsors = sponsorsFor([...bundle.realClaims, ...bundle.newClaims], eventIds, urls);
  if (sponsors.length === 0) {
    for (const event of matched) {
      if (!event.food_sponsor_id) continue;
      const sponsor = bundle.sampleSponsors.find((row) => row.sponsor_id === event.food_sponsor_id);
      if (!sponsor) continue;
      sponsors.push({
        company: sponsor.company,
        role: "food",
        confidence: "sample",
        evidence: null,
        sourceUrl: null,
      });
    }
  }

  return {
    eventId: sample?.id ?? matched[0]?.event_id ?? (slug.startsWith("evt-") ? slug : null),
    name,
    url,
    startAt,
    guestCount: null,
    calendarName: matched[0]?.community ?? null,
    hosts,
    sponsors,
  };
}

function hackathonsFromBundle(seedDir: string): DevpostHackathon[] {
  const bundle = loadBundle(seedDir);
  return [...bundle.realEvents, ...bundle.newEvents]
    .filter((event) => /hackathon/i.test(eventTitle(event)))
    .map((event) => ({
      id: event.event_id ?? null,
      title: eventTitle(event),
      url: event.url ?? event.source_url ?? null,
      location: "London",
      dates: event.date ?? null,
      status: null,
      organizationName: event.community ?? null,
      registrationsCount: null,
      prizeAmount: null,
      themes: [],
    }));
}

export function createBundledData(options: ResolvedOptions): DataSource {
  return {
    id: "bundled-data",
    label: "Bundled data",
    slot: "data",
    implemented: true,
    requiredEnv: [],
    isAvailable: () => true,
    missingEnv: () => [],
    async lumaEventHosts(eventUrlOrId) {
      const data = lookupLuma(options.seedDir, eventUrlOrId);
      const warning =
        data.hosts.length === 0 && data.sponsors.length === 0
          ? "The bundle has no hosts or sponsors for this event."
          : undefined;
      return builtinResult("bundled-data", data, warning);
    },
    async devpostLondonHackathons() {
      const data = hackathonsFromBundle(options.seedDir);
      return builtinResult(
        "bundled-data",
        data,
        data.length === 0 ? "The bundle has no hackathon rows." : undefined,
      );
    },
    async companySize(name) {
      const sponsor = findSponsor(loadBundle(options.seedDir), name);
      if (!sponsor) {
        const data = emptyCompany(name, "bundled-data", "No company match in the bundle.");
        return builtinResult("bundled-data", data, data.sizeNote);
      }
      const londonEvents = sponsor.london_events ?? sponsor.london_events_found;
      const data: CompanySize = {
        query: name,
        matchedName: sponsor.company,
        companyNumber: null,
        status: null,
        incorporatedOn: null,
        sicCodes: [],
        address: null,
        sizeNote: companySizeNote({
          category: sponsor.category,
          londonEvents,
        }),
        sourceUrl: null,
        via: "bundled-data",
      };
      return builtinResult("bundled-data", data);
    },
    async londonEventsIndex() {
      const events = bundledLondonEvents(options.seedDir);
      return builtinResult("bundled-data", {
        ...indexFromEvents(events),
        sources: [{ id: "bundled-data", mode: "builtin" as const, events }],
      });
    },
    async findSponsors(query) {
      const data = findSponsorsInSeed(options.seedDir, query);
      const warning = data.sponsors.length === 0 ? "No similar events have sponsor claims." : undefined;
      return builtinResult("bundled-data", data, warning);
    },
  };
}
