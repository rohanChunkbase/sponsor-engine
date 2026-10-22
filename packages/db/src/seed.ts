import fs from "node:fs";
import path from "node:path";
import type { Db } from "./db.js";
import { repoRoot } from "./db.js";
import { asFloat, asInt, parseCsv, slug } from "./csv.js";

type SponsorRow = {
  id: string;
  company: string;
  website: string;
  category: string;
  roles: string;
  london_events: number;
  london_events_stated: number;
  food_or_drinks_events: number;
  venue_events: number;
  typical_ask_gbp: number | null;
  in_kind: string;
  audiences: string;
  contact_role: string;
  evidence_urls: string;
  notes: string;
  is_sample: string;
  source: string;
};

const COMPANY_BOOKINGS: Array<{
  id: string;
  title: string;
  date: string;
  headcount: number;
  show: number;
  area: string;
}> = [
  { id: "B-CO-01", title: "Northwind Analytics evening (SAMPLE)", date: "2025-11-12", headcount: 24, show: 0.88, area: "Lyric Square" },
  { id: "B-CO-02", title: "Harbor & Co. product review (SAMPLE)", date: "2025-12-03", headcount: 36, show: 0.9, area: "Kings Cross" },
  { id: "B-CO-03", title: "Lumen Freight offsite (SAMPLE)", date: "2026-01-15", headcount: 48, show: 0.86, area: "Shoreditch" },
  { id: "B-CO-04", title: "Paperfinch client workshop (SAMPLE)", date: "2026-02-04", headcount: 20, show: 0.9, area: "Farringdon" },
  { id: "B-CO-05", title: "Northwind Analytics training day (SAMPLE)", date: "2026-02-26", headcount: 60, show: 0.87, area: "Lyric Square" },
  { id: "B-CO-06", title: "Sable Metrics away day (SAMPLE)", date: "2026-03-18", headcount: 80, show: 0.85, area: "Canary Wharf" },
  { id: "B-CO-07", title: "Bright Parcel leadership forum (SAMPLE)", date: "2026-04-09", headcount: 30, show: 0.9, area: "London Bridge" },
  { id: "B-CO-08", title: "Harbor & Co. hack day (SAMPLE)", date: "2026-05-07", headcount: 42, show: 0.88, area: "Old Street" },
  { id: "B-CO-09", title: "Lumen Freight customer evening (SAMPLE)", date: "2026-06-11", headcount: 100, show: 0.84, area: "Kings Cross" },
  { id: "B-CO-10", title: "Paperfinch sales kickoff (SAMPLE)", date: "2026-07-02", headcount: 55, show: 0.89, area: "Lyric Square" },
  { id: "B-CO-11", title: "Sable Metrics board dinner (SAMPLE)", date: "2026-08-20", headcount: 18, show: 0.94, area: "Mayfair" },
  { id: "B-CO-12", title: "Bright Parcel partner day (SAMPLE)", date: "2026-09-16", headcount: 70, show: 0.86, area: "Shoreditch" },
];

function readCsv(file: string): Record<string, string>[] {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function uniqueUrls(value: string): string {
  const parts = value.split(/\s+/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(parts)].join(" ");
}

export function seed(db: Db, root = repoRoot()): { counts: Record<string, number> } {
  const real = path.join(root, "data", "real-data");
  const extra = path.join(real, "new_2026-10-22");
  const sample = path.join(root, "data", "synthetic-data");

  db.exec(`
    DELETE FROM approvals;
    DELETE FROM outbox;
    DELETE FROM quotes;
    DELETE FROM tasks;
    DELETE FROM requests;
    DELETE FROM failures;
    DELETE FROM agent_runs;
    DELETE FROM bookings;
    DELETE FROM sponsor_claims;
    DELETE FROM sponsors;
    DELETE FROM events;
    DELETE FROM communities;
  `);

  const insertCommunity = dbInsert(db, "communities", [
    "id", "name", "focus", "url", "area", "lat", "lon", "members_estimate",
    "organiser_name", "events_found", "sponsor_companies", "is_sample", "source",
  ]);
  const insertEvent = dbInsert(db, "events", [
    "id", "community_id", "community_name", "title", "date", "status", "venue", "area",
    "lat", "lon", "registrations", "check_ins", "show_up_rate", "approx_size",
    "food_cost_gbp", "food_per_head_gbp", "ticket", "url", "source_url", "platform",
    "is_sample", "source",
  ]);
  const insertSponsor = dbInsert(db, "sponsors", [
    "id", "company", "website", "category", "roles", "london_events", "london_events_stated",
    "food_or_drinks_events", "venue_events", "typical_ask_gbp", "in_kind", "audiences",
    "contact_role", "evidence_urls", "notes", "is_sample", "source",
  ]);
  const insertClaim = dbInsert(db, "sponsor_claims", [
    "event_id", "event_name", "event_date", "community", "company", "sponsor_id", "role",
    "confidence", "evidence_quote", "source_url", "is_sample", "source",
  ]);
  const insertBooking = dbInsert(db, "bookings", [
    "id", "event_id", "community_id", "title", "date", "requester_kind", "headcount",
    "registrations", "check_ins", "show_up_rate", "venue_area", "ticket", "room_gbp",
    "food_cost_gbp", "food_per_head_gbp", "price_gbp", "is_sample", "notes",
  ]);

  for (const row of readCsv(path.join(real, "csv", "communities.csv"))) {
    insertCommunity.run(
      row.community_id, row.name, row.focus, row.url, null, null, null, null, null,
      asInt(row.events_found), row.sponsor_companies, "", "real",
    );
  }
  for (const row of readCsv(path.join(extra, "communities_new.csv"))) {
    insertCommunity.run(
      row.community_id, row.name, row.focus, row.url, null, null, null, null, null,
      asInt(row.events_found), row.sponsor_companies, "", "real_new",
    );
  }
  for (const row of readCsv(path.join(sample, "csv", "communities.csv"))) {
    insertCommunity.run(
      row.community_id, row.name, row.focus, null, row.area, asFloat(row.lat), asFloat(row.lon),
      asInt(row.members_estimate), row.organiser_name, null, null, "SAMPLE", "synthetic",
    );
  }

  const communityIdByName = new Map<string, string>();
  for (const row of db.all<{ id: string; name: string }>("SELECT id, name FROM communities")) {
    communityIdByName.set(normalName(row.name), row.id);
  }

  for (const row of readCsv(path.join(real, "csv", "events.csv"))) {
    insertEvent.run(
      row.event_id,
      communityIdByName.get(normalName(row.community)) ?? null,
      row.community, row.name, row.date, row.status, row.venue, row.area,
      asFloat(row.lat), asFloat(row.lon), null, null, null, asInt(row.approx_size),
      null, null, null, row.url, row.source_url, row.platform, "", "real",
    );
  }
  for (const row of readCsv(path.join(extra, "events_new.csv"))) {
    insertEvent.run(
      row.event_id,
      communityIdByName.get(normalName(row.community)) ?? null,
      row.community, row.name, cleanDate(row.date), row.status, row.venue, row.area,
      null, null, null, null, null, asInt(row.approx_size),
      null, null, null, row.url, row.source_urls, row.platform, "", "real_new",
    );
  }
  const sampleCommunityName = new Map(
    readCsv(path.join(sample, "csv", "communities.csv")).map((row) => [row.community_id, row.name]),
  );
  for (const row of readCsv(path.join(sample, "csv", "events.csv"))) {
    insertEvent.run(
      row.event_id, row.community_id, sampleCommunityName.get(row.community_id) ?? null, row.title, row.date, row.check_ins ? "past" : "upcoming",
      null, row.venue_area, asFloat(row.lat), asFloat(row.lon),
      asInt(row.registrations), asInt(row.check_ins), asFloat(row.show_up_rate),
      asInt(row.check_ins) ?? asInt(row.registrations),
      asInt(row.food_cost_gbp), asFloat(row.food_per_head_gbp), row.ticket, null, null, "sample",
      "SAMPLE", "synthetic",
    );
    const checkIns = asInt(row.check_ins);
    const food = asInt(row.food_cost_gbp);
    const perHead = asFloat(row.food_per_head_gbp);
    const regs = asInt(row.registrations);
    if (checkIns && food != null && perHead != null && regs) {
      const room = Math.round(checkIns * 2.5);
      insertBooking.run(
        row.event_id, row.event_id, row.community_id, row.title, row.date, "community",
        regs, regs, checkIns, asFloat(row.show_up_rate), row.venue_area, row.ticket || "free",
        room, food, perHead, room + food, "SAMPLE",
        "Community evening. The room contribution is £2.50 for each person who came. The food cost is the recorded cost.",
      );
    }
  }

  const sponsors = new Map<string, SponsorRow>();
  const addReal = (row: Record<string, string>, source: "real" | "real_new") => {
    const key = row.company.trim().toLowerCase();
    const existing = sponsors.get(key);
    const london = asInt(row.london_events ?? row.london_events_found) ?? 0;
    const stated = asInt(row.london_events_stated ?? row.stated_claims) ?? 0;
    const food = asInt(row.food_or_drinks_events) ?? 0;
    const venue = asInt(row.venue_events) ?? 0;
    if (!existing) {
      sponsors.set(key, {
        id: `sp-${slug(row.company)}`,
        company: row.company.trim(),
        website: (row.website || "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
        category: row.category || "",
        roles: row.roles || "",
        london_events: london,
        london_events_stated: stated,
        food_or_drinks_events: food,
        venue_events: venue,
        typical_ask_gbp: null,
        in_kind: "",
        audiences: row.event_types || row.communities || "",
        contact_role: "",
        evidence_urls: uniqueUrls(row.evidence_urls || ""),
        notes: row.notes || row.website_note || "",
        is_sample: "",
        source,
      });
      return;
    }
    existing.london_events += london;
    existing.london_events_stated += stated;
    existing.food_or_drinks_events += food;
    existing.venue_events += venue;
    existing.evidence_urls = uniqueUrls(`${existing.evidence_urls} ${row.evidence_urls || ""}`);
    if (row.roles) existing.roles = mergeRoles(existing.roles, row.roles);
    if (row.notes) existing.notes = [existing.notes, row.notes].filter(Boolean).join(" ");
    existing.source = "real";
  };

  for (const row of readCsv(path.join(real, "csv", "sponsors.csv"))) addReal(row, "real");
  for (const row of readCsv(path.join(extra, "sponsors_new.csv"))) addReal(row, "real_new");
  for (const row of readCsv(path.join(sample, "csv", "sponsors.csv"))) {
    const key = row.company.trim().toLowerCase();
    sponsors.set(key, {
      id: `sp-sample-${slug(row.sponsor_id || row.company)}`,
      company: row.company.trim(),
      website: (row.website || "").replace(/^https?:\/\//, ""),
      category: row.category || "",
      roles: row.category || "",
      london_events: 0,
      london_events_stated: 0,
      food_or_drinks_events: /food|drinks/.test(row.category) ? 1 : 0,
      venue_events: row.category === "venue" ? 1 : 0,
      typical_ask_gbp: asInt(row.typical_ask_gbp),
      in_kind: row.in_kind || "",
      audiences: row.audiences_sponsored || "",
      contact_role: row.contact_role || "",
      evidence_urls: "",
      notes: "SAMPLE / fictional sponsor. Do not present this row as a real company.",
      is_sample: "SAMPLE",
      source: "synthetic",
    });
  }

  const sponsorIdByCompany = new Map<string, string>();
  for (const sponsor of sponsors.values()) {
    sponsorIdByCompany.set(sponsor.company.toLowerCase(), sponsor.id);
    insertSponsor.run(
      sponsor.id, sponsor.company, sponsor.website, sponsor.category, sponsor.roles,
      sponsor.london_events, sponsor.london_events_stated, sponsor.food_or_drinks_events,
      sponsor.venue_events, sponsor.typical_ask_gbp, sponsor.in_kind, sponsor.audiences,
      sponsor.contact_role, sponsor.evidence_urls, sponsor.notes, sponsor.is_sample, sponsor.source,
    );
  }

  const addClaim = (row: Record<string, string>, source: string, sample = "") => {
    const company = row.company.trim();
    insertClaim.run(
      row.event_id, row.event_name, cleanDate(row.event_date), row.community, company,
      sponsorIdByCompany.get(company.toLowerCase()) ?? null,
      row.role, row.confidence, row.evidence_quote, row.source_url, sample, source,
    );
  };
  for (const row of readCsv(path.join(real, "csv", "sponsor_claims.csv"))) addClaim(row, "real");
  for (const row of readCsv(path.join(extra, "sponsor_claims_new.csv"))) addClaim(row, "real_new");

  for (const row of readCsv(path.join(sample, "csv", "sponsor_deals.csv"))) {
    const sponsor = db.get<{ company: string; id: string }>(
      "SELECT id, company FROM sponsors WHERE id LIKE ? LIMIT 1",
      [`%${slug(row.sponsor_id)}%`],
    );
    if (!sponsor) continue;
    addClaim({
      event_id: row.event_id,
      event_name: row.event_id,
      event_date: row.asked_on,
      community: "",
      company: sponsor.company,
      role: row.outcome === "yes" ? "food" : "general",
      confidence: "stated",
      evidence_quote: `SAMPLE deal ${row.outcome}. Ask £${row.ask_gbp}. Amount £${row.amount_gbp}. ${row.notes || ""}`.trim(),
      source_url: "",
    }, "synthetic", "SAMPLE");
  }

  for (const booking of COMPANY_BOOKINGS) {
    const checkIns = Math.round(booking.headcount * booking.show);
    const foodPer = 14;
    const roomPer = 18;
    const food = Math.round(checkIns * foodPer);
    const room = Math.round(checkIns * roomPer);
    insertBooking.run(
      booking.id, null, null, booking.title, booking.date, "company",
      booking.headcount, booking.headcount, checkIns, booking.show, booking.area, "paid",
      room, food, foodPer, room + food, "SAMPLE",
      "SAMPLE company booking. The room rate is £18 for each person who came. Catering is £14 for each person who came. These companies are fictional.",
    );
  }

  const counts = {
    communities: count(db, "communities"),
    events: count(db, "events"),
    sponsors: count(db, "sponsors"),
    sponsor_claims: count(db, "sponsor_claims"),
    bookings: count(db, "bookings"),
  };
  return { counts };
}

function count(db: Db, table: string): number {
  const row = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}

function normalName(value: string): string {
  return value.replace(/\s*\(SAMPLE\)\s*/gi, "").trim().toLowerCase();
}

function cleanDate(value: string | undefined): string {
  if (!value) return "";
  const iso = value.match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : value;
}

function mergeRoles(left: string, right: string): string {
  const map = new Map<string, number>();
  for (const part of `${left};${right}`.split(";")) {
    const [role, raw] = part.split(":").map((item) => item.trim());
    if (!role) continue;
    const value = Number(raw);
    map.set(role, (map.get(role) ?? 0) + (Number.isFinite(value) ? value : 1));
  }
  return [...map.entries()].map(([role, value]) => `${role}:${value}`).join(";");
}

function dbInsert(db: Db, table: string, columns: string[]) {
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  return {
    run(...values: unknown[]) {
      db.run(sql, values);
    },
  };
}
