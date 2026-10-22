import { eventTitle, loadBundle, type EventRow } from "../seed/load.ts";

export type LondonEventSource =
  | "luma-discover"
  | "luma-ics"
  | "meetup"
  | "eventbrite"
  | "builderbase"
  | "mlh"
  | "bundled";

export interface LondonEvent {
  id: string;
  source: LondonEventSource;
  name: string;
  startAt: string | null;
  endAt: string | null;
  url: string | null;
  venue: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  size: number | null;
  calendarId: string | null;
  calendarName: string | null;
  hostNames: string[];
  themes: string[];
  kind: "event" | "hackathon";
}

export interface MapVenue {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  eventCount: number;
  largestSize: number | null;
}

export interface CalendarHost {
  id: string | null;
  name: string;
  eventCount: number;
  totalGuests: number;
  events: Array<{ name: string; startAt: string | null; size: number | null; url: string | null }>;
}

export interface LondonEventsIndex {
  events: LondonEvent[];
  venues: MapVenue[];
  calendars: CalendarHost[];
}

export interface SourcePull {
  id: string;
  mode: "live" | "builtin";
  events: LondonEvent[];
  warning?: string;
}

export function bundledLondonEvents(seedDir: string): LondonEvent[] {
  const bundle = loadBundle(seedDir);
  return [...bundle.realEvents, ...bundle.newEvents, ...bundle.sampleEvents].map((event) =>
    fromBundleRow(event),
  );
}

function fromBundleRow(event: EventRow): LondonEvent {
  const name = eventTitle(event);
  return {
    id: event.event_id || name,
    source: "bundled",
    name,
    startAt: event.date ?? null,
    endAt: null,
    url: event.url ?? event.source_url ?? null,
    venue: event.venue ?? null,
    address: event.venue ?? null,
    lat: typeof event.lat === "number" ? event.lat : null,
    lng: typeof event.lon === "number" ? event.lon : null,
    size: typeof event.approx_size === "number" ? event.approx_size : null,
    calendarId: null,
    calendarName: event.community ?? null,
    hostNames: event.community ? [event.community] : [],
    themes: [],
    kind: /hackathon/i.test(name) ? "hackathon" : "event",
  };
}

export function dedupeEvents(events: LondonEvent[]): LondonEvent[] {
  const seen = new Set<string>();
  const out: LondonEvent[] = [];
  for (const event of events) {
    const key = (event.url || `${event.name}|${event.startAt || ""}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

export function indexFromEvents(events: LondonEvent[]): LondonEventsIndex {
  const unique = dedupeEvents(events);
  const venues = new Map<string, MapVenue>();
  for (const event of unique) {
    if (event.lat === null || event.lng === null) continue;
    const name = event.venue || event.address || event.calendarName || event.name;
    const key = `${name}|${event.lat.toFixed(3)}|${event.lng.toFixed(3)}`;
    const current = venues.get(key) ?? {
      name,
      lat: event.lat,
      lng: event.lng,
      address: event.address,
      eventCount: 0,
      largestSize: null,
    };
    current.eventCount += 1;
    if (event.size !== null && (current.largestSize === null || event.size > current.largestSize)) {
      current.largestSize = event.size;
    }
    venues.set(key, current);
  }
  const calendars = new Map<string, CalendarHost>();
  for (const event of unique) {
    const name = event.calendarName || event.hostNames[0];
    if (!name) continue;
    const key = event.calendarId || name.toLowerCase();
    const current = calendars.get(key) ?? {
      id: event.calendarId,
      name,
      eventCount: 0,
      totalGuests: 0,
      events: [],
    };
    current.eventCount += 1;
    current.totalGuests += event.size ?? 0;
    current.events.push({
      name: event.name,
      startAt: event.startAt,
      size: event.size,
      url: event.url,
    });
    calendars.set(key, current);
  }
  return { events: unique, venues: [...venues.values()], calendars: [...calendars.values()] };
}
