import type { CompanySize, DevpostHackathon, LumaEventHosts, LumaHost, SicCode } from "../types.ts";

export function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function textById(html: string, id: string): string | null {
  const match = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</`, "i"));
  if (!match) return null;
  const text = decodeHtml(match[1]);
  return text || null;
}

export function parseCompanySearchHtml(html: string): Array<{ number: string; name: string }> {
  const found: Array<{ number: string; name: string }> = [];
  const seen = new Set<string>();
  const pattern = /href="\/company\/([0-9A-Z]{6,10})"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const number = match[1];
    const name = decodeHtml(match[2]);
    if (!number || !name || seen.has(number)) continue;
    seen.add(number);
    found.push({ number, name });
  }
  return found;
}

export function parseSicList(html: string): SicCode[] {
  const codes: SicCode[] = [];
  for (const match of html.matchAll(/id="sic\d+"[^>]*>([\s\S]*?)<\/span>/gi)) {
    const text = decodeHtml(match[1]);
    if (!text) continue;
    const split = text.match(/^(\d{4,5})\s*[-–]\s*(.+)$/);
    if (split) codes.push({ code: split[1], description: split[2] });
    else codes.push({ code: text });
  }
  return codes;
}

export function parseCompanyProfileHtml(html: string): {
  name: string | null;
  status: string | null;
  incorporatedOn: string | null;
  sicCodes: SicCode[];
} {
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return {
    name: heading ? decodeHtml(heading[1]) : null,
    status: textById(html, "company-status"),
    incorporatedOn: textById(html, "company-creation-date"),
    sicCodes: parseSicList(html),
  };
}

export function parseLumaPayload(payload: unknown, input: string): LumaEventHosts {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const event = root.event && typeof root.event === "object" ? (root.event as Record<string, unknown>) : root;
  const hostRows = Array.isArray(root.hosts)
    ? root.hosts
    : Array.isArray(event.hosts)
      ? event.hosts
      : [];
  const hosts: LumaHost[] = hostRows
    .map((row) => hostFrom(row))
    .filter((host): host is LumaHost => host !== null);
  const calendar = root.calendar && typeof root.calendar === "object" ? (root.calendar as Record<string, unknown>) : {};
  const eventId = stringOf(root.api_id) ?? stringOf(event.api_id) ?? stringOf(event.id);
  return {
    eventId,
    name: stringOf(event.name) ?? stringOf(root.name),
    url: input.startsWith("http") ? input : null,
    startAt: stringOf(event.start_at) ?? stringOf(root.start_at),
    guestCount: numberOf(root.guest_count) ?? numberOf(event.guest_count),
    calendarName: stringOf(calendar.name) ?? stringOf(calendar.calendar_name) ?? stringOf(root.calendar_name),
    hosts,
    sponsors: [],
  };
}

function hostFrom(row: unknown): LumaHost | null {
  if (!row || typeof row !== "object") return null;
  const host = row as Record<string, unknown>;
  const name =
    stringOf(host.name) ??
    [stringOf(host.first_name), stringOf(host.last_name)].filter(Boolean).join(" ");
  if (!name) return null;
  return {
    name,
    linkedinHandle: stringOf(host.linkedin_handle) ?? stringOf(host.linkedin),
    twitterHandle: stringOf(host.twitter_handle) ?? stringOf(host.twitter),
    website: stringOf(host.website),
    lumaUsername: stringOf(host.username),
  };
}

export function parseDevpostPayload(payload: unknown): DevpostHackathon[] {
  const root = payload && typeof payload === "object" ? (payload as { hackathons?: unknown }) : {};
  const rows = Array.isArray(root.hackathons) ? root.hackathons : [];
  return rows
    .map((row) => hackathonFrom(row))
    .filter((row): row is DevpostHackathon => row !== null);
}

function hackathonFrom(row: unknown): DevpostHackathon | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const title = stringOf(item.title);
  if (!title) return null;
  const location = item.displayed_location;
  const themes = Array.isArray(item.themes)
    ? item.themes
        .map((theme) =>
          theme && typeof theme === "object" ? stringOf((theme as { name?: unknown }).name) : stringOf(theme),
        )
        .filter((theme): theme is string => Boolean(theme))
    : [];
  return {
    id: item.id === undefined || item.id === null ? null : String(item.id),
    title,
    url: stringOf(item.url),
    location:
      location && typeof location === "object"
        ? stringOf((location as { location?: unknown }).location)
        : stringOf(location),
    dates: stringOf(item.submission_period_dates),
    status: stringOf(item.open_state),
    organizationName: stringOf(item.organization_name),
    registrationsCount: numberOf(item.registrations_count),
    prizeAmount: stringOf(item.prize_amount) ? decodeHtml(String(item.prize_amount)) : null,
    themes,
  };
}

export function companySizeNote(input: {
  status?: string | null;
  incorporatedOn?: string | null;
  sicCount?: number;
  londonEvents?: number;
  category?: string;
}): string {
  const parts: string[] = [];
  if (input.status) parts.push(`Status ${input.status}`);
  if (input.incorporatedOn) parts.push(`incorporated ${input.incorporatedOn}`);
  if (input.sicCount) parts.push(`${input.sicCount} SIC code${input.sicCount === 1 ? "" : "s"}`);
  if (input.category) parts.push(`category ${input.category}`);
  if (input.londonEvents !== undefined) parts.push(`${input.londonEvents} London events in the bundle`);
  return parts.length ? `${parts.join(". ")}.` : "No size data.";
}

export function emptyCompany(query: string, via: CompanySize["via"], sizeNote: string): CompanySize {
  return {
    query,
    matchedName: null,
    companyNumber: null,
    status: null,
    incorporatedOn: null,
    sicCodes: [],
    address: null,
    sizeNote,
    sourceUrl: null,
    via,
  };
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
