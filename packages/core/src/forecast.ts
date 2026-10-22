import type { Db } from "@sponsor-engine/db";
import type { BookingRow, RequesterKind } from "./types.js";
import { median, normalName, percent } from "./util.js";
import { recordRun } from "./runs.js";

export const FREE_EVENT_NO_SHOW = 0.28;
export const FREE_EVENT_SHOW_UP = 1 - FREE_EVENT_NO_SHOW;

export type Forecast = {
  headcount: number;
  expected_heads: number;
  show_up_rate: number;
  no_show_rate: number;
  source: "history" | "benchmark";
  history_events: number;
  community_name: string | null;
  benchmark: {
    no_show_rate: number;
    show_up_rate: number;
    note: string;
  };
  summary: string;
};

export function forecastTurnout(
  db: Db,
  input: {
    headcount: number;
    requester_kind?: RequesterKind | null;
    community_id?: string | null;
    community_name?: string | null;
    request_id?: string | null;
    log?: boolean;
  },
): Forecast {
  const kind = input.requester_kind ?? "community";
  const community = resolveCommunity(db, input.community_id, input.community_name);
  const history = community
    ? db.all<BookingRow>(
        "SELECT * FROM bookings WHERE community_id = ? AND show_up_rate IS NOT NULL AND show_up_rate > 0",
        [community.id],
      )
    : [];
  const kindHistory = db.all<BookingRow>(
    "SELECT * FROM bookings WHERE requester_kind = ? AND show_up_rate IS NOT NULL AND show_up_rate > 0",
    [kind === "company" ? "company" : "community"],
  );

  let show = kind === "company" ? 0.88 : FREE_EVENT_SHOW_UP;
  let source: Forecast["source"] = "benchmark";
  let used = 0;
  let summaryLead = "";
  if (history.length >= 3) {
    show = median(history.map((row) => row.show_up_rate || 0)) ?? show;
    source = "history";
    used = history.length;
    summaryLead = `${community?.name ?? "This requester"} has ${used} past events here.`;
  } else if (kindHistory.length >= 3) {
    show = median(kindHistory.map((row) => row.show_up_rate || 0)) ?? show;
    source = "history";
    used = kindHistory.length;
    summaryLead = community
      ? `${community.name} has fewer than three past events here. The venue's other ${kind} bookings (${used}) are the guide.`
      : `The venue has ${used} past ${kind} bookings.`;
  }

  const expected = Math.max(1, Math.round(input.headcount * show));
  const benchmarkNote = "Free events with no history use a 28% no-show. Show-up is 72%.";
  const summary = source === "history"
    ? `${summaryLead} The typical show-up is ${percent(show)}. We expect ${expected} of ${input.headcount} people. The free-event benchmark is a 28% no-show. We use the history because there are at least three events.`
    : `There are fewer than three past events for this requester. We use the free-event benchmark: a 28% no-show, so ${percent(show)} show-up. We expect ${expected} of ${input.headcount} people.`;

  const forecast: Forecast = {
    headcount: input.headcount,
    expected_heads: expected,
    show_up_rate: round3(show),
    no_show_rate: round3(1 - show),
    source,
    history_events: used,
    community_name: community?.name ?? input.community_name ?? null,
    benchmark: {
      no_show_rate: FREE_EVENT_NO_SHOW,
      show_up_rate: FREE_EVENT_SHOW_UP,
      note: benchmarkNote,
    },
    summary,
  };

  if (input.log !== false) {
    recordRun(db, {
      tool: "forecast_turnout",
      inputSummary: `${input.headcount} people · ${kind}`,
      outputSummary: forecast.summary,
      requestId: input.request_id,
    });
  }
  return forecast;
}

export function resolveCommunity(db: Db, id?: string | null, name?: string | null): { id: string; name: string; focus: string | null } | null {
  if (id) {
    const byId = db.get<{ id: string; name: string; focus: string | null }>(
      "SELECT id, name, focus FROM communities WHERE id = ?",
      [id],
    );
    if (byId) return byId;
  }
  if (!name?.trim()) return null;
  const target = normalName(name);
  const rows = db.all<{ id: string; name: string; focus: string | null }>("SELECT id, name, focus FROM communities");
  return (
    rows.find((row) => normalName(row.name) === target) ??
    rows.find((row) => {
      const value = normalName(row.name);
      return value.includes(target) || target.includes(value);
    }) ??
    null
  );
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
