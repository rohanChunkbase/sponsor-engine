import path from "node:path";
import { BROWSER_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import type { LondonEvent } from "./london.ts";

const SEARCH =
  "https://www.meetup.com/find/?location=gb--17--London&source=EVENTS&keywords=tech";

export function parseMeetupPage(html: string): LondonEvent[] {
  const raw = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return [];
  let payload: unknown;
  try {
    payload = parseJson(raw);
  } catch {
    return [];
  }
  const root = payload && typeof payload === "object" ? (payload as { props?: { pageProps?: { __APOLLO_STATE__?: unknown } } }) : {};
  const state = root.props?.pageProps?.__APOLLO_STATE__;
  if (!state || typeof state !== "object") return [];
  const graph = state as Record<string, unknown>;
  const events: LondonEvent[] = [];
  for (const [key, value] of Object.entries(graph)) {
    if (!key.startsWith("Event:") || !value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const name = text(row.title);
    if (!name) continue;
    const group = objectOf(resolveRef(graph, row.group));
    const rsvps = objectOf(resolveRef(graph, row.rsvps));
    events.push({
      id: key,
      source: "meetup",
      name,
      startAt: text(row.dateTime),
      endAt: null,
      url: text(row.eventUrl),
      venue: text(group?.name),
      address: text(row.eventType),
      lat: null,
      lng: null,
      size: num(rsvps?.totalCount),
      calendarId: text(group?.id) ?? refId(row.group),
      calendarName: text(group?.name),
      hostNames: text(group?.name) ? [text(group?.name) as string] : [],
      themes: [],
      kind: /hackathon/i.test(name) ? "hackathon" : "event",
    });
  }
  return events;
}

export async function fetchMeetupEvents(options: ResolvedOptions): Promise<LondonEvent[]> {
  const response = await requestText({
    url: SEARCH,
    headers: { Accept: "text/html", "User-Agent": BROWSER_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "meetup",
    minIntervalMs: politeInterval(options.fetchImpl, 2000),
    cacheDir: path.join(options.dataDir, "cache", "meetup"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Meetup HTTP ${response.status}`);
  }
  return parseMeetupPage(response.text);
}

function resolveRef(graph: Record<string, unknown>, value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const ref = (value as { __ref?: unknown }).__ref;
  if (typeof ref === "string" && ref in graph) return graph[ref];
  return value;
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function refId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const ref = (value as { __ref?: unknown }).__ref;
  return typeof ref === "string" ? ref : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
