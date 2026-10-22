import type { Db } from "@sponsor-engine/db";
import { quotePrice, type QuoteRequest } from "@sponsor-engine/pricing";
import { forecastTurnout, resolveCommunity } from "./forecast.js";
import { recordRun } from "./runs.js";
import type { RequesterKind } from "./types.js";
import { gbp, gbpExact, makeId, nowIso, parseJson } from "./util.js";
import { loadActiveHistory } from "./venue-history.js";

export const FOOD_PER_HEAD_GBP = 5.5;

export type PriceBand = { low: number; high: number };

export type QuoteLines = {
  room_gbp: number;
  food_gbp: number;
  expected_heads: number;
  show_up_rate: number;
  food_per_head: number;
  sponsor_ask_gbp: number;
  range: PriceBand;
  community_room_gbp: number;
  community_range: PriceBand;
  company_room_gbp: number;
  company_range: PriceBand;
};

export type RoomComparable = {
  bookingId: string;
  date: string;
  bookerType: string;
  headcount: number;
  hours: number;
  pricePaidGbp: number;
  freeCommunitySlot: boolean;
  isEvening: boolean;
  isWeekend: boolean;
};

export function foodPassThrough(expectedHeads: number): number {
  return Math.round(expectedHeads * FOOD_PER_HEAD_GBP);
}

export async function quoteBooking(
  db: Db,
  input: {
    request_id?: string | null;
    requester_kind?: string | null;
    headcount?: number | null;
    date?: string | null;
    community_name?: string | null;
    needs?: string[] | null;
  },
) {
  const request = input.request_id
    ? db.get<{
        id: string;
        requester_kind: RequesterKind | null;
        headcount: number | null;
        event_date: string | null;
        organisation: string | null;
        needs_json: string | null;
      }>("SELECT * FROM requests WHERE id = ?", [input.request_id])
    : undefined;
  const rawKind = String(input.requester_kind ?? request?.requester_kind ?? "unknown");
  const confirmed = rawKind === "community" || rawKind === "company";
  const bookerType = rawKind === "community" ? "community" : "company";
  const headcount = input.headcount ?? request?.headcount ?? null;
  if (!headcount || headcount < 1) throw new Error("A quote needs a headcount.");
  const needs = input.needs ?? parseJson<string[]>(request?.needs_json, []);
  const communityName = input.community_name ?? request?.organisation ?? null;
  const history = loadActiveHistory(db);
  const shaped = toQuoteRequest(db, {
    date: input.date ?? request?.event_date ?? null,
    headcount,
    bookerType,
    communityName,
    needs,
  });
  const room = quotePrice(shaped, history);
  const communityRequest = bookerType === "community" ? shaped : communityTwin(shaped);
  const companyRequest = bookerType === "company" ? shaped : companyTwin(shaped);
  const community = bookerType === "community" ? room : quotePrice(communityRequest, history);
  const company = bookerType === "company" ? room : quotePrice(companyRequest, history);
  const forecast = forecastTurnout(db, {
    headcount,
    requester_kind: bookerType,
    community_name: communityName,
    request_id: input.request_id,
    log: false,
  });
  const food = foodPassThrough(forecast.expected_heads);
  const lines: QuoteLines = {
    room_gbp: Math.round(room.price),
    food_gbp: food,
    expected_heads: forecast.expected_heads,
    show_up_rate: forecast.show_up_rate,
    food_per_head: FOOD_PER_HEAD_GBP,
    sponsor_ask_gbp: food,
    range: room.range,
    community_room_gbp: Math.round(community.price),
    community_range: community.range,
    company_room_gbp: Math.round(company.price),
    company_range: company.range,
  };
  const comparables = room.comparables.map(toComparable);
  const explanation = `${room.explanation}\n\n${deskParagraph(bookerType, lines, forecast.summary, !confirmed)}`;
  const id = makeId("quo");
  db.run(
    `INSERT INTO quotes
      (id, request_id, price, currency, explanation, comparables_json, requester_kind, lines_json, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.request_id ?? null,
      lines.room_gbp,
      room.currency,
      explanation,
      JSON.stringify(comparables),
      confirmed ? bookerType : "unknown",
      JSON.stringify(lines),
      "pricing-module",
      nowIso(),
    ],
  );
  recordRun(db, {
    tool: "quote_booking",
    inputSummary: `${confirmed ? bookerType : "unknown"} · ${headcount} people`,
    outputSummary: `${gbp(lines.room_gbp)} room · ${gbp(food)} food`,
    requestId: input.request_id,
  });
  return {
    id,
    price: lines.room_gbp,
    currency: room.currency,
    range: room.range,
    explanation,
    comparables,
    lines,
    source: "pricing-module" as const,
    requester_kind: confirmed ? bookerType : "unknown",
  };
}

function toQuoteRequest(
  db: Db,
  input: {
    date: string | null;
    headcount: number;
    bookerType: "community" | "company";
    communityName: string | null;
    needs: string[];
  },
): QuoteRequest {
  const date = quoteDate(input.date);
  const evening = input.needs.includes("evening");
  return {
    date,
    isEvening: evening,
    isWeekend: isWeekendDate(date),
    hours: evening ? 4 : 8,
    headcount: Math.round(input.headcount),
    bookerType: input.bookerType,
    repeatBookerCount: repeatCount(db, input.communityName, input.bookerType),
    broughtLeads: input.bookerType === "community",
    avNeeds: input.needs.includes("projector"),
    cateringNeeds: false,
  };
}

function communityTwin(request: QuoteRequest): QuoteRequest {
  return { ...request, bookerType: "community", broughtLeads: true };
}

function companyTwin(request: QuoteRequest): QuoteRequest {
  return { ...request, bookerType: "company", broughtLeads: false, repeatBookerCount: 0 };
}

function repeatCount(db: Db, name: string | null, kind: "community" | "company"): number {
  if (kind !== "community" || !name) return 0;
  const community = resolveCommunity(db, null, name);
  if (!community) return 0;
  const row = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM bookings WHERE community_id = ?", [community.id]);
  return Number(row?.n ?? 0);
}

function quoteDate(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function isWeekendDate(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function toComparable(row: {
  bookingId: string;
  date: string;
  bookerType: string;
  headcount: number;
  hours: number;
  pricePaidGbp: number;
  freeCommunitySlot: boolean;
  isEvening: boolean;
  isWeekend: boolean;
}): RoomComparable {
  return {
    bookingId: row.bookingId,
    date: row.date,
    bookerType: row.bookerType,
    headcount: row.headcount,
    hours: row.hours,
    pricePaidGbp: row.pricePaidGbp,
    freeCommunitySlot: row.freeCommunitySlot,
    isEvening: row.isEvening,
    isWeekend: row.isWeekend,
  };
}

function deskParagraph(kind: "community" | "company", lines: QuoteLines, forecastSummary: string, unconfirmed: boolean): string {
  const room = kind === "community" && lines.room_gbp === 0
    ? `The room is ${gbp(0)}. This is a free community slot. Similar community evenings were free, and communities bring leads.`
    : `The room is ${gbp(lines.room_gbp)}. The room range is ${gbp(lines.range.low)} to ${gbp(lines.range.high)}.`;
  const food = `Food and drinks are passed through at ${gbpExact(FOOD_PER_HEAD_GBP)} for each person we expect. ${forecastSummary} The food cost is ${gbp(lines.food_gbp)}. The sponsor ask covers that food cost. The ask is ${gbp(lines.sponsor_ask_gbp)}.`;
  const contrast = kind === "community"
    ? `A company pays ${gbp(lines.company_room_gbp)} for the same room. The company range is ${gbp(lines.company_range.low)} to ${gbp(lines.company_range.high)}.`
    : `A community that brings leads pays ${gbp(lines.community_room_gbp)} for the same room. The community range is ${gbp(lines.community_range.low)} to ${gbp(lines.community_range.high)}.`;
  const note = unconfirmed
    ? " The booker type is not confirmed. This quote uses the company rate. A free community slot was not applied."
    : "";
  return `${room} ${food} ${contrast}${note}`;
}
