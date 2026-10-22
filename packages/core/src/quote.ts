import type { Db } from "@sponsor-engine/db";
import { forecastTurnout } from "./forecast.js";
import { quoteFromPricingModule } from "./pricing.js";
import { recordRun } from "./runs.js";
import type { BookingRow, Comparable, PricingHistoryRow, PricingRequest, RequesterKind } from "./types.js";
import { gbp, gbpExact, makeId, median, nowIso, parseJson, percent } from "./util.js";

export type QuoteLines = {
  room_gbp: number;
  food_gbp: number;
  expected_heads: number;
  show_up_rate: number;
  room_per_head: number;
  food_per_head: number;
};

export async function quoteBooking(
  db: Db,
  input: {
    request_id?: string | null;
    requester_kind?: RequesterKind | null;
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
  const kind = (input.requester_kind ?? request?.requester_kind ?? "community") as RequesterKind;
  const headcount = input.headcount ?? request?.headcount ?? null;
  if (!headcount || headcount < 1) {
    throw new Error("A quote needs a headcount.");
  }
  const needs = input.needs ?? parseJson<string[]>(request?.needs_json, []);
  const communityName = input.community_name ?? request?.organisation ?? null;
  const history = db.all<BookingRow>("SELECT * FROM bookings");
  const pricingRequest: PricingRequest = {
    requester_kind: kind === "unknown" ? "community" : kind,
    headcount,
    date: input.date ?? request?.event_date ?? null,
    needs,
    community_name: communityName,
    request_id: input.request_id ?? null,
  };
  const external = await quoteFromPricingModule(pricingRequest, history.map(toHistory));
  const fallback = explainFromHistory(db, pricingRequest, history, kind === "unknown");
  const chosen = external
    ? {
        price: external.price,
        currency: external.currency || "GBP",
        explanation: external.explanation,
        comparables: external.comparables?.length ? external.comparables : fallback.comparables,
        lines: fallback.lines,
        contrast: fallback.contrast,
        source: "pricing-module" as const,
      }
    : { ...fallback, currency: "GBP", source: "fallback" as const };

  const id = makeId("quo");
  db.run(
    `INSERT INTO quotes
      (id, request_id, price, currency, explanation, comparables_json, requester_kind, lines_json, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.request_id ?? null,
      chosen.price,
      chosen.currency,
      chosen.explanation,
      JSON.stringify(chosen.comparables),
      pricingRequest.requester_kind,
      JSON.stringify({ ...chosen.lines, contrast: chosen.contrast }),
      chosen.source,
      nowIso(),
    ],
  );
  recordRun(db, {
    tool: "quote_booking",
    inputSummary: `${pricingRequest.requester_kind} · ${headcount} people`,
    outputSummary: `${gbp(chosen.price)} · ${chosen.source === "pricing-module" ? "pricing module" : "past bookings"}`,
    requestId: input.request_id,
  });
  return { id, ...chosen, requester_kind: pricingRequest.requester_kind };
}

function explainFromHistory(db: Db, request: PricingRequest, history: BookingRow[], kindWasUnknown: boolean) {
  const kind = request.requester_kind === "company" ? "company" : "community";
  const forecast = forecastTurnout(db, {
    headcount: request.headcount,
    requester_kind: kind,
    community_name: request.community_name,
    request_id: request.request_id,
    log: false,
  });
  const same = history.filter((row) => row.requester_kind === kind);
  const band = same.filter((row) => {
    const size = row.headcount || 0;
    return size >= request.headcount * 0.5 && size <= request.headcount * 2;
  });
  const pool = band.length >= 4 ? band : same;
  const roomRate = median(pool.map(roomPerHead).filter((value) => value > 0)) ?? (kind === "company" ? 18 : 2.5);
  const foodRate = median(pool.map(foodPerHead).filter((value) => value > 0)) ?? (kind === "company" ? 14 : 5.5);
  const room = Math.round(roomRate * forecast.expected_heads);
  const food = Math.round(foodRate * forecast.expected_heads);
  const price = room + food;
  const otherKind = kind === "company" ? "community" : "company";
  const otherRows = history.filter((row) => row.requester_kind === otherKind);
  const otherPer = median(otherRows.map(totalPerHead).filter((value) => value > 0));
  const thisPer = roomRate + foodRate;
  const comparables = nearest(pool, request.headcount).slice(0, 3).map(toComparable);
  const who = request.community_name || (kind === "company" ? "This company" : "This community");
  const kindLabel = kind === "company" ? "a company booking" : "a community evening";
  const lines = [
    `This quote is for ${kindLabel}. ${who} asked for ${request.headcount} people.`,
    forecast.summary,
    `Past ${kind} bookings of a similar size put the room at ${gbpExact(roomRate)} per person who comes, and food at ${gbpExact(foodRate)} per person. ${forecast.expected_heads} × ${gbpExact(roomRate)} is ${gbp(room)} for the room. ${forecast.expected_heads} × ${gbpExact(foodRate)} is ${gbp(food)} for food. The quote is ${gbp(price)}.`,
    otherPer
      ? `A ${otherKind} booking is a different rate. The typical ${otherKind} cost in this history is ${gbpExact(otherPer)} per person who comes. The same ${forecast.expected_heads} people at that rate would be about ${gbp(otherPer * forecast.expected_heads)}. Communities book often and bring the next hosts. Companies book rarely, so the room rate is higher.`
      : `The other rate is not in the history yet.`,
    comparables.length
      ? `The closest past bookings are ${comparables.map((row) => `${row.title} (${gbp(row.price)})`).join("; ")}.`
      : `There are no close past bookings yet. The figure uses the backup rate of ${gbpExact(thisPer)} per person.`,
  ];
  if (kindWasUnknown) {
    lines.push("The message does not say community or company. This quote uses the community rate. Confirm the kind before you send it.");
  }
  if (Math.abs(foodRate - 5.5) <= 1) {
    lines.push("Food sits near £5.50 per person. That is the planning figure for a community evening.");
  }
  return {
    price,
    explanation: lines.join("\n\n"),
    comparables,
    lines: {
      room_gbp: room,
      food_gbp: food,
      expected_heads: forecast.expected_heads,
      show_up_rate: forecast.show_up_rate,
      room_per_head: round2(roomRate),
      food_per_head: round2(foodRate),
    } satisfies QuoteLines,
    contrast: {
      community_per_head: kind === "community" ? round2(thisPer) : otherPer ? round2(otherPer) : null,
      company_per_head: kind === "company" ? round2(thisPer) : otherPer ? round2(otherPer) : null,
    },
  };
}

function roomPerHead(row: BookingRow): number {
  const heads = came(row);
  return (row.room_gbp || 0) / heads;
}

function foodPerHead(row: BookingRow): number {
  if (row.food_per_head_gbp && row.food_per_head_gbp > 0) return row.food_per_head_gbp;
  return (row.food_cost_gbp || 0) / came(row);
}

function totalPerHead(row: BookingRow): number {
  return row.price_gbp / came(row);
}

function came(row: BookingRow): number {
  if (row.check_ins && row.check_ins > 0) return row.check_ins;
  if (row.headcount && row.show_up_rate) return Math.max(1, Math.round(row.headcount * row.show_up_rate));
  return Math.max(1, row.headcount || 1);
}

function nearest(rows: BookingRow[], headcount: number): BookingRow[] {
  return [...rows].sort((a, b) => Math.abs((a.headcount || 0) - headcount) - Math.abs((b.headcount || 0) - headcount));
}

function toComparable(row: BookingRow): Comparable {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    headcount: row.headcount,
    check_ins: row.check_ins,
    price: row.price_gbp,
    requester_kind: row.requester_kind,
    note: `${row.headcount ?? "?"} registered, ${row.check_ins ?? "?"} came. ${gbpExact(totalPerHead(row))} per person who came. Show-up ${row.show_up_rate ? percent(row.show_up_rate) : "n/a"}.`,
  };
}

function toHistory(row: BookingRow): PricingHistoryRow {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    requester_kind: row.requester_kind,
    headcount: row.headcount,
    check_ins: row.check_ins,
    show_up_rate: row.show_up_rate,
    price_gbp: row.price_gbp,
    room_gbp: row.room_gbp,
    food_cost_gbp: row.food_cost_gbp,
    food_per_head_gbp: row.food_per_head_gbp,
    venue_area: row.venue_area,
    is_sample: row.is_sample,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
