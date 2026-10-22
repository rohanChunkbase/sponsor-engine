import type { CompanySize, DevpostHackathon, LumaAggregates, LumaEventHosts, LumaHost, SicCode } from "../types.ts";

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

/**
 * Registered, checked-in, and show-up from a Luma payload.
 * Guest rows are counted in memory when a published total is missing, then dropped.
 * Names, emails, phones, and ticket answers are not returned.
 */
export function lumaAggregatesFromPayload(payload: unknown): LumaAggregates {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const event = root.event && typeof root.event === "object" ? (root.event as Record<string, unknown>) : root;
  const counts = recordOf(root.guest_counts) ?? recordOf(event.guest_counts);
  let registered =
    numberOf(root.guest_count) ??
    numberOf(event.guest_count) ??
    numberOf(root.registered_count) ??
    numberOf(event.registered_count) ??
    countBucket(counts, "approved") ??
    numberOf(root.num_guests) ??
    numberOf(event.num_guests);
  let checkedIn =
    numberOf(root.checked_in_count) ??
    numberOf(event.checked_in_count) ??
    numberOf(root.checked_in_guests) ??
    numberOf(event.checked_in_guests) ??
    countBucket(counts, "checked_in") ??
    numberOf(root.check_in_count) ??
    numberOf(event.check_in_count);

  if (registered == null || checkedIn == null) {
    const rows = guestRows(root) ?? guestRows(event);
    if (rows) {
      if (registered == null) registered = rows.length;
      if (checkedIn == null) checkedIn = rows.reduce<number>((total, row) => total + (isCheckedIn(row) ? 1 : 0), 0);
    }
  }

  const showUp =
    rateOf(root.show_up_rate) ??
    rateOf(event.show_up_rate) ??
    rateOf(root.showUpRate) ??
    (registered != null && registered > 0 && checkedIn != null
      ? Math.round((checkedIn / registered) * 1000) / 1000
      : null);
  return { registered, checkedIn, showUpRate: showUp };
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
  const aggregates = lumaAggregatesFromPayload(payload);
  return {
    eventId,
    name: stringOf(event.name) ?? stringOf(root.name),
    url: input.startsWith("http") ? input : null,
    startAt: stringOf(event.start_at) ?? stringOf(root.start_at),
    guestCount: aggregates.registered,
    registered: aggregates.registered,
    checkedIn: aggregates.checkedIn,
    showUpRate: aggregates.showUpRate,
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

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function countBucket(counts: Record<string, unknown> | null, key: string): number | null {
  if (!counts) return null;
  const bucket = counts[key];
  if (typeof bucket === "number" && Number.isFinite(bucket)) return bucket;
  const row = recordOf(bucket);
  return row ? numberOf(row.guests) : null;
}

function guestRows(record: Record<string, unknown>): unknown[] | null {
  for (const key of ["guests", "entries", "guest_list"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return null;
}

function isCheckedIn(row: unknown): boolean {
  const item = recordOf(row);
  if (!item) return false;
  if (typeof item.checked_in_at === "string" && item.checked_in_at.trim() !== "") return true;
  if (item.checked_in === true) return true;
  const tickets = Array.isArray(item.event_tickets) ? item.event_tickets : [];
  return tickets.some((ticket) => {
    const row = recordOf(ticket);
    return Boolean(row && typeof row.checked_in_at === "string" && row.checked_in_at.trim() !== "");
  });
}

function rateOf(value: unknown): number | null {
  const number = numberOf(value);
  if (number == null || number < 0) return null;
  if (number > 1 && number <= 100) return Math.round((number / 100) * 1000) / 1000;
  if (number > 1) return null;
  return number;
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
