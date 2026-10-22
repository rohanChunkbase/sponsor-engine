import type { Db } from "@sponsor-engine/db";
import { forecastTurnout } from "./forecast.js";
import { sendWithApproval } from "./outbox.js";
import { recordRun } from "./runs.js";
import { findSponsors } from "./sponsors.js";
import type { SponsorMatch } from "./types.js";
import { gbp, parseJson, percent } from "./util.js";

const FOOD_PER_HEAD = 5.5;

export async function draftSponsorAsk(
  db: Db,
  input: {
    request_id?: string | null;
    sponsor_id?: string | null;
    sponsor_name?: string | null;
    headcount?: number | null;
    community?: string | null;
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
  const kind = request?.requester_kind === "company" ? "company" : "community";
  const forecast = forecastTurnout(db, {
    headcount,
    requester_kind: kind,
    community_name: community,
    request_id: input.request_id,
    log: false,
  });
  const ask = Math.round(forecast.expected_heads * FOOD_PER_HEAD);
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
  const recipient = inferRecipient(sponsor.website);
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
    `We are asking for ${gbp(ask)} for food. That is £5.50 for each person we expect in the room. Past community evenings spent about £5.50 to £6 per person on food.`,
    "",
    `This note is waiting for a person at ${venue}. Sponsor Engine will not send it until they press Approve. The address ${recipient} is taken from the public website. It is not a checked inbox.`,
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
    per_head_gbp: FOOD_PER_HEAD,
    expected_heads: forecast.expected_heads,
    show_up_rate: forecast.show_up_rate,
    sponsor,
    outbox: sent.item,
    sent: false as const,
  };
}

function pickSponsor(matches: SponsorMatch[], id?: string | null, name?: string | null): SponsorMatch | undefined {
  if (id) return matches.find((match) => match.sponsor_id === id) ?? loadLoose(matches, id);
  if (name) return matches.find((match) => match.company.toLowerCase() === name.toLowerCase());
  return matches[0];
}

function loadLoose(matches: SponsorMatch[], id: string): SponsorMatch | undefined {
  return matches.find((match) => match.sponsor_id === id);
}

export function inferRecipient(website: string | null | undefined): string {
  const domain = (website || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
  if (!domain || domain.includes("example.")) return "partnerships@example.com";
  return `partnerships@${domain}`;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (!year || !month || !day) return iso;
  return `${day} ${names[month - 1]} ${year}`;
}
