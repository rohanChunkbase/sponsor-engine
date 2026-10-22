import path from "node:path";
import { BROWSER_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import type { LondonEvent } from "./london.ts";

const LISTING = "https://www.eventbrite.co.uk/d/united-kingdom--london/tech-events/";

export function parseEventbritePage(html: string): LondonEvent[] {
  const events: LondonEvent[] = [];
  const scripts = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const script of scripts) {
    let payload: unknown;
    try {
      payload = parseJson(script[1] ?? "");
    } catch {
      continue;
    }
    for (const node of asList(payload)) collect(node, events);
  }
  return events;
}

export async function fetchEventbriteEvents(options: ResolvedOptions): Promise<LondonEvent[]> {
  const response = await requestText({
    url: LISTING,
    headers: { Accept: "text/html", "User-Agent": BROWSER_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "eventbrite",
    minIntervalMs: politeInterval(options.fetchImpl, 2000),
    cacheDir: path.join(options.dataDir, "cache", "eventbrite"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Eventbrite HTTP ${response.status}`);
  }
  return parseEventbritePage(response.text);
}

function collect(node: unknown, events: LondonEvent[]): void {
  if (!node || typeof node !== "object") return;
  const row = node as Record<string, unknown>;
  if (hasType(row, "ItemList")) {
    const items = Array.isArray(row.itemListElement) ? row.itemListElement : [];
    for (const item of items) collect(item, events);
    return;
  }
  if (hasType(row, "ListItem")) {
    collect(row.item, events);
    return;
  }
  if (!hasType(row, "Event")) return;
  const name = text(row.name);
  if (!name) return;
  const location = row.location && typeof row.location === "object" ? (row.location as Record<string, unknown>) : {};
  const address = location.address;
  const geo = location.geo && typeof location.geo === "object" ? (location.geo as Record<string, unknown>) : {};
  events.push({
    id: text(row.url) ?? name,
    source: "eventbrite",
    name,
    startAt: text(row.startDate),
    endAt: text(row.endDate),
    url: text(row.url),
    venue: text(location.name),
    address: addressText(address),
    lat: num(geo.latitude),
    lng: num(geo.longitude),
    size: null,
    calendarId: null,
    calendarName: text(location.name),
    hostNames: [],
    themes: [],
    kind: /hackathon/i.test(name) ? "hackathon" : "event",
  });
}

function asList(payload: unknown): unknown[] {
  return Array.isArray(payload) ? payload : [payload];
}

function hasType(row: Record<string, unknown>, type: string): boolean {
  const value = row["@type"];
  if (value === type) return true;
  return Array.isArray(value) && value.includes(type);
}

function addressText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const parts = [text(row.streetAddress), text(row.addressLocality), text(row.addressRegion)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
