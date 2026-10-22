import path from "node:path";
import { API_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import type { OrganiserLead } from "./organisers.ts";

const DISCOVERY =
  "https://edge.builderbase.com/super-events/public/discovery?status=active&limit=100";

export function parseBuilderBase(payload: unknown): OrganiserLead[] {
  const root = payload && typeof payload === "object" ? (payload as { data?: unknown }) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as { events?: unknown }) : root;
  const events = Array.isArray((data as { events?: unknown }).events)
    ? ((data as { events: unknown[] }).events)
    : [];
  const leads: OrganiserLead[] = [];
  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = text(row.name);
    if (!name) continue;
    const location = row.location && typeof row.location === "object" ? (row.location as Record<string, unknown>) : {};
    const organisation = row.organization && typeof row.organization === "object"
      ? (row.organization as Record<string, unknown>)
      : {};
    const city = text(location.city);
    const country = text(location.country);
    const place = [city, country].filter(Boolean).join(", ") || null;
    const themes = Array.isArray(row.theme_tags) ? row.theme_tags.filter((tag): tag is string => typeof tag === "string") : [];
    const slug = text(row.slug);
    leads.push({
      id: slug ?? name,
      source: "builderbase",
      organisation: text(organisation.name) ?? name,
      eventName: name,
      url: slug ? `https://builderbase.com/events/${slug}` : null,
      startAt: text(row.start_at),
      endAt: text(row.end_at),
      location: place,
      lat: num(location.lat),
      lng: num(location.lng),
      size: num(row.participant_count),
      themes,
      london: /london/i.test(place ?? ""),
      format: text(row.format) ?? text(row.event_type),
    });
  }
  return leads;
}

export async function fetchBuilderBase(options: ResolvedOptions): Promise<OrganiserLead[]> {
  const response = await requestText({
    url: DISCOVERY,
    headers: { Accept: "application/json", "User-Agent": API_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "builderbase",
    minIntervalMs: politeInterval(options.fetchImpl, 1500),
    cacheDir: path.join(options.dataDir, "cache", "builderbase"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`BuilderBase HTTP ${response.status}`);
  }
  return parseBuilderBase(parseJson(response.text));
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
