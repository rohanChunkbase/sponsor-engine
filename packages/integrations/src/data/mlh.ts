import path from "node:path";
import { BROWSER_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import type { LondonEvent } from "./london.ts";
import type { OrganiserLead } from "./organisers.ts";

const SEASON = "https://mlh.io/seasons/2027/events";

export function parseMlhPage(html: string): OrganiserLead[] {
  const payload = readPage(html);
  if (!payload) return [];
  const props = payload.props && typeof payload.props === "object" ? (payload.props as Record<string, unknown>) : {};
  const rows = [...asArray(props.upcomingEvents), ...asArray(props.pastEvents)];
  const leads: OrganiserLead[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = text(row.name);
    if (!name) continue;
    const location = locationText(row.location);
    leads.push({
      id: text(row.url) ?? name,
      source: "mlh",
      organisation: text(row.organizer) ?? name,
      eventName: name,
      url: text(row.url),
      startAt: text(row.startsAt),
      endAt: text(row.endsAt),
      location,
      lat: null,
      lng: null,
      size: null,
      themes: text(row.formatType) ? [text(row.formatType) as string] : [],
      london: /london/i.test(location ?? ""),
      format: text(row.formatType),
    });
  }
  return leads;
}

export async function fetchMlhLeads(options: ResolvedOptions): Promise<OrganiserLead[]> {
  const response = await requestText({
    url: SEASON,
    headers: { Accept: "text/html", "User-Agent": BROWSER_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "mlh",
    minIntervalMs: politeInterval(options.fetchImpl, 1500),
    cacheDir: path.join(options.dataDir, "cache", "mlh"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`MLH HTTP ${response.status}`);
  }
  return parseMlhPage(response.text);
}

export async function fetchMlhEvents(options: ResolvedOptions): Promise<LondonEvent[]> {
  const leads = await fetchMlhLeads(options);
  return leads.filter((lead) => lead.london).map((lead) => ({
    id: `mlh:${lead.id}`,
    source: "mlh" as const,
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
    kind: "hackathon" as const,
  }));
}

function readPage(html: string): { props?: unknown } | null {
  const body = html.match(/<script\b[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  const raw = body?.trim() || attributeJson(html);
  if (!raw) return null;
  try {
    const parsed = parseJson(decode(raw));
    return parsed && typeof parsed === "object" ? (parsed as { props?: unknown }) : null;
  } catch {
    return null;
  }
}

function attributeJson(html: string): string | null {
  const match = html.match(/\bdata-page="([^"]+)"/);
  if (!match?.[1] || !match[1].includes("{") && !match[1].includes("&quot;")) return null;
  return match[1];
}

function decode(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function locationText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const parts = [text(row.city), text(row.state), text(row.country), text(row.name)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
