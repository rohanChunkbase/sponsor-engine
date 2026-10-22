import type { Db } from "@sponsor-engine/db";
import {
  MARKET_EVENING_HIGH_GBP,
  MARKET_EVENING_LOW_GBP,
  MARKET_EVENING_MEDIAN_GBP,
  quotePrice,
  type MarketCheckResult,
  type QuoteRequest,
} from "@sponsor-engine/pricing";
import { forecastTurnout, resolveCommunity } from "./forecast.js";
import { recordRun } from "./runs.js";
import type { RequesterKind } from "./types.js";
import { gbp, gbpExact, makeId, nowIso, parseJson } from "./util.js";
import { historySource, loadActiveHistory } from "./venue-history.js";

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
  /** Hours parsed from the message. The room figure covers this whole span. */
  hours: number;
  /** Room plus food. The room figure is not a price per hour. */
  day_total_gbp: number;
  /** Nearest published London rooms, about 4 evening hours. */
  market_low_gbp: number;
  market_high_gbp: number;
  /** Median of the published London ~4h evening set, after outliers. */
  market_median_gbp: number;
  market_band_low_gbp: number;
  market_band_high_gbp: number;
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
        raw_message: string | null;
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
    rawMessage: request?.raw_message ?? null,
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
  const roomGbp = Math.round(room.price);
  const lines: QuoteLines = {
    room_gbp: roomGbp,
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
    hours: shaped.hours,
    day_total_gbp: roomGbp + food,
    market_low_gbp: room.market.low,
    market_high_gbp: room.market.high,
    market_median_gbp: MARKET_EVENING_MEDIAN_GBP,
    market_band_low_gbp: MARKET_EVENING_LOW_GBP,
    market_band_high_gbp: MARKET_EVENING_HIGH_GBP,
  };
  const comparables = room.comparables.map(toComparable);
  const sampleNote = historySource().source === "sample"
    ? "The room price uses SAMPLE venue history. Those bookings are fictional. They are not this venue's prices."
    : "";
  const explanation = [room.explanation, deskParagraph(bookerType, lines, forecast.summary, !confirmed, room.market), sampleNote].filter(Boolean).join("\n\n");
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
    rawMessage?: string | null;
  },
): QuoteRequest {
  const date = quoteDate(input.date);
  const evening = input.needs.includes("evening");
  return {
    date,
    isEvening: evening,
    isWeekend: isWeekendDate(date),
    hours: hoursFromMessage(input.rawMessage ?? null, evening),
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

function hoursFromMessage(text: string | null, evening: boolean): number {
  const fallback = evening ? 4 : 8;
  if (!text) return fallback;
  const match = text.match(/\b(\d{1,2}):(\d{2})\s*(?:-|–|—|to)+\s*(\d{1,2}):(\d{2})\b/i);
  if (!match) return fallback;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (start > 24 * 60 || end > 24 * 60) return fallback;
  const minutes = end >= start ? end - start : end + 24 * 60 - start;
  const hours = minutes / 60;
  if (hours <= 0 || hours > 18) return fallback;
  return Math.round(hours * 2) / 2;
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

function deskParagraph(
  kind: "community" | "company",
  lines: QuoteLines,
  forecastSummary: string,
  unconfirmed: boolean,
  market: MarketCheckResult,
): string {
  const room = kind === "community" && lines.room_gbp === 0
    ? `The room is ${gbp(0)}. This is a free community slot. Similar community evenings were free, and communities bring leads.`
    : `The room is ${gbp(lines.room_gbp)} for the whole ${lines.hours}-hour booking. That figure is not a price per hour. The room range is ${gbp(lines.range.low)} to ${gbp(lines.range.high)}.`;
  const day = `The full day is ${gbp(lines.day_total_gbp)}. That is the room plus food.`;
  const marketLine = `Published London rooms of a similar size run ${gbp(market.low)} to ${gbp(market.high)} for about 4 evening hours. The evening median across the published set is ${gbp(lines.market_median_gbp)}, and the band is ${gbp(lines.market_band_low_gbp)} to ${gbp(lines.market_band_high_gbp)}.`;
  const food = `Food and drinks are passed through at ${gbpExact(FOOD_PER_HEAD_GBP)} for each person we expect. ${forecastSummary} The food cost is ${gbp(lines.food_gbp)}. The sponsor ask covers that food cost. The ask is ${gbp(lines.sponsor_ask_gbp)}.`;
  const contrast = kind === "community"
    ? `A company pays ${gbp(lines.company_room_gbp)} for the same room. The company range is ${gbp(lines.company_range.low)} to ${gbp(lines.company_range.high)}.`
    : `A community that brings leads pays ${gbp(lines.community_room_gbp)} for the same room. The community range is ${gbp(lines.community_range.low)} to ${gbp(lines.community_range.high)}.`;
  const note = unconfirmed
    ? " The booker type is not confirmed. This quote uses the company rate. A free community slot was not applied."
    : "";
  return `${room} ${day} ${marketLine} ${food} ${contrast}${note}`;
}
