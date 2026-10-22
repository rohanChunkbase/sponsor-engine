import path from "node:path";
import { API_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import { errorText } from "../result.ts";
import type { LondonEvent } from "./london.ts";

const DISCOVER =
  "https://api.lu.ma/discover/get-paginated-events?discover_place_api_id=discplace-QCcNk3HXowOR97j&pagination_limit=50";

export function parseLumaDiscover(payload: unknown): { events: LondonEvent[]; calendarIds: string[] } {
  const root = payload && typeof payload === "object" ? (payload as { entries?: unknown }) : {};
  const entries = Array.isArray(root.entries) ? root.entries : [];
  const events: LondonEvent[] = [];
  const calendarIds: string[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const event = row.event && typeof row.event === "object" ? (row.event as Record<string, unknown>) : {};
    const name = text(event.name);
    if (!name) continue;
    const calendar = row.calendar && typeof row.calendar === "object" ? (row.calendar as Record<string, unknown>) : {};
    const calendarId = text(calendar.api_id) ?? text(event.calendar_api_id);
    if (calendarId && !calendarIds.includes(calendarId)) calendarIds.push(calendarId);
    const geo = event.geo_address_info && typeof event.geo_address_info === "object"
      ? (event.geo_address_info as Record<string, unknown>)
      : {};
    const place = geo.place_coordinate && typeof geo.place_coordinate === "object"
      ? (geo.place_coordinate as Record<string, unknown>)
      : {};
    const coordinate = event.coordinate && typeof event.coordinate === "object"
      ? (event.coordinate as Record<string, unknown>)
      : {};
    const hosts = Array.isArray(row.hosts) ? row.hosts : [];
    events.push({
      id: text(event.api_id) ?? text(row.api_id) ?? name,
      source: "luma-discover",
      name,
      startAt: text(event.start_at) ?? text(row.start_at),
      endAt: text(event.end_at),
      url: text(event.url),
      venue: text(geo.address),
      address: text(geo.full_address) ?? text(geo.short_address),
      lat: num(coordinate.latitude) ?? num(place.latitude),
      lng: num(coordinate.longitude) ?? num(place.longitude),
      size: num(row.guest_count),
      calendarId,
      calendarName: text(calendar.name),
      hostNames: hosts.map((host) => hostName(host)).filter((name): name is string => Boolean(name)),
      themes: [],
      kind: /hackathon/i.test(name) ? "hackathon" : "event",
    });
  }
  return { events, calendarIds };
}

export function parseLumaIcs(body: string, calendarId: string): LondonEvent[] {
  const events: LondonEvent[] = [];
  for (const block of body.split("BEGIN:VEVENT").slice(1)) {
    const chunk = block.split("END:VEVENT")[0] ?? "";
    const lines = unfold(chunk);
    const summary = field(lines, "SUMMARY");
    if (!summary) continue;
    events.push({
      id: `${calendarId}:${field(lines, "UID") || summary}`,
      source: "luma-ics",
      name: summary,
      startAt: field(lines, "DTSTART"),
      endAt: field(lines, "DTEND"),
      url: field(lines, "URL"),
      venue: null,
      address: field(lines, "LOCATION"),
      lat: null,
      lng: null,
      size: null,
      calendarId,
      calendarName: null,
      hostNames: [],
      themes: [],
      kind: /hackathon/i.test(summary) ? "hackathon" : "event",
    });
  }
  return events;
}

export async function fetchLumaDiscover(options: ResolvedOptions): Promise<{
  events: LondonEvent[];
  calendarIds: string[];
  cached: boolean;
}> {
  const response = await requestText({
    url: DISCOVER,
    headers: { Accept: "application/json", "User-Agent": API_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "luma-discover",
    minIntervalMs: politeInterval(options.fetchImpl, 3000),
    cacheDir: path.join(options.dataDir, "cache", "luma-discover"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Luma discover HTTP ${response.status}`);
  }
  const parsed = parseLumaDiscover(parseJson(response.text));
  return { ...parsed, cached: response.fromCache };
}

export async function fetchLumaIcs(calendarId: string, options: ResolvedOptions): Promise<LondonEvent[]> {
  const url = `https://api.lu.ma/ics/get?entity=calendar&id=${encodeURIComponent(calendarId)}`;
  const response = await requestText({
    url,
    headers: { Accept: "text/calendar", "User-Agent": API_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "luma-ics",
    minIntervalMs: politeInterval(options.fetchImpl, 3000),
    cacheDir: path.join(options.dataDir, "cache", "luma-ics"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Luma calendar HTTP ${response.status}`);
  }
  return parseLumaIcs(response.text, calendarId);
}

export async function pullLumaLondon(options: ResolvedOptions): Promise<{
  events: LondonEvent[];
  cached: boolean;
  icsMode: "live" | "builtin";
  icsWarning?: string;
}> {
  const discover = await fetchLumaDiscover(options);
  const events = [...discover.events];
  const calendarId = discover.calendarIds[0];
  if (!calendarId) return { events, cached: discover.cached, icsMode: "builtin" };
  try {
    const extra = await fetchLumaIcs(calendarId, options);
    const calendarName = discover.events.find((row) => row.calendarId === calendarId)?.calendarName ?? null;
    for (const event of extra) event.calendarName = event.calendarName ?? calendarName;
    events.push(...extra);
  } catch (error) {
    return {
      events,
      cached: discover.cached,
      icsMode: "builtin",
      icsWarning: `Luma calendar feed did not respond (${errorText(error)}).`,
    };
  }
  return { events, cached: discover.cached, icsMode: "live" };
}

function unfold(block: string): string[] {
  const raw = block.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.trim()) {
      lines.push(line.trim());
    }
  }
  return lines;
}

function field(lines: string[], name: string): string | null {
  const prefix = `${name}`;
  const line = lines.find((item) => item.startsWith(`${prefix}:`) || item.startsWith(`${prefix};`));
  if (!line) return null;
  const value = line.slice(line.indexOf(":") + 1).trim();
  return value.replace(/\\n/g, " ").replace(/\\,/g, ",") || null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hostName(host: unknown): string | null {
  if (!host || typeof host !== "object") return null;
  const row = host as Record<string, unknown>;
  const joined = [text(row.first_name), text(row.last_name)].filter(Boolean).join(" ");
  return text(row.name) ?? (joined || null);
}
