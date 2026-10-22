import type { Db } from "@sponsor-engine/db";
import { resolveCommunity } from "./forecast.js";
import { percent } from "./util.js";

/** Aggregate Luma numbers. Names, emails, and ticket scans are not stored here. */
export type LumaCounts = {
  registered: number | null;
  checked_in: number | null;
  show_up_rate: number | null;
  events: number;
  source: "luma-aggregates";
  note: string;
};

type CountRow = {
  registrations: number | null;
  check_ins: number | null;
  show_up_rate: number | null;
};

const NOTE = "Luma keeps the ticket scan. These are counts only. No guest names are stored.";

/**
 * Registered, checked-in, and show-up for a community.
 * Reads numeric columns already on events. Does not read a guest list.
 */
export function communityLumaAggregates(db: Db, name: string | null | undefined): LumaCounts | null {
  const label = name?.trim();
  if (!label) return null;
  const community = resolveCommunity(db, null, label);
  const rows = community
    ? db.all<CountRow>(
        `SELECT registrations, check_ins, show_up_rate
         FROM events
         WHERE community_id = ? OR community_name = ?`,
        [community.id, community.name],
      )
    : db.all<CountRow>(
        `SELECT registrations, check_ins, show_up_rate
         FROM events
         WHERE community_name = ?`,
        [label],
      );

  let pairedRegistered = 0;
  let pairedChecked = 0;
  let paired = 0;
  let registeredOnly = 0;
  let registeredOnlyEvents = 0;
  for (const row of rows) {
    const registered = row.registrations;
    const checked = row.check_ins;
    if (registered != null && checked != null) {
      pairedRegistered += registered;
      pairedChecked += checked;
      paired += 1;
    } else if (registered != null) {
      registeredOnly += registered;
      registeredOnlyEvents += 1;
    }
  }

  if (paired > 0) {
    const show = Math.round((pairedChecked / pairedRegistered) * 1000) / 1000;
    return {
      registered: pairedRegistered,
      checked_in: pairedChecked,
      show_up_rate: show,
      events: paired,
      source: "luma-aggregates",
      note: NOTE,
    };
  }
  if (registeredOnlyEvents > 0) {
    return {
      registered: registeredOnly,
      checked_in: null,
      show_up_rate: null,
      events: registeredOnlyEvents,
      source: "luma-aggregates",
      note: NOTE,
    };
  }
  return null;
}

export function lumaPitchSentence(counts: LumaCounts): string {
  if (counts.checked_in != null && counts.registered != null && counts.show_up_rate != null) {
    return `Luma totals across ${counts.events} past events: ${counts.registered} registered, ${counts.checked_in} checked in, show-up ${percent(counts.show_up_rate)}. ${counts.note}`;
  }
  if (counts.registered != null) {
    return `Luma published ${counts.registered} registered across ${counts.events} events. Checked-in was not published, so there is no show-up rate from Luma. ${counts.note}`;
  }
  return counts.note;
}
