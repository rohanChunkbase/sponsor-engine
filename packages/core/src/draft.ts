import type { Db } from "@sponsor-engine/db";
import { forecastTurnout } from "./forecast.js";
import { sendWithApproval } from "./outbox.js";
import { FOOD_PER_HEAD_GBP, foodPassThrough, type QuoteLines } from "./quote.js";
import { recordRun } from "./runs.js";
import { findSponsors } from "./sponsors.js";
import type { SponsorMatch } from "./types.js";
import { placeholderAtTestInbox } from "./safety.js";
import { gbp, gbpExact, parseJson, percent } from "./util.js";

export async function draftSponsorAsk(
  db: Db,
  input: {
    request_id?: string | null;
    sponsor_id?: string | null;
    sponsor_name?: string | null;
    headcount?: number | null;
    community?: string | null;
    useTestInbox?: boolean;
  },
) {
  const request = input.request_id
    ? db.get<{
        id: string;
        organisation: string | null;
        requester_kind: string | null;
        event_date: string | null;
        headcount: number | null;
        needs_json: string | null;
        venue_hint: string | null;
        sender_name: string | null;
      }>("SELECT * FROM requests WHERE id = ?", [input.request_id])
    : undefined;
  const headcount = input.headcount ?? request?.headcount;
  if (!headcount) throw new Error("A sponsor ask needs a headcount.");
  const community = input.community ?? request?.organisation ?? "the community";
  const kind = request?.requester_kind === "community" ? "community" : "company";
  const forecast = forecastTurnout(db, {
    headcount,
    requester_kind: kind,
    community_name: community,
    request_id: input.request_id,
    log: false,
  });
  const stored = quoteLines(db, input.request_id);
  const ask = stored?.sponsor_ask_gbp ?? foodPassThrough(forecast.expected_heads);
  const room = stored?.room_gbp ?? null;
  const found = await findSponsors(db, {
    request_id: input.request_id,
    community,
    headcount,
    needs: parseJson<string[]>(request?.needs_json, ["food"]),
    limit: 3,
    log: false,
  });
  const sponsor = pickSponsor(found.matches, input.sponsor_id, input.sponsor_name) ?? found.matches[0];
  if (!sponsor) throw new Error("No sponsor match to write to.");
  const source = sponsor.sources[0];
  const testInbox = input.useTestInbox || /unicorn mafia/i.test(community);
  const recipient = testInbox
    ? placeholderAtTestInbox(sponsor.company)
    : inferRecipient(sponsor.website, sponsor.sources, found.live_hosts);
  const when = request?.event_date ? formatDate(request.event_date) : "the date they asked for";
  const venue = request?.venue_hint?.includes("Expedite") ? "Expedite" : "the venue";
  const subject = `Food for ${community} on ${when} — ${gbp(ask)}`;
  const body = [
    "Hello,",
    "",
    `${community} asked to book an evening for ${headcount} people on ${when}. We expect ${forecast.expected_heads} people to come (${percent(forecast.show_up_rate)}). ${forecast.source === "history" ? "That rate comes from their past events." : "A free event with no history uses a 28% no-show."}`,
    "",
    sponsor.reasons[0] || `${sponsor.company} has backed London events.`,
    source?.url ? `Source: ${source.url}` : "",
    "",
    room === 0
      ? `The room is a free community slot. The room price is ${gbp(0)}.`
      : room === null
        ? "The room price is separate from this ask."
        : `The room price is ${gbp(room)}. This ask does not include the room.`,
    `We are asking for ${gbp(ask)} for food and drinks. That is ${gbpExact(FOOD_PER_HEAD_GBP)} for each of the ${stored?.expected_heads ?? forecast.expected_heads} people we expect. The ask matches the food cost. It does not add a room fee.`,
    "",
    testInbox
      ? `This note is waiting for a person at ${venue}. Sponsor Engine will not send it until they press Approve. ${recipient} is a placeholder at the test inbox. It is not a personal contact and not a sponsor inbox. Test mode stays on.`
      : recipient
        ? `This note is waiting for a person at ${venue}. Sponsor Engine will not send it until they press Approve. The contact ${recipient} is copied from a public page. It is not a checked inbox.`
        : `This note is waiting for a person at ${venue}. Sponsor Engine will not send it until they press Approve. There is no public contact on the pages we have. Find a contact before this can be sent.`,
    "",
    "Thank you,",
    "Venue lead",
  ].filter((line) => line !== "").join("\n");

  const sent = sendWithApproval(db, {
    kind: "sponsor_email",
    recipient,
    subject,
    body,
    requestId: input.request_id,
    sponsorId: sponsor.sponsor_id,
    sponsorName: sponsor.company,
    askGbp: ask,
  });
  recordRun(db, {
    tool: "draft_sponsor_ask",
    inputSummary: `${sponsor.company} · ${gbp(ask)}`,
    outputSummary: `Email waiting for approval. ${sent.item.id}`,
    requestId: input.request_id,
  });
  return {
    ask_gbp: ask,
    per_head_gbp: FOOD_PER_HEAD_GBP,
    expected_heads: forecast.expected_heads,
    show_up_rate: forecast.show_up_rate,
    sponsor,
    outbox: sent.item,
    sent: false as const,
  };
}

function quoteLines(db: Db, requestId?: string | null): QuoteLines | null {
  if (!requestId) return null;
  const row = db.get<{ lines_json: string | null }>(
    "SELECT lines_json FROM quotes WHERE request_id = ? ORDER BY created_at DESC LIMIT 1",
    [requestId],
  );
  if (!row?.lines_json) return null;
  try {
    const lines = JSON.parse(row.lines_json) as Partial<QuoteLines>;
    if (typeof lines.sponsor_ask_gbp !== "number" || typeof lines.food_gbp !== "number") return null;
    return lines as QuoteLines;
  } catch {
    return null;
  }
}

function pickSponsor(matches: SponsorMatch[], id?: string | null, name?: string | null): SponsorMatch | undefined {
  if (id) return matches.find((match) => match.sponsor_id === id) ?? loadLoose(matches, id);
  if (name) return matches.find((match) => match.company.toLowerCase() === name.toLowerCase());
  return matches[0];
}

function loadLoose(matches: SponsorMatch[], id: string): SponsorMatch | undefined {
  return matches.find((match) => match.sponsor_id === id);
}

type ContactSource = { url?: string | null; quote?: string | null };

/**
 * A contact only when a source already published one.
 * A company website is not an address. This function never builds partnerships@domain.
 */
export function inferRecipient(
  website?: string | null,
  sources?: ContactSource[],
  hosts?: unknown,
): string {
  void website;
  const fromPages = (sources ?? []).map((source) => `${source.quote ?? ""}\n${source.url ?? ""}`).join("\n");
  const email = firstEmail(`${fromPages}\n${hostValues(hosts, "email").join("\n")}`);
  if (email) return email;
  const profile = [
    ...hostValues(hosts, "linkedin"),
    ...hostValues(hosts, "x"),
    ...hostValues(hosts, "twitter"),
    ...(sources ?? []).map((source) => source.url ?? ""),
  ].map((value) => contactLink(value)).find((value): value is string => Boolean(value));
  if (profile) return profile;
  const site = hostValues(hosts, "website").map((value) => hostSite(value)).find((value): value is string => Boolean(value));
  return site ?? "";
}

function firstEmail(text: string): string | null {
  const matches = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? [];
  return matches.find((email) => {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    return domain !== "example.com" && domain !== "example.org" && !domain.endsWith(".example");
  }) ?? null;
}

function contactLink(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.replace(/\/$/, "");
  if (host === "linkedin.com" && /^\/(in|company)\//i.test(path)) return trimmed;
  if ((host === "x.com" || host === "twitter.com") && /^\/[A-Za-z0-9_]{1,30}$/.test(path)) return trimmed;
  return null;
}

function hostSite(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes(".")) return null;
    return trimmed;
  } catch {
    return null;
  }
}

function hostValues(hosts: unknown, key: string, depth = 0): string[] {
  if (!hosts || typeof hosts !== "object" || depth > 6) return [];
  if (Array.isArray(hosts)) return hosts.flatMap((item) => hostValues(item, key, depth + 1));
  const row = hosts as Record<string, unknown>;
  const found: string[] = [];
  const raw = row[key];
  if (typeof raw === "string" && raw.trim()) found.push(raw.trim());
  for (const child of Object.values(row)) {
    if (child && typeof child === "object") found.push(...hostValues(child, key, depth + 1));
  }
  return found;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const name = names[month - 1];
  if (!year || !name || !day) return "the date they asked for";
  const utc = new Date(Date.UTC(year, month - 1, day));
  const real = utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
  if (!real) return "the date they asked for";
  return `${day} ${name} ${year}`;
}
